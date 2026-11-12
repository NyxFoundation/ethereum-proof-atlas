---
title: Formal-verification catalogue audit
last_updated: 2026-11-12
tags:
  - evidence
  - formal-verification
  - research
---

# Formal-verification catalogue audit

The 2026-11-12 intake inspected all eight repositories in the formal-verification
footer, using their existing fixed revisions rather than advancing architecture
snapshots or importing moving branch heads. It adds **eight distinct claims**
to the previous five. Every new claim is reachable from both the Index and Map
through the same view-specific bindings, with its statement, assumptions,
limitations, theorem links and dated checks.

## Inspection coverage

The complete Git tree was enumerated at each revision. Lean-file counts below
are inventory counts, not numbers of proofs or measures of verification coverage.
Selected declarations, local proof bodies, model definitions and corresponding
specification sources were inspected. This was not an exhaustive theorem-by-
theorem audit, a complete transitive axiom/dependency audit or a Lean replay.

| Repository | Inspected revision | Lean files | Catalogue decision |
| --- | --- | ---: | --- |
| gasper-lean4 | [`76507091`](https://github.com/NyxFoundation/gasper-lean4/tree/7650709170327c5f10c8b5da99b10941e208ef5d) | 65 | Keep structural accountable safety; add the quantitative churn-adjusted intersection bound. |
| formal-leanSpec | [`ba728451`](https://github.com/NyxFoundation/formal-leanSpec/tree/ba7284513031eac5c66bfb8221d27b6154cf240b) | 41 | Keep checkpoint-forward; add conditional LMD-GHOST head equality. |
| ArkLib | [`e272c348`](https://github.com/Verified-zkEVM/ArkLib/tree/e272c34851e039e0e3b93a16c16000e464731961) | 1,474 | Keep KZG correctness; add the evaluation-binding reduction, not an unconditional security claim. |
| ots.golf-dev | [`8b140a99`](https://github.com/leanEthereum/ots.golf-dev/tree/8b140a99afa5b3e0bc785ab202c7b0a9c1f7fe7c) | 45 | Inspect the oracle-cost model and concrete scheme security proof; no protocol-specific binding established. |
| ots.golf-submissions | [`d817d9d8`](https://github.com/leanEthereum/ots.golf-submissions/tree/d817d9d84bedd681e5058fb10c0beff7d75ab3bd) | 435 | Inspect proof bundles and averaged-signing results; no protocol-specific binding established. |
| ssz-specs | [`fcfb114f`](https://github.com/ethereum/ssz-specs/tree/fcfb114f53768e08d74640e2b40b0d44d03ba099) | 8 | Inspect the Lean conformance/regression modules; retain the two EthLib-backed SSZ claims rather than count conformance tests as proofs. |
| EthLib | [`6b87b0d4`](https://github.com/ethereum/EthLib/tree/6b87b0d4951766864af432455c44344fd12b5cdc) | 274 | Keep SSZ claims; add BLS hash-to-curve, XMSS correctness, cell codec and MODEXP computation claims. |
| leanp2p | [`0ab5e9a4`](https://github.com/etheorem/leanp2p/tree/0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7) | 236 | Add one varint codec claim supported by two theorem locations. |

Source files were retrieved through successful fixed-revision GitHub Contents
API GETs. Published artifact locations have dated availability observations in
`data/atlas.json`; new observations include response byte counts and SHA-256
digests. New source reviews and manual comparisons are separate check records.
No replay result or completed dependency audit was manufactured from those GETs.

## Admitted properties and boundaries

### Consensus and fork choice

- [`GasperBeaconChain.Core.slashable_bound`](https://github.com/NyxFoundation/gasper-lean4/blob/7650709170327c5f10c8b5da99b10941e208ef5d/GasperBeaconChain/Core/Theories/SlashableBound.lean#L526-L558)
  bounds the intersection weight of constructed validator subsets under two
  conflicting k-finalization hypotheses. The arithmetic uses truncated natural
  subtraction. The conclusion does not retain the slashing predicate from the
  structural lemma and does not imply that the lower bound is positive. It is
  bound to Beacon state transition and finalization as a related FFG model,
  not a proof of Beacon churn, balance or penalty rules.
- [`Store.computeLmdGhostHead_incremental`](https://github.com/NyxFoundation/formal-leanSpec/blob/ba7284513031eac5c66bfb8221d27b6154cf240b/LeanSpec/Forks/Lstar/Store/IncrementalWeights.lean#L258-L278)
  requires an existing anchor and pointwise equality between maintained weights
  and the full tally. The Lean walk then selects the same head. The
  [pinned Python tally and walk](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/spec/forks/lstar/fork_choice.py#L729-L856)
  support the related-model association to Lean fork choice. This does not
  verify an incremental maintenance implementation or proto-array caches, and
  the model's explicit fuel is not a proof of equivalence to the Python loop.

### Networking

The two leanp2p declarations
[`Varint.encodeDecode`](https://github.com/etheorem/leanp2p/blob/0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7/packages/codec/varint/Varint/Theorems.lean#L20-L28)
and
[`Varint.decodeEncodeSuffix`](https://github.com/etheorem/leanp2p/blob/0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7/packages/codec/varint/Varint/UVarint.lean#L230-L241)
support **one** codec claim, not two counts. Their subject is the `List Nat`
model, not the byte-buffer adapter or a complete network stack.

[Beacon Req/Resp](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/p2p-interface.md#L1343-L1366)
and
[Lean Req/Resp](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/node/networking/reqresp/codec.py#L78-L162)
use unsigned base-128 length prefixes. The difference is explicit: leanp2p
accepts minimal encodings of values below `2^63` in at most nine bytes; Beacon
requires the full `Uint64` range with a ten-byte limit and only recommends
minimal encodings. Lean's shared decoder also uses a ten-byte limit. The claim
is therefore related-model evidence on the consensus **Req/Resp codec** (Beacon)
and the **Varint codec** (Lean) components, not a general networking claim:
it is not codec conformance, Gossipsub correctness, QUIC or RLPx transport
security, discovery protocol soundness, or an Execution ETH/RLPx claim.
The other network components carry their pinned specification locations and
dated availability observations but catalogued no proof subjects in this audit.

The 2026-11-12 network presentation split the folded Consensus/Execution
Network instances into per-protocol components. Component IDs, graph positions,
claims, evidence, bindings and checks are unchanged; two components were retired,
twelve protocol components and seven pinned specification locations were added
with their own dated GET observations, and the canonical bundle digest was
recomputed through the packaging validator.

### Cryptography, cells and execution

- [`KZG.CommitmentScheme.binding_reduces_to_tSdh`](https://github.com/Verified-zkEVM/ArkLib/blob/e272c34851e039e0e3b93a16c16000e464731961/ArkLib/Commitments/Functional/KZG/Binding.lean#L744-L778)
  bounds each binding adversary's success by its reduction's t-SDH success.
  It does not prove hardness. The separate `binding` corollary requires an
  explicit adversary class containing the reduction; `HardnessAssumptions.lean`
  even proves that an unrestricted-class hardness assumption below error one
  is false under its stated generator condition. No such assumption is silently
  added here. The Beacon KZG binding remains a related algebraic model, not a
  Fulu batched-cell-proof security guarantee.
- [`HashToCurve.hashToG2_total`](https://github.com/ethereum/EthLib/blob/6b87b0d4951766864af432455c44344fd12b5cdc/EthLib/Cryptography/Proofs/Bls/HashToCurveValidity.lean#L151-L160)
  gives successful return and nonsingular twist-curve membership for EthLib's
  BLS12-381 hash-to-G2. The
  [Beacon ciphersuite](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/beacon-chain.md#L1070-L1084)
  supports the relationship, but subgroup membership, BLS unforgeability and
  client conformance are outside this theorem.
- [`Xmss.verify_keyGen_sign`](https://github.com/ethereum/EthLib/blob/6b87b0d4951766864af432455c44344fd12b5cdc/EthLib/Cryptography/Proofs/Xmss/Correctness.lean#L60-L67)
  assumes that signing succeeds. EthLib implements a
  [Keccak/WOTS+C two-layer draft](https://github.com/ethereum/EthLib/blob/6b87b0d4951766864af432455c44344fd12b5cdc/EthLib/Cryptography/Xmss/README.md#L1-L59),
  whereas the selected Lean Spec implements Poseidon-based generalized XMSS.
  The association exposes this difference. It proves neither that selected
  scheme's correctness nor unforgeability, grinding success or index-reuse safety.
- [`Kzg.cellToCosetEvals_cosetEvalsToCell`](https://github.com/ethereum/EthLib/blob/6b87b0d4951766864af432455c44344fd12b5cdc/EthLib/Cryptography/Proofs/Kzg/Cells.lean#L168-L179)
  round-trips an array of exactly 64 scalar-field elements. The
  [Fulu Cell type](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/fulu/das-core.md#L48-L58)
  supports related-model bindings to KZG and PeerDAS. These are serialization
  results, not proof-verifier correctness, erasure recovery or data availability.
- [`Modexp.compute_eq_pow_mod`](https://github.com/ethereum/EthLib/blob/6b87b0d4951766864af432455c44344fd12b5cdc/EthLib/Precompiles/Proofs/Modexp/Core.lean#L47-L67)
  proves the integer value of the pure computation helper, including modulus
  zero. It is related to the
  [Osaka MODEXP output branch](https://github.com/ethereum/execution-specs/blob/a7dbafac0c0ec82e7b2e20959cc7c00ce958442a/src/ethereum/forks/osaka/vm/precompiled_contracts/modexp.py#L22-L71),
  not the whole EVM, gas accounting, validation or exceptional halts. EthLib's
  model describes BPO2; no full cross-fork conformance is inferred.

## Inspected but not newly bound

**ots.golf-dev and ots.golf-submissions contain actual proof work.**
The inspection included the
[random-oracle cost model](https://github.com/leanEthereum/ots.golf-dev/blob/8b140a99afa5b3e0bc785ab202c7b0a9c1f7fe7c/formal/OptimalOTS/Model.lean),
[`forestScheme_secure`](https://github.com/leanEthereum/ots.golf-dev/blob/8b140a99afa5b3e0bc785ab202c7b0a9c1f7fe7c/formal/Witnesses/Generality1/Main.lean),
the
[upper-compressions bundle](https://github.com/leanEthereum/ots.golf-submissions/blob/d817d9d84bedd681e5058fb10c0beff7d75ab3bd/formal/Submissions/UpperCompressions/ProofBundle00.lean)
and
[averaged-signing results](https://github.com/leanEthereum/ots.golf-submissions/blob/d817d9d84bedd681e5058fb10c0beff7d75ab3bd/formal/Submissions/LowerGenerality1/AveragedSigning.lean).
The submission tree's actual `.contract` gitlink is `8b140a99…`, matching the
catalogued model; its README still names the older `20c5b5d0…` pin, so the
README was not used as the revision authority.

These results concern competition-specific schemes, oracle experiments and
costs. No instance or correspondence connecting those schemes to the pinned
Poseidon XMSS implementation was established. They remain research artifacts,
not counts on XMSS or signature aggregation. This is an applicability boundary,
not a claim that the repositories lack proofs.

**ssz-specs** imports its specification and general proofs from the pinned
EthLib dependency. Its own Lean modules are conformance and regression code;
`lean/Tests.lean` also contains a small two-leaf `BranchConsistent` example.
That example is not a general SSZ codec-conformance proof. No extra claim was
created from generated vectors, regression success or that fixture lemma.
The existing two EthLib SSZ claims remain available in both consensus views.

## Resulting map and table counts

Only catalogued claims are counted. Multiple evidence locations and multiple
component bindings do not create new claims.

| View | Changed component counts |
| --- | --- |
| Beacon Spec | State transition 2; finalization 2; consensus networking 1; BLS 1; KZG 3; PeerDAS 1. SSZ remains 2. |
| Lean Spec | Fork choice 1; consensus networking 1; XMSS 1. State transition and finalization remain 1; SSZ remains 2. |
| Execution Spec | EVM 1, specifically MODEXP computation. Execution transition, trie, ETH/RLPx and solc remain 0. |

The existing three automatic-update claim scopes and the accepted ArkLib receipt
are unchanged. Additional Gasper, Lstar and ArkLib models/proofs have separate
artifact identities and remain pinned; the current updater does not advance
these new records. All existing claims, evidence, checks, bindings, revisions,
source locations, component subjects, positions and edges were preserved.

## Application verification

`npm run verify` passed with 198 unit/component/package cases and 23 browser
cases against the built local Worker. Coverage was 99.09% statements, 96.40%
branches, 98.81% functions and 99.85% lines. `tests/catalogue.test.ts` checks
counts, deduplication, scope and intake evidence; `e2e/catalogue.spec.ts` opens
all eight new claims from Index and Map, checks pinned theorem links, preserves
selection across modes, checks tab isolation and exercises a 320px viewport.
These tests verify the atlas application, not the external Lean proofs.
