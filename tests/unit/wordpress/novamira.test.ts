import { describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";
import { NovaMiraError, fetchFullPost } from "@/lib/wordpress/novamira";

const FULL_POST = {
  wpPostId: "1234",
  title: "Backfilled Title",
  content: "Full backfilled content body.",
  excerpt: "An excerpt",
  featuredImageUrl: "https://blog.example.com/img.jpg",
  url: "https://blog.example.com/backfilled",
  categories: ["news"],
  tags: ["x"],
};

/** A vi.fn() typed as the injectable fetch. */
function mockFetch(impl: () => Promise<Response>): typeof fetch {
  return vi.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchFullPost — success (FR-005)", () => {
  it("backfills missing fields from the MCP response (top-level post)", async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse(FULL_POST)));
    // The receiver only knows the id; NovaMira fills the rest.
    const post = await fetchFullPost({ wpPostId: "1234" }, fetchImpl);

    expect(post.title).toBe("Backfilled Title");
    expect(post.content).toBe("Full backfilled content body.");
    expect(post.url).toBe("https://blog.example.com/backfilled");
    expect(post.featuredImageUrl).toBe("https://blog.example.com/img.jpg");
  });

  it("sends the auth token, site URL, and identifier to NovaMira", async () => {
    const fn = vi.fn<typeof fetch>(() => Promise.resolve(jsonResponse(FULL_POST)));
    await fetchFullPost({ wpPostId: "1234" }, fn);

    expect(fn).toHaveBeenCalledTimes(1);
    const call = fn.mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[0]).toBe(env.NOVAMIRA_MCP_URL);

    const requestInit = call?.[1];
    const headers = requestInit?.headers as Record<string, string> | undefined;
    expect(headers?.authorization).toBe(`Bearer ${env.NOVAMIRA_MCP_TOKEN}`);

    const body = JSON.parse(requestInit?.body as string) as {
      arguments: { wpPostId?: string; siteUrl: string };
    };
    expect(body.arguments.wpPostId).toBe("1234");
    expect(body.arguments.siteUrl).toBe(env.WORDPRESS_SITE_URL);
  });

  it.each([
    ["post", { post: FULL_POST }],
    ["result", { result: FULL_POST }],
    ["data", { data: FULL_POST }],
  ])("accepts the post under the %s envelope", async (_name, envelope) => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse(envelope)));
    const post = await fetchFullPost({ url: "https://blog.example.com/x" }, fetchImpl);
    expect(post.title).toBe("Backfilled Title");
  });
});

describe("fetchFullPost — unretrievable throws NovaMiraError (no partial publish)", () => {
  it("throws when neither wpPostId nor url is provided", async () => {
    await expect(fetchFullPost({})).rejects.toBeInstanceOf(NovaMiraError);
  });

  it("throws on a non-2xx HTTP response", async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(new Response("nope", { status: 404 })),
    );
    await expect(
      fetchFullPost({ wpPostId: "1" }, fetchImpl),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("throws on invalid JSON", async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(new Response("not-json", { status: 200 })),
    );
    await expect(
      fetchFullPost({ wpPostId: "1" }, fetchImpl),
    ).rejects.toBeInstanceOf(NovaMiraError);
  });

  it("throws when the post fails schema validation (incomplete)", async () => {
    const bad = { wpPostId: "1", title: "", content: "", url: "not-a-url" };
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ post: bad })));
    await expect(
      fetchFullPost({ wpPostId: "1" }, fetchImpl),
    ).rejects.toThrow(/unretrievable or incomplete/);
  });

  it("wraps a network error with a cause", async () => {
    const networkError = new Error("ECONNREFUSED");
    const fetchImpl = mockFetch(() => Promise.reject(networkError));
    await expect(fetchFullPost({ wpPostId: "1" }, fetchImpl)).rejects.toMatchObject(
      {
        name: "NovaMiraError",
        cause: networkError,
      },
    );
  });
});
