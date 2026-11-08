# Ethereum Proof Atlas

A read-only, source-pinned map of formal claims across **Ethereum L1 and supporting
infrastructure**. Claims describe specific subjects, assumptions and limits, not
whole-project safety. The approved scope is in [docs/design.md](docs/design.md).

## Run locally

Use Node.js **24.15+ (24.x LTS)** and npm. No Cloudflare account,
credentials, database or proof-assistant installation is needed.

```sh
npm ci
npm run build
npm run preview
```

Open **http://127.0.0.1:4173**. This runs the packaged Worker and browser assets
in Cloudflare's local workerd runtime, with the production-build application
headers (including CSP). This checks the application policy locally, not an
undeployed production environment or Cloudflare's platform-level controls.
Stop with Ctrl-C. Initial dependency/browser installation requires network access;
the running application does not retrieve third-party proof sources.

For development with HMR, run `npm run dev` and open **http://127.0.0.1:5173**.
The development server is not the production security test target.

## Verify

```sh
npx playwright install chromium
npm run verify
```

After verification, run `npm run preview` to inspect the verified build interactively.

On a supported Linux distribution, missing browser system libraries can be
installed with `npx playwright install --with-deps chromium` (may require sudo).

| Command | Checks |
| --- | --- |
| `npm run data:validate` | Schema, canonical SHA-256 revision, source identities, cross-references and update review receipts |
| `npm run proofs:check` | Read-only comparison of the three tracked upstream `main` heads |
| `npm test` | Domain, HTTP boundary, API-response and React component behavior |
| `npm run test:coverage` | At least 80% statements, branches, functions and lines |
| `npm run build` | Type checking and mandatory dataset validation, then Vite/Cloudflare packaging |
| `npm run test:e2e` | Built Worker + browser navigation, read-only interactions, production CSP and raw HTTP requests |
| `npm run verify` | All of the above in dependency order |

Build before running E2E alone. E2E starts and stops its own local server on port
4173; leave that port free. Tests use Chromium. Synthetic records exist only in
tests. These commands test the atlas, **not external proof replay**.

## Deploy

The deploy target is **Cloudflare Workers** (see [docs/design.md](docs/design.md)).
A Cloudflare login is required once with `npx wrangler login`; no database or other
resource provisioning is needed.

```sh
npm run deploy
```

This runs the full acceptance gate (`npm run verify`) and then packages and
uploads the passed build as one Worker release (the validated bundle ships
inside the same release). If verification fails, nothing is uploaded.
Automated deployment from CI additionally requires the repository secrets
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` and is triggered manually
from the `Deploy` workflow.

## Read the map

- **Beacon Spec**: mainnet Fulu / Osaka (Fusaka, BPO2), checked
  2026-11-06; inherited specification definitions remain explicit.
- **Lean Spec**: an independent, pinned Lstar experiment, not a promised
  deployment. Unsupported future execution/compiler connections are omitted.
- Select a node, then a claim in the adjacent panel. Expand state transition for
  checkpoint detail. Use Tab/Enter, the component selector and viewport controls
  for keyboard navigation; arrow keys switch tabs.
- Dependency arrows point from provider to consumer. Dashed lines are interface
  interactions; dotted lines are generated code. Relationships have source links.
- “0 claims” is not “unsafe.” Counts deduplicate claims within a view.
  Source availability, correspondence review and replay are separate observations.

The initial bundle contains three individually scoped claims from gasper-lean4,
formal-leanSpec and ArkLib. [Research notes](docs/research.md) record intake
evidence and candidate decisions. None has been replayed by the atlas.

## Data and API

`data/atlas.json` is packaged with the Worker. There is no editing API or mutable
runtime store. The build rejects invalid bundles even when `vite build` is called
directly. Source text is escaped and URLs must be pinned, credential-free HTTPS.

`GET /api/atlas` returns the complete bundle and a validated selection envelope.
Optional selectors are `view`, `component` (a view-local instance ID), and
`claim`. A component or claim requires a view; selections must be associated
in that view. For example:

```text
/api/atlas?view=beacon&component=b-state&claim=ffg-structural-safety
```

Only GET/HEAD are accepted. Duplicate/unknown/malformed selectors return 400,
unknown or inapplicable records 404, queries over 2,048 encoded bytes 414, and
other methods 405 with `Allow: GET, HEAD`. Bodies are rejected without parsing.
Responses are same-origin only; evidence links are ordinary external navigation.

## Upstream proof updates

GitHub Actions checks the three catalogued proof repositories' `main` branches
hourly and can be run manually. A changed head produces a pinned, unpublished
candidate in a draft PR. Open PRs and human edits are never overwritten.

A curator inspects and edits the candidate, records the review with
`npm run proofs:accept`, commits the resulting bundle and receipt, then obtains
review and merges. Old checks are not inherited by new commits. Pending updates
fail the package gate. See [the review procedure](docs/proof-updates.md) for exact
commands, permissions and recovery steps. The schedule starts after the workflow
is merged into the default branch; merging data does not deploy a site.

See [implementation notes](docs/implementation.md) for module boundaries,
data invariants, local-runtime caveats and the acceptance matrix. Accounts,
general submissions, new-claim discovery, external proof replay, production
deployment and release operations remain outside this implementation.
