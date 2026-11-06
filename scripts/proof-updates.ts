import { appendFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { GitHubClient } from '../src/intake/github.ts';
import { IntakeError, proposalSchema, requireIntake, targetFor, targets, updateBranch, type Target } from '../src/intake/model.ts';
import { acceptUpdate, detectUpdate } from '../src/intake/updates.ts';
import { proposalPath, readBundle, readJson, saveAccepted, saveProposal } from '../src/intake/files.ts';
import { proposalReport } from '../src/intake/report.ts';

const help = `Proof update intake (no upstream code execution)
  npm run proofs:check -- [--target all|gasper-lean4|formal-leanSpec|arklib]
  npm run proofs:check -- --target TARGET --write
  npm run proofs:accept -- --target TARGET --reviewer LOGIN --notes "Review findings" --confirm-reviewed

check is read-only unless --write is supplied. It follows main but pins the observed
commit. --write saves an unpublished proposal in updates/TARGET.json.
accept requires inspecting all proposed theorem/model sources, assumptions, limits
and view applicability. Edit the proposal first if descriptions or locations changed.
--confirm-reviewed attests to that inspection, NOT proof replay or an axiom audit.
accept rechecks source availability, updates data/atlas.json and saves a review receipt.
Commit BOTH files, verify, then submit for review and merge.

--root DIR selects the atlas checkout (default: current directory).
--github is for the hourly workflow: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_OUTPUT
and RUNNER_TEMP are required. Skip existing PRs/branches and write the outputs and
RUNNER_TEMP/proof-update-body.md. Without --github, GITHUB_TOKEN is optional for
local read-only GitHub API requests.
`;
const log = (event: string, fields: Record<string, unknown> = {}) => process.stdout.write(JSON.stringify({ event, ...fields }) + '\n');
const clock = () => new Date().toISOString();

async function check(root: string, target: Target, write: boolean, github: boolean) {
  const client = new GitHubClient({ token: process.env.GITHUB_TOKEN });
  const repository = process.env.GITHUB_REPOSITORY;
  if (github) {
    requireIntake(repository && process.env.GITHUB_TOKEN && process.env.GITHUB_OUTPUT && process.env.RUNNER_TEMP, 'missing_github_environment');
    if (await client.hasOpenUpdate(repository, target)) { log('proof_update_skipped', { target: target.id, reason: 'open_pull_request' }); return; }
  }
  const bundle = await readBundle(root);
  const detected = await detectUpdate(bundle, target, client, clock());
  if (!detected) { log('proof_update_unchanged', { target: target.id }); return; }
  const blocked = github ? await client.existingCandidate(repository!, target, detected.after) : null;
  requireIntake(blocked !== 'existing_branch', 'orphaned_update_branch');
  if (blocked) { log('proof_update_skipped', { target: target.id, reason: blocked }); return; }
  const proposal = write ? await saveProposal(root, bundle, detected) : detected;
  log('proof_update_detected', { target: target.id, before: proposal.before, after: proposal.after,
    unavailable: proposal.observations.filter(o => o.revision === proposal.after && !o.sha256).length, saved: write });
  if (!github) return;
  await writeFile(join(process.env.RUNNER_TEMP!, 'proof-update-body.md'), proposalReport(proposal));
  await appendFile(process.env.GITHUB_OUTPUT!, `changed=true\nbranch=${updateBranch(target, proposal.after)}\n`);
}
async function run() {
  const { values, positionals } = parseArgs({ allowPositionals: true, strict: true, options: {
    help: { type: 'boolean' }, target: { type: 'string', default: 'all' }, root: { type: 'string' },
    write: { type: 'boolean' }, github: { type: 'boolean' }, reviewer: { type: 'string' },
    notes: { type: 'string' }, 'confirm-reviewed': { type: 'boolean' },
  } });
  if (values.help) { process.stdout.write(help); return; }
  const root = resolve(values.root ?? '.');
  requireIntake(positionals.length === 1 && ['check', 'accept'].includes(positionals[0]), 'invalid_command');
  if (positionals[0] === 'check') {
    requireIntake(!(values.write || values.github) || values.target !== 'all', 'select_one_target');
    requireIntake(!values.github || values.write, 'github_requires_write');
    for (const target of values.target === 'all' ? targets : [targetFor(values.target)]) {
      await check(root, target, values.write ?? false, values.github ?? false);
    }
    return;
  }
  requireIntake(values['confirm-reviewed'] && values.reviewer && values.notes && !values.write && !values.github, 'explicit_review_required');
  requireIntake(values.target !== 'all', 'select_one_target');
  const target = targetFor(values.target);
  const bundle = await readBundle(root);
  const proposal = proposalSchema.parse(await readJson(proposalPath(root, target.id)));
  requireIntake(proposal.target === target.id, 'wrong_proposal_target');
  const result = await acceptUpdate(bundle, proposal, { reviewer: values.reviewer, notes: values.notes },
    new GitHubClient({ token: process.env.GITHUB_TOKEN }), clock());
  await saveAccepted(root, bundle, result, proposal);
  log('proof_update_accepted', { target: target.id, datasetRevision: result.bundle.datasetRevision });
}
try { await run(); }
catch (error) {
  process.stderr.write(JSON.stringify({ event: 'proof_update_failed',
    reason: error instanceof IntakeError ? error.code : error instanceof ZodError ? 'invalid_input' :
      error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 'file_not_found' : 'operation_failed' }) + '\n');
  process.exitCode = 1;
}
