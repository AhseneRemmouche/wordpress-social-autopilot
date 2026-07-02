// Load .env before any module that reads validated env (must be first).
import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { runTick } from "@/lib/queue/worker";

/**
 * Long-lived queue worker process (plan §8, T111).
 *
 * Polls the two-pass tick (`runTick`) on a fixed interval. The loop is
 * self-healing: a thrown tick is logged (secret-free) and the next tick is
 * still scheduled. SIGINT/SIGTERM trigger a graceful drain — the in-flight tick
 * finishes, then the Prisma connection is closed.
 *
 * Alternatively, POST /api/worker/tick drains a single tick in serverless/cron
 * deployments where a long-lived process is undesirable (see the tick route).
 */

const POLL_MS = Number(process.env.WORKER_POLL_MS ?? 10_000);

let stopping = false;

async function loop(): Promise<void> {
  console.log(`[worker] started; polling every ${POLL_MS}ms`);

  while (!stopping) {
    try {
      const { generated, published } = await runTick();
      if (generated > 0 || published > 0) {
        console.log(`[worker] tick: generated=${generated} published=${published}`);
      }
    } catch (error) {
      console.error(
        "[worker] tick failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }

    if (stopping) break;
    await sleep(POLL_MS);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Don't keep the event loop alive solely for the poll delay during shutdown.
    if (typeof timer.unref === "function") timer.unref();
  });
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] ${signal} received; draining and shutting down…`);
  try {
    await prisma.$disconnect();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

loop()
  .catch((error) => {
    console.error(
      "[worker] fatal:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
