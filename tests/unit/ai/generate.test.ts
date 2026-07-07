import type { Platform, WordPressPost } from "@prisma/client";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";

// Shared mutable state for the Claude mock (hoisted so the vi.mock factory can use it).
const h = vi.hoisted(() => ({
  responses: new Map<string, unknown>(),
  parseMock: vi.fn(),
}));

vi.mock("@/lib/ai/client", () => ({
  MODEL: "claude-opus-4-8",
  THINKING: { type: "adaptive" },
  anthropic: { messages: { parse: h.parseMock } },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformAccount: { findMany: vi.fn() },
    generatedContent: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    wordPressPost: { update: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/queue/enqueue", () => ({ enqueuePublish: vi.fn() }));

import { generateForPost, regeneratePlatform } from "@/lib/ai/generate";
import type { GeneratedOutput } from "@/lib/ai/schemas";
import { writeAudit } from "@/lib/audit";
import { getCharLimit } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";

const findMany = prisma.platformAccount.findMany as unknown as Mock;
const create = prisma.generatedContent.create as unknown as Mock;
const findUniqueContent = prisma.generatedContent.findUnique as unknown as Mock;
const updateContent = prisma.generatedContent.update as unknown as Mock;
const update = prisma.wordPressPost.update as unknown as Mock;
const writeAuditMock = writeAudit as unknown as Mock;
const enqueueMock = enqueuePublish as unknown as Mock;

const ALL_PLATFORMS: Platform[] = [
  "LINKEDIN",
  "INSTAGRAM",
  "FACEBOOK",
  "YOUTUBE",
  "X",
  "TIKTOK",
];

function tags(n: number): string[] {
  return Array.from({ length: n }, (_v, i) => `#t${i}`);
}

const VALID_OUTPUTS: Record<Platform, GeneratedOutput> = {
  LINKEDIN: { body: "A professional take on widgets.", hashtags: tags(4) },
  INSTAGRAM: { body: "Visual hook about widgets.", hashtags: tags(12) },
  FACEBOOK: { body: "Hey, widgets are great!", hashtags: tags(2) },
  YOUTUBE: { body: "Watch: widgets explained.", hashtags: tags(3) },
  X: { body: "Widgets, fast.", hashtags: tags(2) },
  TIKTOK: { body: "Widgets POV you needed.", hashtags: tags(4) },
};

function detectPlatform(system: string): Platform {
  if (system.includes("LinkedIn")) return "LINKEDIN";
  if (system.includes("Instagram")) return "INSTAGRAM";
  if (system.includes("Facebook")) return "FACEBOOK";
  if (system.includes("YouTube")) return "YOUTUBE";
  if (system.includes("TikTok")) return "TIKTOK";
  return "X";
}

const POST = {
  id: "wp-1",
  wpPostId: "1",
  title: "All About Widgets",
  content: "An article about widgets and their many uses.",
  excerpt: "Widgets explained.",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/widgets",
  categories: ["news"],
  tags: ["a"],
  sourceComplete: true,
  receivedAt: new Date(),
  generatedAt: null,
} as WordPressPost;

function createdFor(platform: Platform): Record<string, unknown> | undefined {
  const call = create.mock.calls.find((c) => c[0]?.data?.platform === platform);
  return call?.[0]?.data as Record<string, unknown> | undefined;
}

beforeEach(() => {
  h.responses.clear();
  h.parseMock.mockReset().mockImplementation((params: { system: string }) => {
    const platform = detectPlatform(params.system);
    const configured = h.responses.get(platform);
    if (configured === "THROW") return Promise.reject(new Error("api error"));
    return Promise.resolve(configured ?? { parsed_output: VALID_OUTPUTS[platform] });
  });
  findMany.mockReset().mockResolvedValue([]);
  create
    .mockReset()
    .mockImplementation((arg: { data: { platform: Platform } }) =>
      Promise.resolve({ id: `gc-${arg.data.platform}` }),
    );
  update.mockReset().mockResolvedValue({});
  findUniqueContent.mockReset().mockResolvedValue(null);
  updateContent.mockReset().mockResolvedValue({});
  writeAuditMock.mockReset();
  enqueueMock.mockReset();
});

describe("generateForPost (plan §4 / Principle VII)", () => {
  it("creates all six items, each with a backlink within the platform limit", async () => {
    await generateForPost(POST);

    expect(create).toHaveBeenCalledTimes(6);
    for (const platform of ALL_PLATFORMS) {
      const data = createdFor(platform);
      expect(data, platform).toBeDefined();
      expect(data?.body as string).toContain(POST.url); // backlink (FR-009)
      expect((data?.body as string).length).toBeLessThanOrEqual(
        getCharLimit(platform), // FR-011
      );
    }
    // Post stamped generatedAt so it is not reprocessed.
    expect(update).toHaveBeenCalledWith({
      where: { id: POST.id },
      data: { generatedAt: expect.any(Date) },
    });
  });

  it("marks YouTube MANUAL_REQUIRED; TikTok is PENDING when it has a featured image", async () => {
    await generateForPost(POST);
    expect(createdFor("YOUTUBE")?.status).toBe("MANUAL_REQUIRED"); // no community-post API
    expect(createdFor("TIKTOK")?.status).toBe("PENDING"); // has image → publishable draft
  });

  it("marks TikTok MANUAL_REQUIRED when the post has no featured image", async () => {
    await generateForPost({ ...POST, featuredImageUrl: null } as WordPressPost);
    expect(createdFor("TIKTOK")?.status).toBe("MANUAL_REQUIRED");
  });

  it("a malformed (null) response for one platform → FAILED, others succeed (FR-016/FR-030)", async () => {
    h.responses.set("X", { parsed_output: null });
    await generateForPost(POST);

    expect(create).toHaveBeenCalledTimes(6); // X still gets a FAILED row
    expect(createdFor("X")?.status).toBe("FAILED");
    expect(createdFor("X")?.body).toBe("");
    expect(writeAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "X", outcome: "FAILURE" }),
    );
    // Others are not FAILED.
    expect(createdFor("LINKEDIN")?.status).not.toBe("FAILED");
    expect(createdFor("FACEBOOK")?.status).not.toBe("FAILED");
  });

  it("a thrown API error for one platform → FAILED, others unaffected (isolation)", async () => {
    h.responses.set("FACEBOOK", "THROW");
    await generateForPost(POST);

    expect(create).toHaveBeenCalledTimes(6);
    expect(createdFor("FACEBOOK")?.status).toBe("FAILED");
    expect(createdFor("LINKEDIN")?.status).not.toBe("FAILED");
    expect(createdFor("X")?.status).not.toBe("FAILED");
  });

  it("auto-publish + connected platform → APPROVED and enqueued; others not", async () => {
    findMany.mockResolvedValue([
      { id: "acc-li", platform: "LINKEDIN", autoPublish: true, status: "CONNECTED" },
    ]);
    await generateForPost(POST);

    expect(createdFor("LINKEDIN")?.status).toBe("APPROVED");
    expect(enqueueMock).toHaveBeenCalledTimes(1);
    expect(enqueueMock).toHaveBeenCalledWith("gc-LINKEDIN");
    // A platform with no connected/auto-publish account stays PENDING.
    expect(createdFor("FACEBOOK")?.status).toBe("PENDING");
  });
});

describe("regeneratePlatform (single-platform re-run)", () => {
  it("re-runs Claude and overwrites the caption, resetting it to PENDING", async () => {
    findUniqueContent.mockResolvedValue({
      id: "gc-1",
      platform: "LINKEDIN" as Platform,
      link: POST.url,
      post: POST,
    });

    const result = await regeneratePlatform("gc-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toContain(POST.url); // backlink preserved (FR-009)
      expect(result.body.length).toBeLessThanOrEqual(getCharLimit("LINKEDIN")); // FR-011
      expect(result.charCount).toBe(result.body.length);
    }
    expect(updateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "gc-1" },
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("returns { ok:false } and writes nothing when the model output is unusable", async () => {
    findUniqueContent.mockResolvedValue({ id: "gc-1", platform: "X" as Platform, link: POST.url, post: POST });
    h.responses.set("X", { parsed_output: null });

    const result = await regeneratePlatform("gc-1");

    expect(result.ok).toBe(false);
    expect(updateContent).not.toHaveBeenCalled();
  });

  it("returns { ok:false } when the content is missing", async () => {
    findUniqueContent.mockResolvedValue(null);
    expect(await regeneratePlatform("gone")).toEqual({ ok: false, error: "content not found" });
  });
});
