---
title: Reviewing upstream proof updates
last_updated: 2026-11-06
tags:
  - automation
  - evidence
  - operations
---

# Reviewing upstream proof updates

The **Proof updates** GitHub Actions workflow checks the `main` branches of
gasper-lean4, formal-leanSpec and ArkLib hourly, at minute 23 UTC. GitHub may
delay scheduled runs. **Run workflow** also starts a check manually. The workflow
must be merged into the repository's default branch before the schedule is active.

It tracks only the three already catalogued claims. New theorems, EthLib,
Etheorem, architecture/specification upgrades, proof execution and site deployment
are not part of this workflow.

## What a new upstream commit produces

Each repository can have one open update PR. The bot creates a **draft** with
`updates/<target>.json`, pinned source links, byte observations and a link to the
full upstream comparison. It leaves `data/atlas.json` unchanged.

The JSON proposal contains:

- The tracked repository, `main`, and exact before/after commits.
- A fingerprint of the affected published records, including their checks.
- Proposed artifacts, claims, evidence and view bindings, for human editing.
- Dated source GET observations with SHA-256 hashes, or an unavailable result.
- A null review until a curator explicitly records one.

Every different upstream head is a candidate, even if the theorem file has the
same bytes: imports, models, the toolchain or dependencies may have changed.
Rewinds and force-pushes also require review. File availability and byte equality
do not establish that a theorem still exists, is complete, or has the same meaning.
The workflow does not parse Lean, run its build or audit transitive axioms.

The updater never modifies an open PR or an existing remote branch. Human edits
remain intact. A closed PR suppresses another proposal for that exact upstream
commit; reopen it if it should be reconsidered. A newer commit can produce a new
PR after the earlier one is closed or merged.

## Review and publish

Use Node 24.15+ and `npm ci`, as in the root README. Check out the update PR's
branch before editing or accepting it. Work on one candidate per PR.

1. Follow the pinned theorem and model links and inspect the complete comparison,
   including imports, manifests and toolchain changes.
2. Review the property, assumptions, limitations and correspondence to each
   architecture view. Do not infer refinement or implementation correctness.
3. Edit `updates/<target>.json` when its `content` descriptions need changes.
   Correct renamed source paths, labels, versions, configuration and line anchors
   explicitly. Old line anchors are removed automatically because they may move.
   Use English text. Keep entity membership and ordering, subjects, repositories
   and architecture sources fixed.
   If the result is no longer supportable, close the PR instead of accepting it.
4. Run the acceptance command below, replacing the example reviewer and notes.
   It attests to **source correspondence and view applicability**, not Lean replay
   or a full dependency/axiom audit.
5. Run the full verification gate, commit both the bundle and proposal receipt,
   push the branch, mark the PR ready, obtain human review and merge.

Example for gasper-lean4, after completing steps 1–3:

```sh
npm run proofs:accept -- --target gasper-lean4 \
  --reviewer YOUR_LOGIN \
  --notes "Describe the source and applicability findings you inspected" \
  --confirm-reviewed
npx playwright install chromium
npm run verify
git add -- data/atlas.json updates/gasper-lean4.json
git commit -m "chore: accept reviewed gasper proof update"
git push
```

Other target IDs are `formal-leanSpec` and `arklib`. Reviewer identity and notes
are operator-supplied records, not authentication or a digital signature. GitHub
permissions and PR review govern who may publish.

Acceptance fetches every proposed source at the fixed commit again. An unavailable
new source blocks publication. It removes affected old availability, source-review,
manual-comparison and replay records, then records fresh availability and the
explicit curator review. Axiom-audit status remains unknown; there is no replay
record. Unrelated claims, checks and architecture snapshots are preserved.
Previous releases and their observations remain in Git history.

The command recomputes and validates the canonical dataset revision. Repeating
acceptance produces no duplicate records. If it was interrupted after saving the
receipt but before saving the bundle, repeat the same acceptance command. Intake
writes use a shared `proper-lockfile` lease; after a hard process termination,
wait at least 10 seconds for its abandoned lease to become stale before retrying.
The command also refuses to overwrite a proposal edited during source inspection.

**Pending, mismatched or unapplied receipts fail both `npm run data:validate`
and a direct `vite build`.** A candidate cannot silently become published data.
Merging reviewed data changes the next application build; this workflow does not
deploy or hot-reload a running site.

## Local checks

```sh
# Read-only: inspect all three main heads; no files or PRs are created.
npm run proofs:check

# Save one local candidate without publishing a PR.
npm run proofs:check -- --target arklib --write

# Read the command contract.
npm run proofs:check -- --help
```

Local API requests can use `GITHUB_TOKEN` from the environment to avoid the
unauthenticated GitHub rate limit. Never put credentials in tracked files.
An unchanged head does not rewrite timestamps or create a candidate.
Existing pending proposals are not overwritten, even by a later upstream head.

## GitHub setup and permissions

- Enable GitHub Actions and **Allow GitHub Actions to create and approve pull
  requests** in repository settings (subject to organization policy). The bot
  creates drafts only; it does not approve reviews or enable auto-merge.
- The intake job requests only `contents: write` and `pull-requests: write`.
  There is no PAT, external webhook or upstream repository configuration.
- Configure default-branch rules to require **Verify atlas** and a human PR
  review. No script can prevent an administrator from bypassing repository rules.
- A PR created with `GITHUB_TOKEN` does not trigger other workflows by itself.
  The curator's acceptance commit/push or **ready for review** event starts the
  verification workflow. Do not mistake absent initial checks for passing checks.
- Existing `main` branches are required. A missing branch or an API/rate-limit
  error fails the job, rather than choosing another branch or publishing partial
  data. Matrix jobs are independent so one unavailable upstream does not stop
  the other repositories.
- Publication uses a normal Git push, never a force-push. Workflow concurrency
  prevents overlapping runs for the same target.

The scheduled job executes this repository's default-branch code only. It fetches
upstream text as data and installs dependencies with `--ignore-scripts`; it never
checks out or executes upstream Lean code. Requests use fixed GitHub hosts,
20-second timeouts, a 2 MiB response bound and no redirects. Authentication is
sent only to the GitHub API, not the raw-source host. Imported source bodies and
credentials are not logged.

## Resolve blocked updates

| Result | Action |
| --- | --- |
| Open update PR | Review, merge or close it. The bot will not overwrite the branch with a newer head. |
| Closed PR for the same upstream commit | Reopen that PR if it should be reconsidered; the bot avoids repeated rejected proposals. |
| `orphaned_update_branch` | A push may have succeeded before PR creation failed. Inspect the preserved branch and open its draft PR manually, or resolve/remove it through the normal reviewed Git workflow. The bot never deletes or rewrites it. |
| `stale_proposal` | The affected published records changed after detection. Reconcile the review with the new baseline; do not bypass it by changing the fingerprint. Close the outdated PR and generate a fresh candidate locally if needed. |
| `pending_review` / `unapplied_review` | Complete acceptance and commit both files. After an interrupted acceptance, repeat the command. |
| `source_unavailable` | Inspect the fixed commit. Correct a confirmed renamed path or wait for source access to return; do not substitute a moving URL or a successful check. |
| `github_http_403` / `github_http_429` | Check token permissions and rate limits, then retry the workflow after recovery. No release was changed. |
| `github_timeout` / `invalid_github_response` | The bounded request timed out or the response did not match the GitHub contract. Retry after recovery; no data is substituted. |
| `file_not_found` / `invalid_json` / `invalid_input` | Confirm the checkout and candidate exist, repair JSON syntax, and check IDs, English text and the command's required flags. No paths or raw input are logged. |
| `concurrent_intake_operation` / `concurrent_proposal_change` / `concurrent_dataset_change` | Finish the other operation, preserve its edits, then restart from the current files. Do not remove an active lock. |
| `intake_lock_failed` / `intake_lock_lost` | Check local filesystem permissions and lock integrity. Stop conflicting writers before retrying. |

Unrelated repository updates do not invalidate a proposal's baseline. Git merge
conflicts can still occur in the shared bundle. After rebasing a candidate onto
the current default branch, rerun acceptance and verification against that bundle.
Do not resolve a conflict by retaining an old dataset digest or by dropping another
repository's accepted update.
