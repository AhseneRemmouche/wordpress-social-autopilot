import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer auto-loads `.env` — `dotenv/config` above loads it so that
// `env("DATABASE_URL")` resolves for the CLI (migrate/generate/studio).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
