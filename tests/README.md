# Tests

Vitest test suite. Configuration: `vitest.config.ts` (test root is this directory).

- `tests/unit/` — unit tests (Zod schemas, crypto, limits, backoff, publishers with
  mocked `fetch`, Claude generation with mocked responses, …).
- `tests/integration/` — integration tests (webhook receiver, OAuth callback, dashboard
  APIs, end-to-end pipeline).

Run:

```bash
npm test         # vitest run (single pass)
npm run test:watch
```

Tests import APIs explicitly (no Vitest globals):

```ts
import { describe, it, expect, vi } from "vitest";
```

Use the `@/*` alias to import app code, e.g. `import { encrypt } from "@/lib/crypto";`.
