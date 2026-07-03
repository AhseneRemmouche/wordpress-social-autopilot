/* eslint-disable @typescript-eslint/no-explicit-any -- in-memory Prisma fake for the end-to-end pipeline test */
import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

// --- In-memory Prisma fake: enough of the query surface to drive the pipeline. ---
const db = vi.hoisted(() => {
  const posts: any[] = [];
  const content: any[] = [];
  const jobs: any[] = [];
  const accounts: any[] = [];
  let seq = 0;
  const nid = (p: string): string => `${p}-${++seq}`;

  const prisma = {
    wordPressPost: {
      findUnique: async ({ where }: any) =>
        posts.find((p) => (where.id ? p.id === where.id : p.wpPostId === where.wpPostId)) ?? null,
      create: async ({ data }: any) => {
        const row = { id: nid("post"), generatedAt: null, ...data };
        posts.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = posts.find((p) => p.id === where.id);
        Object.assign(row, data);
        return row;
      },
      findMany: async ({ where, take }: any = {}) => {
        let rows = posts;
        if (where && "generatedAt" in where) rows = rows.filter((p) => p.generatedAt == null);
        return rows.slice(0, take ?? rows.length);
      },
    },
    platformAccount: {
      findMany: async () => [...accounts],
      findUnique: async ({ where }: any) =>
        accounts.find((a) => a.platform === where.platform) ?? null,
    },
    generatedContent: {
      create: async ({ data }: any) => {
        const { post, ...rest } = data;
        const row = { id: nid("gc"), postId: post?.connect?.id, ...rest };
        content.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = content.find((c) => c.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    publishJob: {
      create: async ({ data }: any) => {
        const row = {
          id: nid("job"),
          contentId: data.content?.connect?.id,
          status: "QUEUED",
          attempts: 0,
          maxAttempts: 3,
          nextRunAt: new Date(0),
          lastError: null,
        };
        jobs.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = jobs.find((j) => j.id === where.id);
        if (!row) return null;
        return include?.content
          ? { ...row, content: content.find((c) => c.id === row.contentId) }
          : row;
      },
      findMany: async ({ where, take }: any = {}) => {
        let rows = jobs;
        if (where?.status) rows = rows.filter((j) => j.status === where.status);
        if (where?.nextRunAt?.lte) rows = rows.filter((j) => j.nextRunAt <= where.nextRunAt.lte);
        return rows.slice(0, take ?? rows.length);
      },
      update: async ({ where, data }: any) => {
        const row = jobs.find((j) => j.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
    $transaction: async (ops: any) =>
      typeof ops === "function" ? ops(prisma) : Promise.all(ops),
  };

  return {
    prisma,
    stores: { posts, content, jobs, accounts },
    reset: () => {
      posts.length = 0;
      content.length = 0;
      jobs.length = 0;
      accounts.length = 0;
      seq = 0;
    },
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: db.prisma }));
vi.mock("@/lib/ai/client", () => ({
  MODEL: "claude-opus-4-8",
  THINKING: { type: "adaptive" },
  anthropic: {
    messages: {
      parse: vi.fn(async () => ({
        parsed_output: {
          body: "Read our latest article on scaling systems — lots to learn.",
          hashtags: ["#eng", "#blog"],
        },
      })),
    },
  },
}));
vi.mock("@/lib/oauth/tokens", () => ({
  getValidAccessToken: vi.fn(async () => "test-token"),
  refreshAccessToken: vi.fn(),
  TokenError: class TokenError extends Error {},
}));
vi.mock("@/lib/wordpress/novamira", () => ({
  fetchFullPost: vi.fn(),
  NovaMiraError: class NovaMiraError extends Error {},
}));
vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn(async () => null),
  redactSecrets: (v: unknown) => v,
}));

import { env } from "@/lib/env";
import { POST as webhook } from "@/app/api/webhooks/wordpress/route";
import { runGenerationPass, runPublishPass } from "@/lib/queue/worker";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", env.WEBHOOK_SECRET).update(body).digest("hex");
}

const PAYLOAD = {
  wpPostId: "9001",
  event: "post_published",
  title: "Scaling Systems 101",
  content: "The full body content of the post about scaling systems.",
  excerpt: "How we scale.",
  featuredImageUrl: "https://blog.example.com/scale.jpg",
  url: "https://blog.example.com/scaling-systems",
  categories: ["eng"],
  tags: ["scaling"],
};

function byPlatform(platform: string): any {
  return db.stores.content.find((c) => c.platform === platform);
}

beforeEach(() => {
  db.reset();
  // LinkedIn / Facebook / X: connected + auto-publish → should PUBLISH.
  db.stores.accounts.push(
    {
      platform: "LINKEDIN",
      status: "CONNECTED",
      autoPublish: true,
      accessToken: "enc",
      externalAccountId: "urn:li:person:1",
    },
    { platform: "FACEBOOK", status: "CONNECTED", autoPublish: true, accessToken: "enc", fbPageId: "page-1" },
    { platform: "X", status: "CONNECTED", autoPublish: true, accessToken: "enc" },
    // Instagram connected but auto-publish OFF → stays PENDING.
    { platform: "INSTAGRAM", status: "CONNECTED", autoPublish: false, accessToken: "enc", igUserId: "ig-1" },
  );

  // Publisher network calls succeed for LinkedIn / Facebook / X.
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      const url = String(input);
      if (url.includes("api.linkedin.com/rest/posts")) {
        return new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:1" } });
      }
      if (url.includes("/feed")) {
        return new Response(JSON.stringify({ id: "page_1_post" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("api.x.com/2/tweets")) {
        return new Response(JSON.stringify({ data: { id: "tweet_1" } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
});

describe("full pipeline: webhook → generation → publish (SC-001/SC-004, Principle VII)", () => {
  it("creates six content items; auto-publish+connected reach PUBLISHED; YouTube is MANUAL_REQUIRED", async () => {
    // 1. Signed webhook → post persisted (generatedAt null).
    const body = JSON.stringify(PAYLOAD);
    const res = await webhook(
      new Request("http://localhost/api/webhooks/wordpress", {
        method: "POST",
        body,
        headers: { "content-type": "application/json", "x-wsa-signature": sign(body) },
      }),
    );
    expect(res.status).toBe(202);
    expect(db.stores.posts).toHaveLength(1);
    expect(db.stores.posts[0].generatedAt).toBeNull();

    // 2. Generation pass → six GeneratedContent rows + statuses + enqueue.
    const generated = await runGenerationPass();
    expect(generated).toBe(1);
    expect(db.stores.content).toHaveLength(6); // SC-001: one per platform
    expect(db.stores.posts[0].generatedAt).not.toBeNull(); // stamped, won't reprocess

    // Manual / pending platforms at generation time.
    expect(byPlatform("YOUTUBE").status).toBe("MANUAL_REQUIRED");
    expect(byPlatform("TIKTOK").status).toBe("PENDING"); // has featured image → publishable draft
    expect(byPlatform("INSTAGRAM").status).toBe("PENDING");
    // Auto-publish + connected → APPROVED and enqueued.
    expect(byPlatform("LINKEDIN").status).toBe("APPROVED");
    expect(db.stores.jobs).toHaveLength(3);

    // 3. Publish pass → connected auto-publish platforms PUBLISHED.
    const published = await runPublishPass();
    expect(published).toBe(3);

    expect(byPlatform("LINKEDIN").status).toBe("PUBLISHED");
    expect(byPlatform("FACEBOOK").status).toBe("PUBLISHED");
    expect(byPlatform("X").status).toBe("PUBLISHED"); // SC-004
    expect(db.stores.content.filter((c) => c.status === "PUBLISHED")).toHaveLength(3);
    expect(db.stores.jobs.every((j) => j.status === "SUCCEEDED")).toBe(true);

    // Untouched by publishing.
    expect(byPlatform("YOUTUBE").status).toBe("MANUAL_REQUIRED");
    expect(byPlatform("INSTAGRAM").status).toBe("PENDING");
  });
});
