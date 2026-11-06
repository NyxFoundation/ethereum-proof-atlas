# Repository guidance

- Purpose: a verifiable map of formal proofs across the Ethereum ecosystem.
- Read `docs/design.md` before implementation; it records the approved scope, architecture views, evidence boundaries, data model, and technology choices.
- Runtime: React/React Flow on Vite, Hono on Cloudflare Workers. Keep domain validation, graph presentation and HTTP delivery separate.
- Commands: `npm ci`, `npm run dev`; production-like local verification: `npm run verify` (install Chromium first), then `npm run preview`. See README.md for prerequisites.
- `data/atlas.json` is a packaged, immutable bundle. Never replace inspected sources with synthetic public entries, infer proof composition from edges, or claim external proof replay from application tests.
- Source research and acceptance evidence are recorded in `docs/research.md` and `docs/implementation.md`.
