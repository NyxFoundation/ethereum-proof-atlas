---
title: Implementation and local acceptance
last_updated: 2026-11-06
tags:
  - implementation
  - testing
  - security
---

# Implementation and local acceptance

The local application implements the contract in [design.md](design.md).
Use the root README for runnable setup and verification commands.

## Boundaries

| Location | Responsibility |
| --- | --- |
| `data/atlas.json` | Inspected, revision-pinned release bundle; never synthetic public entries |
| `src/domain/schema.ts` | Strict Zod contract, bounded geometry and safe source URLs |
| `src/domain/validate.ts` | Cross-references, snapshot applicability, evidence/check scope and RFC 8785 digest |
| `src/domain/selectors.ts` | Shared claim lists/counts, source availability and graph expansion |
| `src/server/` | Hono read-only HTTP boundary, headers and structured failure logging |
| `src/intake/`, `scripts/proof-updates.ts` | Bounded GitHub source reads, unpublished proposals, explicit review acceptance and package gates |
| `.github/workflows/` | Hourly draft update proposals and application/review verification |
| `src/ui/` | Same-origin API validation, fixed-position React Flow map and evidence panel |
| `vite.config.ts` | Mandatory validation before development/build/packaging via the Cloudflare plugin |
| `tests/`, `e2e/` | Synthetic edge cases and production-build browser/Worker integration |

The complete bundle is served in an envelope with `schemaVersion`,
`datasetRevision` and the validated `selection`. Selectors do not remove evidence
or produce partial bundles. The browser validates the envelope, cross-references
and digest before rendering and requires the build's exact dataset revision.
A stale browser gets an explicit reload error, not a different snapshot fallback.
The digest detects inconsistency, not a compromised publisher.

IDs are unique within collections; instance IDs and claim-binding pairs are
view-local. Components and expansion hierarchies must be acyclic. Direct bindings
match every subject artifact identity. Related-model bindings name their
cross-reference or dated manual-comparison basis and both sets of subjects.
Availability is scoped to artifact locations; review/replay is scoped to evidence,
subjects and configuration. An older successful intake observation is retained
if a later availability check fails.

This implementation supports GitHub commit identities and SHA-256-addressed
locations. Neither a moving branch nor a release label is an artifact revision.
The validator recomputes, but never silently rewrites, `datasetRevision`.
The [scoped update workflow](proof-updates.md) follows the three catalogued proof
repositories' `main` branches without changing the runtime's immutable-bundle
contract. General authoring and new-claim discovery remain deferred.

## Runtime and security

`npm run build` uses Vite and `@cloudflare/vite-plugin` to emit browser assets
and `dist/ethereum_proof_atlas/wrangler.json`. `npm run preview` passes that
generated configuration to `wrangler dev --local`, so the browser and Hono run
together against the production bundle in workerd. No custom Node server adapter
is used.

The Vite plugin's preview HTTP adapter drops GET bodies while translating Node
requests. The direct Wrangler preview is therefore the acceptance target for
body rejection as well as browser navigation. Development HMR is smoke-tested
separately; it is not a substitute for production-build tests.

The Worker runs before assets and applies the same production CSP and no-referrer
policy to asset responses and API responses. Only renderer-generated style
attributes receive an inline-style exception; inline scripts/stylesheets, eval,
foreign data fetches, frames and objects are blocked. Zod is configured
`jitless` so validation never attempts `new Function`. The development-only
policy permits Vite HMR and is compiled out of the production Worker.

Method rejection occurs before reading any body. Query length is checked before
URLSearchParams parsing; decoded IDs are then bounded and validated. There are
no batch, body-query, arbitrary-query, source-proxy or proof-execution endpoints.
Controlled failures log only event code, generated request ID, route category and
status as JSON; public errors never include the thrown value.

## Acceptance matrix

| Requirement | Executable evidence |
| --- | --- |
| Independent tabs, topology, applicability; no inherited claim/check leakage | Domain selectors, React lifecycle tests, Workers browser journey |
| Selection, expansion, claim navigation, keyboard tab/viewport controls | React interaction tests and browser keyboard journey |
| No node dragging, deletion or reconnection | Controlled graph with connect/reconnect disabled; browser geometry invariance |
| Subject types, revisions, unknown audit, assumptions, limits | Claim panel component tests and source-linked browser journey |
| Distinct counts despite multiple supporting artifacts | Domain test adds a second evidence record without increasing counts |
| Bounded scope/configuration and replay result semantics | Synthetic bounded model-checking / timeout component fixture |
| Empty components are neutral | Component tests and XMSS browser journey |
| Dangling IDs, cycles, wrong revisions and unsafe URLs rejected | Domain mutation suite; build invokes the same validator |
| Incompatible schema, tampering and mixed releases refused | API response suite and already-open-browser version-change test |
| Method, body, selector and encoded-size limits | Hono suite, raw GET-body test against workerd |
| Production CSP permits rendering but blocks active content | Browser policy-violation tests for scripts, styles, fetch, framing and objects |
| Historic source details survive external outage | Availability mutation test, panel fixture, failed external-navigation browser test |
| English text, escaped imported content | ASCII English data contract, English UI tests, script-text escaping fixture |
| Worker, assets, UI and source navigation exercised together | Playwright uses the packaged local Worker, not a mock API server |

`npm run test:coverage` enforces 80% across statements, branches, functions and
lines. Only the two import/mount entrypoints are excluded; domain, server and UI
logic remain in the coverage denominator. Browser tests also exercise those
entrypoints. Application tests neither execute Lean nor assert the external
proofs' transitive assumptions are fully audited.

Local acceptance on 2026-11-06 used Node 24.21.0, a fresh `npm ci`, and
`npm run verify`: 96 unit/component/package-gate cases and 7 workerd browser
cases passed. Coverage was 100% lines, 99.12% statements, 96.64% branches and
98.34% functions. `npm audit` reported no known vulnerabilities. These results
are observations of this application revision, not guarantees of future runs.

## Automated update acceptance

The updater captures one upstream head per candidate and fetches only fixed-commit
source paths. A proposal is separate from the published bundle until explicit
curator acceptance. Its baseline fingerprint covers only the affected records,
so unrelated repository updates can be accepted independently. Old checks are
removed rather than implicitly rebound to a new artifact revision. Availability
observations come from source GETs; new correspondence and manual-comparison
records come from the curator's explicit review command. No replay is recorded.

`src/intake/files.ts` is shared by the data command and direct Vite configuration.
It rejects pending or mismatched receipts before packaging. Acceptance writes
its receipt before the bundle; an interrupted write can be completed by repeating
the same command. A shared `proper-lockfile` lease serializes local intake writes;
changed datasets or proposals are rejected before writing. Bounded file reads do
not depend on a separate size observation.

Tests cover unchanged heads, source outages and relocation, byte observations,
credential separation, response bounds, stale proposals, independent acceptance,
old-check invalidation, repeated/interrupted acceptance, storage failure cleanup,
response-reader cleanup and PR deduplication.
A subprocess test drives the actual CLI against a local HTTP source fixture,
then reads the accepted release through Hono. This fixture is not a public proof.
The build-gate suite also rejects a pending candidate through a direct Vite build.
Local verification of the update implementation on 2026-11-06 passed all 159
unit/component/package/CLI cases and 7 workerd browser cases after a fresh
`npm ci --ignore-scripts`. Coverage was 99.83% lines, 98.98% statements, 96.04%
branches and 98.65% functions; `actionlint` passed. Hosted scheduling and remote
PR publication activate only after the workflows reach the default branch.
Live read-only checks on the same date found all three tracked `main` heads equal to
the published revisions; no synthetic update was proposed to GitHub.

The initial implementation was also rendered at desktop and narrow viewport
sizes and smoke-tested through the Vite development server. Runtime startup,
source intake and application tests do not constitute production deployment.
