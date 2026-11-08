---
title: Ethereum Proof Atlas Design
last_updated: 2026-11-08
tags:
  - architecture
  - formal-verification
  - product-design
---

# Ethereum Proof Atlas Design

## Status and purpose

This document records the agreed product and technical design. The local
implementation now follows this contract; actual project commands and verification
procedures are documented in the repository README and implementation notes.

The atlas helps developers and auditors determine **what has been proved, about
which subject, under which assumptions, and with which limitations**. It overlays
catalogued claims on Ethereum's architecture rather than presenting a project
directory or certifying whole projects as safe.

The primary information unit is a claim about a particular subject and property,
not a project, paper, or repository.

## Scope

Include:

- Ethereum L1 consensus and execution.
- Supporting infrastructure: cryptography, proof systems, networking,
  serialization, and state data structures.
- Language and compiler infrastructure, including solc-related work.
- Public formal-verification artifacts using theorem proving, SMT-based
  verification, or model checking.

Exclude:

- L2 architectures and L2-specific protocol claims.
- Application protocols such as Uniswap, and their application-specific contracts.
- Ordinary tests, fuzzing results, or marketing claims presented as proofs.
- A formal specification or executable model presented as a proof merely because
  it exists.
- Generation of a ZK execution proof presented as formal verification of the
  prover, verifier, or underlying protocol.

Shared cryptographic research remains eligible even if it is also useful to L2.
ArkLib is included on that basis, not as an exception admitting L2 protocols.

Publication requires an accessible verification artifact, such as proof code,
verification inputs, or a model-checking model. A paper or claim of verification
alone does not qualify. Atlas-side replay is a separate observation, not a
prerequisite already promised for every entry. Incomplete proof attempts must not
be presented as established claims.

## Architecture views

Provide three tabs with these exact English labels:

- **Beacon Spec**
- **Lean Spec**
- **Execution Spec**

Do not show a scope caption beside the tabs. The consensus tabs identify the
consensus design family; the Execution tab identifies the execution design
family. No tab borrows another tab's snapshot: consensus views carry no
execution, compiler, or execution-networking instances, and the Execution view
carries none of the consensus instances.

Each tab selects an independently sourced architecture view, including its
components, relationships, and applicable claims. This is not a label change or
a filter over one assumed common specification.

### Specification identity

- A view identifies its source repository snapshots and relevant fork.
- The Beacon view represents the selected active mainnet specification, not
  whatever happens to be on the upstream default branch. Confirm the active fork
  when assembling the initial dataset.
- Beacon upgrades are incremental: account for inherited definitions as well as
  the selected upgrade's changes.
- The Lean view identifies a fixed leanSpec revision and its experimental status.
  "Future" does not mean a finalized commitment to deploy that specification.
- Evidence links resolve to fixed commits or other content-addressed artifacts.
  A moving branch name or release label alone is not a reproducible identity.
- Displayed revisions are links, not bare text: a git-commit revision opens
  the repository state at that commit; a sha256 digest stays plain text
  because it addresses artifact content, not a repository state. The bundle
  digest is not a location and is never rendered as a link.
- Protocol, implementation, formal-model, and proof-artifact versions are
  separate identities.

No single repository is a sufficient source for an entire architecture view.
Execution and compiler components need their own primary sources and, per the
recorded split, live in their own tab. The Engine API payload boundary between
execution and consensus is therefore not drawn as a cross-layer component;
each tab shows where its record ends. Do not invent execution-layer
connections in a consensus view, and do not copy consensus-side connections
into the Execution view. The consensus views keep the blob availability
checks that the consensus spec itself performs, without introducing execution
components for them.

### Structure and placement

Use a layered dependency diagram, not category cards or a dashboard. Place
cryptographic and P2P foundations toward the bottom and their consumers above
them. This is not a universal vertical chain: parallel subsystems and cross-layer
relationships must remain visible.

- Default nodes represent algorithms or functional components, such as fork
  choice, state transition, BLS, SSZ, and Gossipsub.
- Expand selected areas to inspect finer structure instead of initially showing
  every specification function or theorem.
- Preserve the positions of corresponding roles across tabs where practical.
  Similar positions or names do not establish semantic equivalence.
- Store deliberate overview positions with each view. Do not make the initial
  experience depend on a continuously moving force-directed layout.
- Distinguish consensus-side and execution-side networking where their protocols
  differ; do not draw a fictitious single P2P implementation.
- Keep compilers as development infrastructure with a generated-code relationship
  to their target. Do not imply that an execution client invokes solc to execute
  bytecode.

An architecture edge must identify its kind and its source evidence. Dependency,
interface interaction, and generated-code relationships must have different
labels or line treatments. For dependency arrows, the direction is from the
provider to the consumer; other kinds need their own legend.

A library import graph is not automatically an Ethereum architecture graph.
Likewise, an architecture dependency does not establish proof composition or
propagate a guarantee to a consumer.

## Reading experience

### Visual direction

- All displayed text is English: tabs, labels, legends, summaries, assumptions,
  limitations, tooltips, errors, and accessibility announcements.
- Use a light background, dark text, restrained area accents, and clear connection
  lines. The diagram, rather than decorative UI cards, is the visual focus.
- Do not use traffic-light colors to imply that a component is safe or fully
  verified. Selection styling and area colors must not resemble certification.
- Color cannot be the only way to convey a distinction.

### Map and detail panel

1. Open the selected architecture view, with its fork and source revision visible.
2. Pan or zoom the map and expand a component when more detail is needed.
3. Select a component to open its associated claim list in a right-hand panel.
4. Select a claim to read its subject, property, assumptions, limits, evidence,
   and recorded checks without losing the map context.
5. Follow a source link to the specific theorem, verification model, or source
   location at the recorded revision.

Nodes can carry a neutral label such as **Claims: 3**, or **0 claims** when none
are catalogued. The count is the number of distinct catalogued claims explicitly
associated with that component in that view. Multiple artifacts supporting one claim do not increase its count. A claim
associated with multiple components is still one claim, not multiple proofs.

The count is neither a coverage percentage nor a safety ranking. Zero means
**No catalogued claims**, not "Unproved" or "Unsafe". There is no whole-map
"percentage proved".

The map is read-only. Selection, keyboard focus, expansion, and navigation remain
available, but dragging nodes into new positions, connecting edges, and deleting
graph elements are not reader actions.

The footer lists every distinct repository of the loaded bundle's formal-model
and proof artifacts as plain discovery links (new tab, no referrer), labelled
with the repository path; the section is titled "Formal-verification
repositories" and excludes the architecture snapshot repositories. They are
not pinned evidence links and never satisfy a claim's source
requirement.

### Index table

Each view tab also provides a **Map / Index** display-mode toggle so the same
snapshot can be read as an inventory. Index renders the selected view as a
table whose purpose is exposing where the catalogue is empty; it is not a
second map, a dashboard, or a coverage report.

- Modes share one selection state and the right-hand details panel. Selecting a
cell selects that component instance in both presentations; zero-claim cells
are selectable and open the neutral "No catalogued claims" panel state.
- Rows are the catalogued groups present in the selected view, always in the
fixed order: Consensus, Execution, Cryptography, Serialization, Development.
A group with no instance in the view renders no row instead of an empty row.
A component instance appears in the row of its `component.area`; networking
instances resolve their side from the recorded architecture edges of that
instance in the selected view, so consensus-side and execution-side
networking never share one cell.
- The table is independent of the map's deliberate geometry: no column is a
layer. Each group row packs its components one per cell, left to right, in
foundations-first reading order; empty positions occur only to the right of
a row that has fewer components than the widest row. No cell holds more than
one component.
- Every populated cell shows the component, its exact catalogued-claim count
(for example `Claims: 2` or `0 claims`) and a neutral fill tint banded over
that count. The exact count is always visible: color is never the only
channel, and bands are restrained tints, not traffic-light colors, and do
not resemble certification or safety ordering. A zero cell means **No
catalogued claims**, not "Unproved" or "Unsafe". The table shows no
percentages, no "proved" wording, and no per-column or whole-table rollup;
only the count-band legend explains the fill. The legend replaces the
relationship legend while Index is shown.
- Counts derive from the same view-specific
`componentInstances` and `claimBindings` as the map; the table keeps no
separate inventory dataset.
- The map-bar carries only the display-mode toggle and the active legend;
  components are reached directly in the map (keyboard-operable nodes) and in
  the index (cells). There is no global component select control.
### Evidence presentation

A claim's subject type must be visible before a reader opens its source:

- Specification.
- Formal model.
- Implementation.

For example, a Casper FFG model theorem must not look like a theorem about a
current production client's binary. A theorem about a verification tool is not
automatically a theorem about every program analyzed by that tool.

Display the method and its scope. In particular, bounded exploration must show
its bounds, abstractions, and relevant configuration rather than implying an
unbounded result. A timeout or unsuccessful verification attempt is not evidence
that the property is false.

Distinguish these observations instead of using one "Verified" flag:

- Public artifact located.
- Claim and source correspondence reviewed.
- Verification replay attempted, with its result and exact scope.

Unrecorded checks remain unknown or not performed. Unknown assumptions or
unreviewed dependencies must not be rendered as "None". A successful replay does
not remove the assumptions of the statement or certify production deployment.

### Source availability

External link availability is an observation, not a permanent property of a
commit-pinned reference. An availability check records its date and outcome in a
`CheckRecord`, independently of source review or proof replay.

- Show **Available when last checked**, **Unavailable when last checked**, or
  **Not checked**, with the observation date when one exists. These labels do not
  promise current reachability.
- If a previously published source becomes unavailable, preserve the claim,
  artifact identity, commit or digest, and source location. Display the recorded
  availability warning; do not silently substitute a moving branch or treat the
  claim as refuted.
- Publication still requires an accessible artifact at intake. The supplied
  dataset must include a dated availability observation from the actual source
  inspection for each supporting proof artifact; do not synthesize a successful
  check from the mere presence of a URL. Keeping a historic record after loss of
  access is not permission to publish paper-only claims.
- The browser and Worker do not perform live third-party availability probes in
  this scope. An external host may return an error when a reader follows a link;
  the atlas itself must still render the stored record without fetching that page.

The browser and Worker consume these supplied observations; they do not produce
them. The release-side [proof update workflow](proof-updates.md) records source
GET observations when proposing or accepting updates to the three catalogued
proofs. It does not periodically probe unchanged source links or generate human
review results. Curator ownership remains an operational responsibility.

## Data model

Stable identifiers connect the following entities. References must resolve, and
recorded versions must remain explicit. The enclosing `AtlasBundle` identifies
its `schemaVersion` and `datasetRevision`; these are distinct from the protocol
forks and artifact revisions inside it.

| Entity | Responsibility |
| --- | --- |
| `AtlasBundle` | The envelope containing schema/revision metadata and the complete entity collections for both architecture views. |
| `Component` | A technical concept shown on the map, with its classification and finer components where applicable. |
| `Artifact` | A versioned specification, model, implementation, or proof artifact; public location, immutable revision or digest, and relevant source locations. |
| `Claim` | A coherent property about one or more subject artifacts; assumptions, applicability, and limits. View associations live in `ArchitectureView.claimBindings`, not on the claim. |
| `Evidence` | The artifact and exact theorem or verification location supporting a claim; method, configuration, and bounds where relevant. |
| `CheckRecord` | A scoped availability, source-review, or replay observation; exact artifact/subject/evidence references as applicable, date, result, and supporting details. |
| `ArchitectureView` | A specification snapshot with `componentInstances`, their positions, and a `claimBindings` collection associating claims to those instances. |
| `ArchitectureEdge` | A relationship identified by `viewId` and source/target component-instance IDs, with a kind and a supporting primary-source location. |

### Bundle envelope

`AtlasBundle` has these required fields:

- `schemaVersion`: a positive integer identifying the supported data contract.
- `datasetRevision`: the lowercase hexadecimal SHA-256 digest of the complete
  bundle serialized using [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785), with
  only the `datasetRevision` field omitted. The package validator computes and
  checks it; it is not a signature or a defense against a compromised publisher.
- The arrays `components`, `artifacts`, `claims`, `evidence`, `checkRecords`,
  `architectureViews`, and `architectureEdges`. Empty collections are explicit,
  not missing fields. The bundle contains both tab views.

All IDs are unique within their entity collection. Nested component-instance IDs
are unique within their owning view. Edge `viewId` values and all references must
resolve in this bundle. The digest reflects canonicalized JSON content, including
array order; it is not a semantic-equivalence hash.

### View-specific associations

`ArchitectureView` owns the bindings. Each entry in `componentInstances` has a
view-local `instanceId`, a `componentId`, versioned subject-artifact references,
and a position. Edges address these instance IDs within their owning view.

Each nested `claimBindings` entry contains:

- `componentInstanceId` and `claimId`, unique as a pair within the view.
- `applicabilityKind`: `direct-subject` or `related-model`.
- An English applicability explanation and supporting primary-source references,
  each identifying an artifact and a location within its recorded revision.

The owning view supplies the binding's scope; there is no unqualified global
component-to-claim association to use as a fallback. Direct-subject bindings
require version-matched subjects. Related-model bindings expose that distinction
in the claim list as well as in the details panel.

### Integrity rules

- A claim can concern multiple artifacts, for example a compiler model and source
  and target semantics. Do not force every theorem into a single-repository model.
- One evidence artifact can support multiple claims, and one claim can have
  multiple evidence records. Keep the claim-to-location correspondence explicit.
- Resolve claim lists only through the selected view's `claimBindings`. Shared
  component IDs or similar names do not make a claim applicable to both tabs.
- A related abstract-model result can be associated with a component only with
  an explicit applicability explanation. It must remain visibly distinct from a
  direct implementation claim.
- A `related-model` association may be supported by an explicit source
  cross-reference or a dated manual-comparison `CheckRecord`. The binding must
  identify which basis it uses and cite the relevant artifact revisions and
  locations; neither basis establishes implementation correctness.
- A claim of formal equivalence or refinement between a model and an
  implementation requires a separate `Claim` with machine-checkable `Evidence`,
  its direction, subjects, and assumptions. A description that a model "mirrors"
  code is not such a proof, and must not propagate guarantees to the implementation.
- Do not infer that a selected protocol uses an algorithm just because that
  algorithm appears in an eligible library. Omit unsupported associations.
- Scope check records to the recorded artifacts and configuration. Do not carry a
  replay result forward to a new revision automatically.
- Distinguish unknown information from an explicit, evidenced absence.
- Node counts, claim lists, and source details must derive from the same
  view-specific associations.

Source and topology validation should reject dangling IDs, cross-view edges,
ambiguous snapshot references, and evidence records without a resolvable claim
and artifact. Do not silently fall back to another view or a newer source version.

## Initial research corpus

These five projects are approved **research candidates**, not five already
approved proof entries or blanket verification endorsements.

| Project | Initial area to investigate |
| --- | --- |
| [gasper-lean4](https://github.com/NyxFoundation/gasper-lean4) | Casper FFG model properties, including accountable safety. |
| [formal-leanSpec](https://github.com/NyxFoundation/formal-leanSpec) | Properties of Lean models related to leanSpec consensus and its foundations. |
| [ArkLib](https://github.com/Verified-zkEVM/ArkLib) | Cryptographic proof systems, reductions, commitments, and their security properties. |
| [EthLib](https://github.com/ethereum/EthLib) | Shared primitives across cryptography, serialization, networking, execution, and consensus. |
| [Etheorem](https://github.com/etheorem/etheorem) | Lean implementations of Beacon consensus specifications and any individually evidenced claims about them. |

FORVES was explicitly removed from the initial candidate list.

Choose individual claims only after identifying the relevant artifacts, subjects,
assumptions, and specification relationships. Candidate membership does not
guarantee an entry in both views, or even an immediately publishable claim.
Do not count a Lean implementation or passing consensus test vectors as a proof
of its correctness.

During design research, source-level proof examples were inspected in
[gasper-lean4's accountable-safety development](https://github.com/NyxFoundation/gasper-lean4/blob/7650709170327c5f10c8b5da99b10941e208ef5d/GasperBeaconChain/Core/Theories/AccountableSafety.lean)
and
[formal-leanSpec's checkpoint-forward development](https://github.com/NyxFoundation/formal-leanSpec/blob/ba7284513031eac5c66bfb8221d27b6154cf240b/LeanSpec/Forks/Lstar/CheckpointForward.lean).
The latter excludes a genesis case and concerns a Lean state-transition model.
These inspections were not proof replays or complete transitive-assumption
audits. Exact applicability to the selected architecture snapshots still needs
to be established. No candidate is certified by this design document.

## Technical architecture

| Concern | Selected technology |
| --- | --- |
| HTTP routing and read-only data delivery | Hono |
| Hosting/runtime | Cloudflare Workers |
| Browser UI | React and TypeScript |
| Development and bundling | Vite with `@cloudflare/vite-plugin` |
| Diagram rendering and interaction | React Flow, `@xyflow/react` |
| Data and request-boundary validation | Zod |
| Unit and component tests | Vitest |
| Browser integration tests | Playwright |

### Boundaries

- Hono owns HTTP request handling on Workers; React owns the browser interface.
  Use the documented Cloudflare/Vite integration rather than building a custom
  server adapter.
- React Flow provides rendering, selection, pan/zoom, and keyboard interaction.
  Domain semantics, applicability, and counts belong to the atlas data model,
  not React Flow node or edge styles.
- Use the MIT-licensed React Flow core. Do not assume paid example code is part
  of the dependency. Automatic layout is not part of its core and is not required
  for the deliberately positioned overview.
- Keep graph presentation, domain validation, and HTTP delivery separate so the
  same validated data drives the map and panel.
- Package the versioned read-only data bundle with the Worker release, not in a
  separately mutable runtime data store. Validate its schema and cross-references
  during the application build/package step; invalid data must fail that step.
  This gate does not prescribe how records are authored or updated.
- Hono serves the validated bundle without repeating whole-dataset validation on
  each request. Validate request selections and identifiers at the HTTP boundary.
  If the bundle cannot be loaded, return a generic unavailable response rather
  than serving partial data or falling back to a different snapshot.
- Server and browser accept only their explicitly supported `schemaVersion`.
  Validate API response metadata and structure in the browser before rendering;
  an incompatible version produces an explicit English error, not a compatibility
  fallback. Deploy the application code and its bundle as one release. Dataset
  revision identifiers support consistency checks, not authenticity against a
  compromised build or deployment pipeline.
- Treat source text as untrusted data and render it as escaped text. Outbound
  evidence URLs must be absolute `https:` URLs with a hostname and no username or
  password. Deny every other scheme; successful URL parsing alone is not enough.
- Do not fetch arbitrary user-supplied source URLs from the Worker or execute
  proof artifacts in the application.
- User-visible application errors must not expose stack traces, local paths, or
  other server internals.

There is no account system, editing API, database requirement, general crawler,
or server-side proof-execution service. A separate release-side updater tracks
`main` for the three catalogued proof repositories and opens draft candidate PRs.
A curator must inspect the proposed sources and record a fresh review before
publishing the updated bundle. It never transfers old checks to a new revision,
executes upstream proof code, modifies architecture snapshots, or overwrites an
open PR. See [the update contract and procedure](proof-updates.md).
General record authoring and submissions remain deferred.

### Read-only HTTP and browser boundary

These are application contracts, not a new record-update or hosting service:

- Production atlas routes accept only GET and HEAD. Reject other methods with
  405 and an `Allow: GET, HEAD` header before consuming a request body. Do not
  accept body-bearing data queries or batch arrays of identifiers.
- Data requests allow at most the three selectors `view`, `component`, and
  `claim`, each appearing once. Bound the encoded query to 2,048 bytes before
  parsing it. Each selector is at most 128 ASCII letters, digits, or characters
  from `-._~`, and must identify a known record. Reject duplicate or unknown
  parameters and malformed values with 400, overlong queries with 414, and unknown
  record selections with 404. There is no arbitrary query language in this scope.
- The browser fetches atlas data and application assets only from its own origin.
  Evidence links are ordinary external navigation, not embedded documents or
  browser-side proof-source fetches. Do not enable permissive cross-origin API
  access; CORS is not an authentication mechanism.
- Apply a production CSP with `default-src 'self'`, `script-src 'self'`,
  `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`,
  `frame-ancestors 'none'`, and `form-action 'none'`. Use `style-src 'self'` and
  `style-src-elem 'self'` for stylesheets. React Flow's positioning requires a
  narrowly scoped `style-src-attr 'unsafe-inline'` exception for renderer-created
  style attributes, not inline stylesheet blocks. Records cannot supply CSS,
  HTML, class names, or style URLs; geometry must be bounded, finite numeric data.
  This exception is not permission for inline scripts or `eval`. Exercise the
  policy against the production browser build. Development HMR exceptions must
  not weaken production headers.
- Send `Referrer-Policy: no-referrer`. External links opened in a new tab use
  `rel="noopener noreferrer"`. Never interpret a source URL's fragment or query
  as application code, or follow redirects in a server-side source-fetch service.
- Use a structured application logger for controlled failures, recording an event
  code, request ID, route category, and status. Do not log secrets, request bodies,
  raw query strings, or imported source text. Logs are separate from public error
  messages; the production monitoring destination is deferred.

## Verification and acceptance

The implementation tests behavior, not just schema shapes or type
checking. Target at least 80% application code coverage and cover these flows:

- Switching tabs changes the snapshot, relationships, and applicable claims
  without leaking a claim or check result from the other view; the Execution
  snapshot renders its own map and an index table whose populated cells are
  execution- and development-only with zero catalogued claims.
- Component selection, expansion, pan/zoom, and claim detail navigation work
  together and remain usable by keyboard.
- Read-only interactions cannot move, delete, or reconnect components.
- The details panel shows subject type, revisions, assumptions, limits, evidence,
  and check state without converting unknowns into guarantees.
- Counts deduplicate claims; multiple evidence records do not inflate them.
- Bounded results and unbounded theorems cannot be confused in the display.
- Components with no records say "0 claims", not "Unproved".
- The Map / Index toggle reuses the same selection state and details panel;
  switching tabs keeps the mode while isolating claim lists per view; Index
  cells render exact counts with tint bands, zero cells read "No catalogued
  claims", the legend explains bands, and the layout introduces no page-level
  horizontal scrolling at supported widths.
- Invalid dataset references and unsafe evidence links fail build-time validation;
  invalid request selections fail at the HTTP boundary without fallback data.
- Unsupported bundle schema versions fail before rendering, including when a
  previously opened browser encounters a newer server release.
- Unsupported HTTP methods, oversized selectors, repeated parameters, and request
  bodies are rejected without unbounded parsing or data mutation.
- The production CSP permits normal diagram operation while blocking inline
  scripts, foreign-origin data fetches, framing, and object embedding.
- Stored source records remain readable when an external link is unavailable,
  and their availability state does not imply a replay result or current liveness.
- Dataset copy and all UI states, including accessibility text and errors, are
  English.
- Worker HTTP handling, browser delivery, and graph-to-evidence navigation are
  exercised together in the Cloudflare-compatible local runtime, not only
  type-checked or tested against a different server adapter.

Use synthetic records only as test fixtures, never as apparent public proof
entries. Testing the atlas application is distinct from replaying the external
proof corpus.

The repository README documents the implemented test, build, development and
production-like local preview commands. `npm run verify` runs the acceptance gate.

## Deferred decisions and remaining research

Explicitly deferred:

- General record authoring, review ownership and submissions beyond the scoped
  three-repository update workflow.
- New-claim discovery, architecture/specification synchronization and proof replay.
- Custom production domain, credential rotation and release operations beyond
  publishing the Worker build, including platform traffic limits, abuse controls,
  and monitoring configuration. The deploy target is decided: the owner publishes
  the packaged Worker build with Wrangler; no other hosting runtime is supported.

Research required for each published dataset revision (the initial investigation
is recorded in [Research and intake notes](research.md)):

- The exact active Beacon fork and all pinned architecture source revisions.
- Detailed node/edge inventories and evidence for each relationship.
- Candidate claim selection, trust assumptions, and correspondence to source
  specifications or implementations.
- Final spacing, typography, and expansion behavior against real diagram density,
  while retaining the agreed light, layered-map direction.

Application verification does not deploy to Cloudflare and does not run
third-party proof code. Hosting is the owner-run `npm run deploy` release of the
validated Worker build; the local implementation provisions no other Cloudflare
resources. Application testing is not proof-corpus replay.

## Primary references

- [Ethereum consensus specifications](https://github.com/ethereum/consensus-specs)
- [Lean Ethereum specifications](https://github.com/leanEthereum/leanSpec)
- [Ethereum execution specifications](https://github.com/ethereum/execution-specs)
- [Solidity sources](https://github.com/ethereum/solidity)
- [Hono with Cloudflare Workers and Vite](https://hono.dev/docs/getting-started/cloudflare-workers-vite)
- [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [React Flow documentation](https://reactflow.dev/learn)
- [React Flow layout integration](https://reactflow.dev/learn/layouting/layouting)

The upstream project links above are discovery references only. Never substitute
one of these moving repository links for an evidence reference. Published claims,
evidence records, and architecture edges require stable, revision-specific source
URLs and the corresponding recorded artifact identity.
