import "dotenv/config";

import type { ContentStatus, Platform } from "@prisma/client";

import { encrypt } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

/**
 * Demo data for previewing the UI locally (`npm run seed`). Wipes the tables and
 * inserts a few posts (mixed statuses) + platform connections (one TOKEN_EXPIRED
 * to show the reconnect banner; TikTok/YouTube left off → DISCONNECTED). Not for
 * production.
 */

const PLATFORMS: Platform[] = ["LINKEDIN", "INSTAGRAM", "FACEBOOK", "YOUTUBE", "X", "TIKTOK"];

const HASHTAGS: Record<Platform, string[]> = {
  LINKEDIN: ["#engineering", "#webdev", "#postgres"],
  INSTAGRAM: ["#dev", "#coding", "#tech", "#buildinpublic"],
  FACEBOOK: ["#engineering", "#news"],
  YOUTUBE: ["#dev", "#tutorial"],
  X: ["#webdev", "#postgres"],
  TIKTOK: ["#coding", "#techtok", "#dev"],
};

interface SeedPost {
  wpPostId: string;
  title: string;
  url: string;
  featuredImageUrl: string | null;
  statuses: Record<Platform, ContentStatus>;
}

const POSTS: SeedPost[] = [
  {
    wpPostId: "demo-1",
    title: "Scaling Postgres to a Billion Rows",
    url: "https://blog.example.com/scaling-postgres",
    featuredImageUrl: "https://blog.example.com/img/pg.jpg",
    statuses: {
      LINKEDIN: "PUBLISHED",
      X: "PUBLISHED",
      FACEBOOK: "PENDING",
      INSTAGRAM: "PENDING",
      YOUTUBE: "MANUAL_REQUIRED",
      TIKTOK: "MANUAL_REQUIRED",
    },
  },
  {
    wpPostId: "demo-2",
    title: "10 Tailwind Tips We Use Every Day",
    url: "https://blog.example.com/tailwind-tips",
    featuredImageUrl: null,
    statuses: {
      LINKEDIN: "FAILED",
      X: "APPROVED",
      FACEBOOK: "REJECTED",
      INSTAGRAM: "MANUAL_REQUIRED",
      YOUTUBE: "MANUAL_REQUIRED",
      TIKTOK: "MANUAL_REQUIRED",
    },
  },
  {
    wpPostId: "demo-3",
    title: "Announcing Our New Product",
    url: "https://blog.example.com/launch",
    featuredImageUrl: "https://blog.example.com/img/launch.jpg",
    statuses: {
      LINKEDIN: "PENDING",
      X: "PENDING",
      FACEBOOK: "PENDING",
      INSTAGRAM: "PENDING",
      YOUTUBE: "MANUAL_REQUIRED",
      TIKTOK: "MANUAL_REQUIRED",
    },
  },
];

function contentFor(post: SeedPost, platform: Platform) {
  const body = `${post.title} — here's why it matters and what we learned along the way. Read the full breakdown.\n\n${post.url}`;
  return {
    platform,
    status: post.statuses[platform],
    body,
    hashtags: HASHTAGS[platform],
    link: post.url,
    charCount: body.length,
  };
}

async function main(): Promise<void> {
  // Wipe (dev only). Order respects FKs; cascades handle the rest.
  await prisma.auditLog.deleteMany();
  await prisma.publishJob.deleteMany();
  await prisma.generatedContent.deleteMany();
  await prisma.wordPressPost.deleteMany();
  await prisma.platformAccount.deleteMany();

  const now = Date.now();
  const DAY = 86_400_000;

  for (const [i, post] of POSTS.entries()) {
    await prisma.wordPressPost.create({
      data: {
        wpPostId: post.wpPostId,
        title: post.title,
        content: "The full article body would live here.",
        excerpt: "A short excerpt of the post.",
        featuredImageUrl: post.featuredImageUrl,
        url: post.url,
        categories: ["engineering"],
        tags: ["demo"],
        sourceComplete: true,
        receivedAt: new Date(now - i * DAY - 3_600_000),
        generatedAt: new Date(now - i * DAY),
        generatedContent: {
          create: PLATFORMS.map((platform) => contentFor(post, platform)),
        },
      },
    });
  }

  const token = (): string => encrypt("demo-token");
  await prisma.platformAccount.createMany({
    data: [
      {
        platform: "LINKEDIN",
        status: "CONNECTED",
        autoPublish: true,
        accessToken: token(),
        expiresAt: new Date(now + 60 * DAY),
        externalAccountId: "urn:li:person:demo",
        connectedAt: new Date(now - 5 * DAY),
      },
      {
        platform: "X",
        status: "CONNECTED",
        autoPublish: true,
        accessToken: token(),
        refreshToken: token(),
        expiresAt: new Date(now + 2 * 3_600_000),
        connectedAt: new Date(now - 5 * DAY),
      },
      {
        platform: "INSTAGRAM",
        status: "CONNECTED",
        autoPublish: false,
        accessToken: token(),
        igUserId: "17841400000000000",
        connectedAt: new Date(now - 5 * DAY),
      },
      {
        platform: "FACEBOOK",
        status: "TOKEN_EXPIRED",
        autoPublish: false,
        accessToken: token(),
        fbPageId: "998800000000000",
        expiresAt: new Date(now - DAY),
        connectedAt: new Date(now - 40 * DAY),
      },
    ],
  });

  console.log(
    `Seeded ${POSTS.length} posts + 4 platform accounts (Facebook TOKEN_EXPIRED; TikTok/YouTube left disconnected).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
