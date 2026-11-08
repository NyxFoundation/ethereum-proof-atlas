# Ethereum Proof Atlas

A read-only, source-pinned map of formal claims across **Ethereum L1 and supporting
infrastructure**. Claims describe specific subjects, assumptions and limits, not
whole-project safety. The atlas catalogues formal-verification work that already
exists in public repositories: it does not derive claims from specifications, does
not generate proofs, and does not promise to replay external proofs. The approved
scope, data model and presentation contract are in
[docs/design.md](docs/design.md).

## Terminology

| Term | Meaning |
| --- | --- |
| **Atlas bundle** | The packaged, immutable `data/atlas.json`: schema and revision metadata plus the complete record collections for all views. Validated at build time; there is no editing API or mutable runtime store. `datasetRevision` is the canonical SHA-256 digest of the bundle with the field itself omitted — an integrity check, not a signature. |
| **Architecture view** | A specification snapshot shown as a tab — **Beacon Spec**, **Lean Spec** and **Execution Spec** — with component instances, positions, relationships and claim bindings. A claim applies to a component only through the selected view's bindings; switching tabs never leaks claims or check results. |
| **Component / instance** | A technical concept shown on the map (consensus, execution, cryptography, networking, serialization, development), and its per-view instance with a position, child components and a count of bound claims. |
| **Artifact** | A versioned specification, formal model, implementation or proof artifact: a public HTTPS location, an immutable revision (Git commit or SHA-256 digest) and exact source locations. Neither a moving branch nor a release label is a revision. |
| **Claim** | A coherent property about one or more subject artifacts, with assumptions, a dependency/axiom audit, applicability and limits. The primary information unit — not a project, paper or repository. One claim bound to several components is still one claim. |
| **Evidence** | The artifact and exact theorem or verification location supporting a claim: method (theorem proving, SMT, model checking), scope (bounded or unbounded) and configuration. One evidence record supports one claim; a claim may have several. |
| **Check record** | A dated availability, source-review or replay observation, with exact references, a result and supporting details. Availability, correspondence review and replay are separate observations; an older successful availability observation is retained when a later check fails. |
| **Claim binding** | The view-scoped association of a claim with a component instance: `direct-subject` when the component is the claim's subject, `related-model` when only the claim's model is. Bindings are recorded data, never inferred from graph edges or similar names. |
| **Architecture edge** | A relationship between component instances — provider → consumer dependency, sender → receiver interface, or compiler → target generated code — with a supporting primary-source location. Edges never propagate proof guarantees. |

A "0 claims" panel state is a neutral count, not "unproved" or "unsafe". Counts
deduplicate claims within a view regardless of how many artifacts support them.

## How claims reach the map

Every claim exists because a machine-checkable artifact already does. Claims are
catalogued from published proof work by human review; incomplete proof attempts
are never presented as established claims.

1. **Discovery.** Curators identify public formal-verification artifacts (theorem
   proving, SMT-based verification or model checking) whose subjects are in scope.
   Ordinary tests, fuzzing runs, marketing claims and a paper's claim of
   verification alone do not qualify; a formal specification or executable model
   is not a proof merely because it exists.
2. **Source pinning.** The inspected source is pinned to its exact Git commit or
   SHA-256 digest, and the record points at the precise theorem or verification
   location — never at a whole repository or a moving branch.
3. **Claim recording.** For the inspected location the curator records one claim:
   its subject artifact(s), a statement of the established property, assumptions
   and a dependency/axiom audit (recording "unknown" where applicable), and
   limitations. Refinement or equivalence relations between artifacts are part of
   the claim when a separate, machine-checkable record supports them.
4. **Map association.** The claim is manually bound to component instances in the
   architecture views, as a direct subject or a related model. Association is
   recorded correspondence, not something derived from the graph.
5. **Dated observations.** Source availability, correspondence review and replay
   availability are recorded separately as check records with dates and results.
   Atlas-side replay is an observation about an entry, not a prerequisite the
   atlas fulfils for every entry.
6. **Packaging.** The bundle is validated at build time for schema,
   cross-references, source identities and the canonical revision; an invalid
   bundle cannot ship, even when the build is invoked directly.

The initial bundle contains three individually scoped claims from gasper-lean4,
formal-leanSpec and ArkLib.
[Research notes](docs/research.md) record intake evidence and candidate
decisions; none has been replayed by the atlas.

## Updating claims

GitHub Actions watches the catalogued proof repositories' `main` branches hourly.
A changed head produces a pinned, unpublished candidate in a draft PR; open PRs
and human edits are never overwritten. A curator inspects and edits the candidate,
records the review, commits the resulting bundle and receipt, and merges after
review; pending updates fail the package gate. The exact commands, permissions
and recovery steps are in [docs/proof-updates.md](docs/proof-updates.md).

## Documentation

- [docs/design.md](docs/design.md) — approved scope, architecture views, evidence
  boundaries, data model and presentation contract.
- [docs/research.md](docs/research.md) — source research, intake evidence and
  candidate decisions.
- [docs/proof-updates.md](docs/proof-updates.md) — upstream update review
  procedure.
- [docs/implementation.md](docs/implementation.md) — module boundaries, data
  invariants, local setup and verification commands, and the acceptance matrix.
