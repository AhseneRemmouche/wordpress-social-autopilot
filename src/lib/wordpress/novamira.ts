import { env } from "@/lib/env";
import { completePostSchema, type CompletePost } from "@/lib/wordpress/schema";

/**
 * NovaMira MCP fallback fetch (FR-005, plan §10).
 *
 * When a webhook payload is missing fields required for generation, the receiver
 * calls {@link fetchFullPost} to read the full post directly from WordPress via
 * the NovaMira MCP server (`NOVAMIRA_MCP_URL`, authenticated with
 * `NOVAMIRA_MCP_TOKEN`, scoped to `WORDPRESS_SITE_URL`). The response is validated
 * with `completePostSchema`; anything unretrievable/invalid throws so the caller
 * can mark the run failed and publish nothing partial.
 *
 * NOTE: NovaMira's exact tool name / response envelope should be confirmed against
 * its documentation; this calls the MCP endpoint over authenticated HTTP and
 * tolerates the post being returned at the top level or under `post`/`result`/`data`.
 */

export class NovaMiraError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NovaMiraError";
  }
}

export interface FetchFullPostParams {
  wpPostId?: string;
  url?: string;
}

type FetchImpl = typeof fetch;

/** Pull the post object out of a few plausible MCP response envelopes. */
function extractPost(json: unknown): unknown {
  if (json !== null && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if ("post" in obj) return obj.post;
    if ("result" in obj) return obj.result;
    if ("data" in obj) return obj.data;
  }
  return json;
}

export async function fetchFullPost(
  params: FetchFullPostParams,
  fetchImpl: FetchImpl = fetch,
): Promise<CompletePost> {
  if (!params.wpPostId && !params.url) {
    throw new NovaMiraError(
      "Cannot fetch post: neither wpPostId nor url was provided",
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(env.NOVAMIRA_MCP_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.NOVAMIRA_MCP_TOKEN}`,
      },
      body: JSON.stringify({
        tool: "get_wordpress_post",
        arguments: {
          siteUrl: env.WORDPRESS_SITE_URL,
          wpPostId: params.wpPostId,
          url: params.url,
        },
      }),
    });
  } catch (cause) {
    throw new NovaMiraError("NovaMira MCP request failed", { cause });
  }

  if (!response.ok) {
    throw new NovaMiraError(`NovaMira MCP returned HTTP ${response.status}`);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new NovaMiraError("NovaMira MCP returned invalid JSON", { cause });
  }

  const parsed = completePostSchema.safeParse(extractPost(json));
  if (!parsed.success) {
    throw new NovaMiraError(
      "NovaMira MCP post is unretrievable or incomplete (failed validation)",
    );
  }

  return parsed.data;
}
