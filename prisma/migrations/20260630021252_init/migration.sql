-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'X', 'TIKTOK', 'YOUTUBE');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'FAILED', 'MANUAL_REQUIRED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('CONNECTED', 'TOKEN_EXPIRED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('ATTEMPT', 'SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "WordPressPost" (
    "id" TEXT NOT NULL,
    "wpPostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "featuredImageUrl" TEXT,
    "url" TEXT NOT NULL,
    "categories" TEXT[],
    "tags" TEXT[],
    "sourceComplete" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" TIMESTAMP(3),

    CONSTRAINT "WordPressPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedContent" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "body" TEXT NOT NULL,
    "hashtags" TEXT[],
    "link" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "status" "ContentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishJob" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAccount" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "externalAccountId" TEXT,
    "fbPageId" TEXT,
    "igUserId" TEXT,
    "metadata" JSONB,
    "connectedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "outcome" "AuditOutcome" NOT NULL,
    "externalId" TEXT,
    "errorContext" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WordPressPost_wpPostId_key" ON "WordPressPost"("wpPostId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedContent_postId_platform_key" ON "GeneratedContent"("postId", "platform");

-- CreateIndex
CREATE INDEX "PublishJob_status_nextRunAt_idx" ON "PublishJob"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAccount_platform_key" ON "PlatformAccount"("platform");

-- CreateIndex
CREATE INDEX "AuditLog_contentId_idx" ON "AuditLog"("contentId");

-- AddForeignKey
ALTER TABLE "GeneratedContent" ADD CONSTRAINT "GeneratedContent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WordPressPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishJob" ADD CONSTRAINT "PublishJob_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "GeneratedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
