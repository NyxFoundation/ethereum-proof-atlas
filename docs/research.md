---
title: Research and intake notes
last_updated: 2026-11-12
tags:
  - evidence
  - research
  - formal-verification
---

# Research and intake notes

These notes record the initial source inspection, not a proof replay or a
certificate. The authoritative locations, revisions and dated observations are
in `data/atlas.json`. Discovery used upstream repository trees; published links
use full commits, not those moving discovery URLs.

## Architecture snapshots

- **Beacon mainnet:** consensus-specs
  `204fb4a19774eabb7a2e91505365deed6b8afef8`.
  [Mainnet configuration](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/configs/mainnet.yaml)
  schedules Fulu at epoch 411392 (2025-12-03), BPO2 at 419072
  (2026-01-07), and leaves Gloas/Heze disabled at the maximum epoch.
  This agrees with the EF Fusaka announcement and the later
  [Glamsterdam Hoodi delay](https://blog.ethereum.org/2026/10/22/glamsterdam-hoodi-delay);
  testnet plans are not treated as mainnet activation.
- **Inheritance:** Fulu's `process_epoch` still invokes justification/finalization.
  Altair's participation-balance calculation calls Phase0's weighing logic.
  Fulu's modified `on_block` requires PeerDAS availability before transition.
  The graph records those sources separately instead of using only the Fulu
  directory or interpreting the whole default branch as active.
- **Execution:** execution-specs
  `a7dbafac0c0ec82e7b2e20959cc7c00ce958442a`, explicitly its Osaka
  transition and EVM interpreter. The transition checks trie/state roots.
- **Execution networking:** devp2p
  `88f1c80800d622cc3a542a2125bbe33cc18c9f9c`, ETH over RLPx.
  Its source explicitly says canonical consensus is determined elsewhere.
- **Compiler:** Solidity
  `d2acac1a0109f88224896e8e6e6d41a6a8e53673`, compiler output
  and EVM targets (Osaka is the documented default). The generated-code edge
  points to EVM, never a runtime call from an execution client to solc.
- **Execution view assembly:** these three snapshots form the third tab as a
  separate architecture view. Its four edges re-use the recorded primary
  sources; the Engine-result interface to the consensus transition stays out
  of both views because no consensus instance exists inside the Execution
  view, and the consensus views borrow no execution instance.
- **Future consensus:** leanSpec
  `0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8`, experimental Lstar.
  Its fork choice, transition, signature aggregation, XMSS, Poseidon,
  SSZ and networking sources were inspected independently. No Beacon BLS,
  KZG or future execution/compiler edge is copied into this view.

Each component instance identifies its own subject and source locations. Each
edge has a kind, explanation and primary-source references. The graph is a
functional overview, not an exhaustive call/import graph. Position similarity
does not assert specification equivalence.

## Published claims

### leanEthereum organisation sweep (2026-11-06)

The full non-fork repository list of the
[leanEthereum organisation](https://github.com/leanEthereum) was enumerated and
each candidate was inspected for formal-verification artifacts.

- **Added as inspection-backed artifacts (no claims, no associations):**
  [ots.golf-dev](https://github.com/leanEthereum/ots.golf-dev) carries the Lean
  `formal/OptimalOTS` cost model and machine model (`OptimalOTS.lean`,
  `Model.lean`) and
  [ots.golf-submissions](https://github.com/leanEthereum/ots.golf-submissions)
  carries checker-admitted Lean proof record bundles (`ProofBundle00.lean`,
  `AveragedSigning.lean`). Both are pinned to their `main` heads
  (ots.golf-dev `8b140a99…`, submissions `d817d9d8…`), and four dated
  Contents-API GET observations back their availability. No component or
  claim association was drawn: the OTS competition's relation to the
  protocol's XMSS or leanSig design is not evidenced in these repositories.
- **Rejected, with reasons:** leanVM and leanvm-riscv are zkVMs — ZK proof
  generation is outside the scope that treats it as formal verification;
  leanSig, axiom, leanSnappy, leansig-test-keys, leanBench, leanMetrics and
  pm are implementations, benchmarks or administration; leanSeal contains a
  paper appendix without a machine-checked artifact, so the paper-only rule
  excludes it; fiat-shamir and multilinear-toolkit are Rust proof-system
  primitives without verification artifacts; sig.golf-submissions holds an
  empty records registry (`records.json` has no records yet) and is worth
  revisiting; leanSpec is already in this bundle.

- **Rejected, with reasons:** leanVM and leanvm-riscv are zkVMs — ZK proof
  generation is outside the scope that treats it as formal verification;
  leanSig, axiom, leanSnappy, leansig-test-keys, leanBench, leanMetrics and
  pm are implementations, benchmarks or administration; leanSeal contains a
  paper appendix without a machine-checked artifact, so the paper-only rule
  excludes it; fiat-shamir and multilinear-toolkit are Rust proof-system
  primitives without verification artifacts; sig.golf-submissions holds an
  empty records registry (`records.json` has no records yet) and is worth
  revisiting; leanSpec is already in this bundle.

### ssz-specs intake (2026-11-07)

[ethereum/ssz-specs](https://github.com/ethereum/ssz-specs), the organisation's
reference-implementation-as-official-specification repository, was inspected at
its `main` head (`fcfb114f…`) and published as two artifacts:

- `ssz-specs` (specification): the Python SSZ reference modules;
  the SSZ component instances in both consensus views now carry it as an
  additional versioned subject alongside their existing specification
  sources.
- `ssz-lean` (formal-model): the accompanying Lean conformance model
  (`lean/`), which encodes SSZ over the shared EthLib consensus modules and
  checks conformance vectors.

Four dated Contents-API GET observations back their availability. The Beacon
view's source list was also cleaned of the execution-layer snapshots left
behind by the view split; those remain recorded only in the Execution view
and in these notes. The repository appears in the footer's
formal-verification section through `ssz-lean`.

### EthLib intake (2026-11-07)

The ssz-specs Lean build pins its SSZ dependency by revision, and its
lakefile states that "the Lean specification of SSZ, and its proofs live in
EthLib as `EthLib.Consensus.Ssz`". [ethereum/EthLib](https://github.com/ethereum/EthLib),
"formally verified Ethereum primitives, written in Lean", was therefore
inspected at that lakefile-pinned revision (`6b87b0d…`) and published as the
`ethlib` formal-model artifact. Its recorded locations cover the SSZ
specification and proof root (`EthLib/Consensus/Proofs/Ssz.lean`, whose
Codec tree carries dozens of checker-checked theorem modules such as
`Canonicality.lean`) and the consensus root module; two dated GET
observations back their availability. Like the other lean-ecosystem
artifacts it carries no claim or component-level associations beyond the
SSZ component's versioned subject binding, and the footer's verification
section now lists it as well.

Public raw GitHub source GETs for all three supporting theorem files returned
**HTTP 200 at 2026-11-06T06:12:14Z**. The files and theorem bodies were inspected.
Those real observations are recorded as availability CheckRecords; they are
not generated from the presence of a URL. All architecture/subject source paths
were also retrieved successfully during intake.

| Claim | Recorded artifact and exact scope |
| --- | --- |
| FFG structural accountable safety | gasper-lean4 `7650709170327c5f10c8b5da99b10941e208ef5d`, `GasperBeaconChain.Core.accountable_safety`, Lean 4.31.0 |
| Strictly-forward checkpoints | formal-leanSpec `ba7284513031eac5c66bfb8221d27b6154cf240b`, `State.checkpoint_forward`, Lean 4.29.1 |
| KZG algebraic correctness | ArkLib `34613d617af325fd0c4f525533a123195868129e`, `KZG.correctness` in `Commitments/Functional/KZG/Correctness.lean` |

**FFG:** the result constructs a quorum-intersection slashing witness from a
finalization fork. It does not prove positive intersection weight. The model
uses symbolic hashes, parent relations, validator sets and weights. The
relationship to the recorded Beacon checkpoint processing is a manual
comparison, not a proof of epoch/balance-rule conformance.

**Lstar:** the theorem requires a successful Lean transition and a nonzero
latest-header slot. Each whole checkpoint is unchanged or advances to a strictly
larger slot. The first genesis anchoring case is excluded. The pinned Python
transition's strict guards were compared with the Lean model; neither matching
names nor the upstream “mirrors” comment is presented as refinement evidence.
Cross-branch ancestry is not established.

**KZG:** honest single-opening correctness follows from generic prime-order
group/pairing algebra and a generated power SRS. Fulu instead consumes batched
cell proofs. The manual relationship identifies shared KZG subject matter,
not equivalence of encoding, verifier algorithms or implementations. This
theorem says nothing by itself about binding, ceremony secrecy or deployed
cryptographic code.

No cited theorem body is an unfinished placeholder. However, inspecting those
bodies is not a complete transitive dependency/axiom audit. The dataset keeps
that audit **unknown**, and every replay state **not performed**. The application
does not run a proof assistant, CI job or third-party artifact.

### EthLib SSZ claim intake (2026-11-08)

A claim-oriented re-inspection of the already-catalogued `ethlib` artifact
(`6b87b0d4951766864af432455c44344fd12b5cdc`, the revision the ssz-specs Lean
build pins) enumerated the complete proof tree at that revision. The
`EthLib/Consensus/Proofs/Ssz/` forest contains 651 `theorem` declarations across
the Codec, Merkle, Type and Flat module families; a word-boundary scan found no
`sorry` declarations. Raw source GETs at this date returned the recorded
theorems' modules (HTTP 200): `Codec/Canonicality.lean` (4,906 bytes) and
`Codec/ProofCorrectness.lean` (4,245 bytes), and two dated availability
observations back the new `ethlib-proof` locations.

Two claims were published from this inspection:

- **SSZ canonical codec** (`ssz-canonical-codec`):
  `Codec.Canonicality.serialize_of_deserialize` — every accepted encoding of a
  well-formed declaration re-encodes to its own input. Bound direct-subject to
  the `b-ssz-codec` and `l-ssz-codec` instances through the artifact's presence
  in their versioned subject lists (`version-match`); no refinement to the Python codec
  is claimed.
- **SSZ branch correctness** (`ssz-branch-rebuilds-root`):
  `Codec.ProofCorrectness.buildProof_rebuilds_value_root` — a constructed
  branch for a readable gindex rebuilds the value's hash-tree root. Bound
  direct-subject to `b-ssz-merkleization` and `l-ssz-merkleization`. The `combine`
  parameter stays abstract, so the result is structural and no hash-security
  property is recorded.

The 2026-11-12 component split separates these existing claims into **SSZ
encoding / decoding** and **SSZ Merkleization**, one claim per component in
both consensus views. Artifact revisions, evidence and check records are
unchanged. The Merkleization instances cite the already-recorded `ssz-container`
source; encoding keeps `ssz-reference`. Existing SSZ-Snappy edges now originate
from encoding, while hash-tree-root and message-root edges originate from
Merkleization. This is a catalogue reorganization, not new proof intake or replay.

Two corrections and one boundary from the same inspection:

- The claim-oriented survey's description of EthLib covering a Merkle
  Patricia trie (root, Merkle proofs, hex-prefix encoding) does not match this
  revision: no Patricia/trie module exists at `6b87b0d…`, and "hex-prefix"
  appears only as a JSON decoding error code. The execution view's
  `State / Patricia trie` component gained no subject or claim from this
  intake.
- The library also carries `Proofs/` forests for BLS (group order, subgroup
  validity, hash-to-curve validity, pairing, compression), KZG (Barycentric,
  FFT, FK20, cells, recovery), XMSS (Correctness, Sign, Verify, KnownAnswer),
  Keccak/SHA-256 specification equivalence, the Modexp precompile and a
  networking Varint. None of that material was inspected for claim admission
  in this intake; it remains uncatalogued beyond the artifact-level list
  above, and the `ethlib` formal-model artifact's recorded locations are
  unchanged.
- Availability observations are GET observations, not replays; the
  `datasetRevision` was recomputed through the packaging validator and the
  two fixture-coupled component tests followed the recorded data.

### leanp2p intake (2026-11-12)

[etheorem/leanp2p](https://github.com/etheorem/leanp2p) was inspected at
`0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7`, the head of its default branch
`hackathon26` at intake. The pinned README targets Ethereum consensus-layer
networking, and `lean-toolchain` selects Lean 4.34.0. The README's bootstrap
status is not a proof inventory: the source contains unsigned-varint proofs.

The `leanp2p-proof` artifact records two inspected theorem locations:

- [`Varint.encodeDecode`](https://github.com/etheorem/leanp2p/blob/0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7/packages/codec/varint/Varint/Theorems.lean#L20-L28):
  a successful decode splits its input into the decoded value's encoding and
  the untouched suffix.
- [`Varint.decodeEncodeSuffix`](https://github.com/etheorem/leanp2p/blob/0ab5e9a4d7bd5d30fabc43742938acb075d8dbe7/packages/codec/varint/Varint/UVarint.lean#L230-L241):
  decoding an encoding followed by any suffix returns that value and suffix.
  The `UVarint` type restricts values to less than `2^63`, with a nine-byte
  encoding budget; the codec model operates on `List Nat`.

Both theorem bodies and their local codec definitions were inspected. Neither
module contains `sorry`, `admit` or an `axiom` declaration; this is not a
complete transitive dependency/axiom audit or an Atlas-side Lean replay.
GitHub Contents API GETs for the two pinned files returned HTTP 200 at
2026-11-12T03:37:31Z and 2026-11-12T03:37:32Z respectively. Their byte counts
and SHA-256 digests are recorded in the artifact's availability checks.

The initial repository-only intake added a footer link without claims or
bindings. The subsequent [eight-repository catalogue audit](catalogue-audit.md)
adds one codec claim with two evidence locations and related-model bindings
in both consensus views. The comparison records the 63-bit/64-bit range and
minimal-encoding differences; it does not establish Gossipsub, transport or
whole-stack correctness.

The same audit adds seven further claims from gasper-lean4, formal-leanSpec,
ArkLib and EthLib, bringing the bundle to 13 distinct claims. BLS, XMSS,
PeerDAS, fork choice and EVM now expose individually scoped results in both
Map and Index. The audit records the source inventory and admission or
non-association reasons for all eight repositories, including OTS research
and ssz-specs conformance tests. Existing automatic-update scopes remain
unchanged; the additional claims are pinned but not automatically updated.

### Cryptographic function split (2026-11-12)

This split changes component boundaries, not the proof corpus or architecture
snapshot revisions. Beacon's **BLS hash-to-G2** carries the existing
curve-membership claim; **BLS signatures** has zero catalogued claims. The
manual-comparison record retains its original date, sources and conclusion
while its instance/check IDs move to the narrower component.

The pinned [Beacon ciphersuite](https://github.com/ethereum/consensus-specs/blob/204fb4a19774eabb7a2e91505365deed6b8afef8/specs/phase0/beacon-chain.md#L1070-L1084)
adopts IETF BLS draft 04. The [versioned draft](https://www.ietf.org/archive/id/draft-irtf-cfrg-bls-signature-04.txt),
sections 2.7 and 4.2.3, confirms that CoreVerify hashes the message to G2 before
checking pairings. The architecture edge cites the pinned adoption site, not a
moving BLS implementation. The draft GET returned HTTP 200 and 55,338 bytes;
the Beacon source GET returned HTTP 200 and 83,312 bytes. Neither observation
is a proof replay.

At the already-selected Lean Spec revision, source inspection distinguishes:

- [Poseidon compression and tweakable hashing](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/spec/crypto/xmss/poseidon.py#L16-L235).
- [Winternitz hash-chain iteration](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/spec/crypto/xmss/poseidon.py#L237-L269).
- [Merkle authentication](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/spec/crypto/xmss/merkle.py#L551-L620).
- [XMSS verification](https://github.com/leanEthereum/leanSpec/blob/0b7d33ecbc9ee2435759c92de4da4d08d7faf1c8/src/lean_spec/spec/crypto/xmss/interface.py#L283-L362),
  which completes the chains and then verifies the authentication path.

Raw GETs returned HTTP 200 for `poseidon.py` (11,063 bytes), `merkle.py`
(22,920 bytes) and `interface.py` (19,321 bytes). Four new pinned locations and
three dated availability records preserve these inspections. Poseidon supplies
both chain and tree hashing; chains and authentication independently supply
XMSS. The existing related Keccak/WOTS+C theorem stays on **XMSS signatures**,
not on these Poseidon-based subcomponents. None gains a claim through an edge.

The cell round-trip claim and its evidence remain on **PeerDAS**. Its duplicate
KZG binding and that binding's manual-comparison record are removed, leaving
KZG's correctness and binding-reduction claims. No encoding component is added;
the Serialization row is unchanged. Claims, proof evidence, proof review/replay
records and the three automatic-update scopes are unchanged.

## Other initial candidates

All five approved candidates were investigated; inclusion in the research
corpus does not require an entry in each view.

- **EthLib** at `b2379edc95db17e3a248872197455bbbd1abec71`:
  inspected its module inventory and
  [SSZ scalar canonicalization proofs](https://github.com/ethereum/EthLib/blob/b2379edc95db17e3a248872197455bbbd1abec71/EthLib/Serialization/Proofs/Ssz/Codec/Canonical.lean).
  These are genuine individual theorem candidates. This intake does not include
  a completed snapshot-specific correspondence record for them, so they are not
  counted. No claim that EthLib lacks proofs is made.
- **Etheorem** at `417ca909aa7d01c8962694180fe6d0168a6a110e`:
  inspected
  [Merkle branch proofs](https://github.com/etheorem/etheorem/blob/417ca909aa7d01c8962694180fe6d0168a6a110e/packages/EthCLLib/EthCLLib/Proofs/MerkleBranch.lean)
  and package trust-boundary descriptions. Its executable Beacon model and
  passing upstream vectors are not treated as proofs of complete consensus
  conformance. Individual library theorem intake remains separate.
- **FORVES** is not part of the initial candidate list. L2 and application
  protocol claims are excluded. ArkLib's shared cryptographic model is included
  without implying that every algorithm in that library is used by Ethereum.

The browser and Worker consume these observations as supplied data. The later
[proof update workflow](proof-updates.md) checks the three published repositories'
`main` heads hourly and proposes fixed-commit updates for human review. It does
not discover new claims, replay proofs, or recheck unchanged source links.
The initial intake observations above remain historical observations, not checks
of any later upstream revision.
