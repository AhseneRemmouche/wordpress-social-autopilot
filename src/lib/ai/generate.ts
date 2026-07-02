import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  ContentStatus,
  GeneratedContent,
  Platform,
  PlatformAccount,
  WordPressPost,
} from "@prisma/client";

import { MODEL, THINKING, anthropic } from "@/lib/ai/client";
import { PLATFORM_PROMPTS } from "@/lib/ai/prompts";
import type { PostInput } from "@/lib/ai/prompts/types";
import { PLATFORM_OUTPUT_SCHEMAS, type GeneratedOutput } from "@/lib/ai/schemas";
import { writeAudit } from "@/lib/audit";
import { truncateToLimit } from "@/lib/limits";
import { prisma } from "@/lib/prisma";
import { enqueuePublish } from "@/lib/queue/enqueue";

/**
 * Content generation orchestrator (plan §4). For each platform: generate copy
 * with Claude (adaptive thinking, schema-validated structured output), append
 * the backlink (FR-009), truncate to the platform limit (FR-011), create the
 * GeneratedContent row, and set its status. Per-platform failures are isolated
 * (FR-016/FR-030); the post is stamped `generatedAt` once all six are attempted.
 */

const MAX_TOKENS = 4096;

// TikTok cannot direct-publish publicly until the app passes TikTok's audit, so
// its content is held for manual posting this phase (research.md).
const TIKTOK_AUDITED = false;

const PLATFORMS = Object.keys(PLATFORM_PROMPTS) as Platform[];

function toPostInput(post: WordPressPost): PostInput {
  return {
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    url: post.url,
    categories: post.categories,
    tags: post.tags,
    featuredImageUrl: post.featuredImageUrl,
  };
}

/** Decide the lifecycle status for a freshly generated item. */
function resolveStatus(
  platform: Platform,
  post: PostInput,
  account: PlatformAccount | undefined,
): ContentStatus {
  if (platform === "YOUTUBE") return "MANUAL_REQUIRED"; // no community-post API
  if (platform === "INSTAGRAM" && !post.featuredImageUrl) return "MANUAL_REQUIRED";
  if (platform === "TIKTOK" && !TIKTOK_AUDITED) return "MANUAL_REQUIRED";
  if (account?.autoPublish && account.status === "CONNECTED") return "APPROVED";
  return "PENDING";
}

function generationErrorReason(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 300);
  return "Unknown generation error";
}

function createContentRow(
  postId: string,
  platform: Platform,
  fields: {
    body: string;
    hashtags: string[];
    link: string;
    charCount: number;
    status: ContentStatus;
  },
): Promise<GeneratedContent> {
  return prisma.generatedContent.create({
    data: { post: { connect: { id: postId } }, platform, ...fields },
  });
}

async function generatePlatform(
  post: WordPressPost,
  postInput: PostInput,
  platform: Platform,
  account: PlatformAccount | undefined,
): Promise<void> {
  const prompt = PLATFORM_PROMPTS[platform];
  const schema = PLATFORM_OUTPUT_SCHEMAS[platform];

  let output: GeneratedOutput | null = null;
  let failureReason: string | null = null;

  try {
    const message = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: THINKING,
      system: prompt.system,
      messages: [{ role: "user", content: prompt.buildUserPrompt(postInput) }],
      output_config: { format: zodOutputFormat(schema) },
    });
    const parsed = message.parsed_output;
    if (!parsed || parsed.body.trim().length === 0) {
      failureReason = "Empty or unusable model output";
    } else {
      output = parsed;
    }
  } catch (error) {
    failureReason = generationErrorReason(error);
  }

  // Unusable/empty output → FAILED with a recorded reason (no partial publish).
  if (!output) {
    const failed = await createContentRow(post.id, platform, {
      body: "",
      hashtags: [],
      link: post.url,
      charCount: 0,
      status: "FAILED",
    });
    await writeAudit({
      contentId: failed.id,
      platform,
      attempt: 0,
      outcome: "FAILURE",
      errorContext: { stage: "generation", reason: failureReason },
    });
    return;
  }

  const body = truncateToLimit(output.body, post.url, platform); // FR-009/FR-011
  const status = resolveStatus(platform, postInput, account);

  const content = await createContentRow(post.id, platform, {
    body,
    hashtags: output.hashtags,
    link: post.url,
    charCount: body.length,
    status,
  });

  if (status === "APPROVED") {
    await enqueuePublish(content.id);
  }
}

/**
 * Generate platform content for one WordPress post. Creates one GeneratedContent
 * row per platform, enqueues publish jobs for auto-publish + connected platforms,
 * and stamps `generatedAt` so the post is not reprocessed.
 */
export async function generateForPost(post: WordPressPost): Promise<void> {
  const postInput = toPostInput(post);

  const accounts = await prisma.platformAccount.findMany();
  const accountByPlatform = new Map<Platform, PlatformAccount>(
    accounts.map((account) => [account.platform, account]),
  );

  // Isolate per-platform failures (FR-016/FR-030).
  await Promise.allSettled(
    PLATFORMS.map((platform) =>
      generatePlatform(post, postInput, platform, accountByPlatform.get(platform)),
    ),
  );

  await prisma.wordPressPost.update({
    where: { id: post.id },
    data: { generatedAt: new Date() },
  });
}
