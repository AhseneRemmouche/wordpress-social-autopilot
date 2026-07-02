# syntax=docker/dockerfile:1
# Next.js 16 app (dashboard + API routes). Multi-stage; Node 22.

# ---------- Base ----------
FROM node:22-slim AS base
WORKDIR /app
# Prisma needs OpenSSL on Debian slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

# ---------- Dependencies (all, incl. dev — needed to build) ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------- Build (prisma generate + next build) ----------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client — reads the schema, not the DB (dummy URL is fine).
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    npx prisma generate
# Build-only placeholder env so eager env validation (src/lib/env.ts) cannot fail
# the build. These live in the build stage ONLY — real values are supplied at
# runtime via the container environment. None are NEXT_PUBLIC_*, so none are
# inlined into client bundles.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
    NEXTAUTH_URL="http://localhost:3000" \
    NEXTAUTH_SECRET="build-placeholder" \
    APP_BASE_URL="http://localhost:3000" \
    WEBHOOK_SECRET="build-placeholder" \
    TOKEN_ENCRYPTION_KEY="AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" \
    GITHUB_CLIENT_ID="build" \
    GITHUB_CLIENT_SECRET="build" \
    OWNER_GITHUB_LOGIN="build" \
    ANTHROPIC_API_KEY="build" \
    NOVAMIRA_MCP_URL="http://localhost" \
    NOVAMIRA_MCP_TOKEN="build" \
    WORDPRESS_SITE_URL="http://localhost" \
    LINKEDIN_CLIENT_ID="build" \
    LINKEDIN_CLIENT_SECRET="build" \
    META_APP_ID="build" \
    META_APP_SECRET="build" \
    X_CLIENT_ID="build" \
    X_CLIENT_SECRET="build" \
    TIKTOK_CLIENT_KEY="build" \
    TIKTOK_CLIENT_SECRET="build" \
    GOOGLE_CLIENT_ID="build" \
    GOOGLE_CLIENT_SECRET="build"
RUN npm run build

# ---------- Runner (built app + full deps for migrate deploy) ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000
# Reuse the build stage's node_modules: it carries the generated Prisma client,
# the Prisma CLI (for `migrate deploy`), and the TS loader for prisma.config.ts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 3000
# Runtime env (DATABASE_URL, ANTHROPIC_API_KEY, TOKEN_ENCRYPTION_KEY, WEBHOOK_SECRET,
# OAuth client ids/secrets, …) MUST be provided by the container environment.
# start.sh runs `prisma migrate deploy`, then `npm run start`.
CMD ["sh", "scripts/start.sh", "web"]
