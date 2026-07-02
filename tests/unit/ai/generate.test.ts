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
    generatedContent: { create: vi.fn() },
    wordPressPost: { update: vi.fn() },
  },
}));
vi.mock("@/lib/audit", () => ({ writeAudit: vi.fn() }));
vi.mock("@/lib/queue/enqueue", () => ({ enqueuePublish: vi.fn() }));

import { generateForPost } from "@/lib/ai/generate";
import type { GeneratedOutput } from "@/lib/ai/schemas";
import { writeAudit } from "@/lib/audit";
import { getCharLimit } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";

const findMany = prisma.platformAccount.findMany as unknown as Mock;
const create = prisma.generatedContent.create as unknown as Mock;
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

  it("marks YouTube and TikTok MANUAL_REQUIRED", async () => {
    await generateForPost(POST);
    expect(createdFor("YOUTUBE")?.status).toBe("MANUAL_REQUIRED");
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
