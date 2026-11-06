# Ethereum Proof Atlas

**Ethereum Proof Atlas (EPA)** is a public map of formal verification across the Ethereum ecosystem.

EPA aims to show what has been specified, formalized, proved, or left unproved—from cryptographic primitives and protocol rules to L2 systems and applications. Every assessment should be traceable to concrete evidence such as a theorem, source file, specification, repository, and commit.

> [!NOTE]
> EPA is in its initial design phase. The taxonomy and evidence model will evolve as verified data is added.

## Why EPA?

Formal verification work is distributed across many repositories, proof assistants, research papers, and audit reports. Existing lists make these projects discoverable, but they do not provide a shared map of:

- which claims about Ethereum should be proved;
- which claims have machine-checked proofs;
- which assumptions those proofs depend on;
- which specification and implementation versions they cover;
- where important gaps remain.

EPA is intended to make that information understandable, reviewable, and open to contribution.

## Scope

EPA covers the full Ethereum ecosystem rather than a single proof assistant or implementation:

- cryptography;
- serialization;
- networking;
- execution and the EVM;
- consensus;
- data availability;
- L2 systems and bridges;
- applications and smart contracts;
- developer and verification infrastructure.

The initial atlas will contain the complete high-level structure while only making detailed assessments where evidence has been reviewed.

## Assessment model

EPA does not reduce formal verification to a single “proved” badge or a percentage score. Each subject is assessed across independent dimensions:

| Dimension | Question |
| --- | --- |
| Specification | Is the intended behavior stated precisely? |
| Formalization | Is the relevant specification represented in a formal system? |
| Conformance | Is the formal definition connected to its source specification or implementation? |
| Correctness | Are functional correctness properties proved? |
| Security | Are security properties proved under explicit adversarial models? |
| Completeness | Do the proofs cover the full subject or only selected components? |
| Review | Has the evidence received independent review or audit? |

An assessment can be **not started**, **in progress**, **proved**, **proved with assumptions**, or **under review**. The detailed page must explain what the status means instead of relying on color alone.

## Evidence

Each assessed claim should identify, where applicable:

- the claim being evaluated;
- its source specification;
- the proof system and theorem name;
- the repository, file, and pinned commit;
- hypotheses, axioms, trusted components, and idealized models;
- the covered version or fork;
- known limitations and missing links;
- review provenance.

The atlas records evidence; it does not treat the existence of a repository, paper, test, or audit as proof by itself.

## Initial sources

EPA will begin with reviewed information from:

- [EthLib](https://github.com/ethereum/EthLib), for Ethereum primitives, protocol definitions, proofs, and documented soundness assumptions;
- [ArkLib](https://github.com/Verified-zkEVM/ArkLib), for formally verified arguments of knowledge and proof-system components;
- [Awesome Ethereum Formal Verification](https://github.com/NyxFoundation/formal-eth), as an index of existing Ethereum formal-verification work;
- [L2BEAT](https://l2beat.com/), as inspiration for evidence-based categorization and transparent assessment methodology.

Repository references will be pinned to reviewed commits and updated manually in the first version. Automated update jobs are intentionally outside the initial scope.

## Initial website

The first release will be a read-only website providing:

- an ecosystem taxonomy;
- status and evidence filters;
- subject and claim detail pages;
- links to source specifications and proof artifacts;
- explicit assumptions, limitations, and unassessed areas;
- counts by assessment status, without a misleading global proof percentage.

Authentication, in-browser editing, automatic source ingestion, custom scoring, and complex graph visualization are not part of the initial release.

## Contributing

EPA will use repository-managed declarative data so that additions and corrections can be reviewed through GitHub pull requests. The schema and contribution guide will be added with the first implementation.

Until then, please use GitHub issues to propose taxonomy changes, proof sources, or assessment criteria.

## Name

**Ethereum Proof Atlas** reflects the goal of mapping both established proofs and unexplored territory across Ethereum. The project abbreviation is **EPA**.
