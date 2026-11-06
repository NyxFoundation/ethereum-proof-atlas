import { mkdir, open, readdir, rename, unlink } from 'node:fs/promises';
import lockfile from 'proper-lockfile';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AtlasBundle } from '../domain/schema.ts';
import { validateBundle } from '../domain/validate.ts';
import { IntakeError, proposalSchema, requireIntake, targetFor, type Proposal } from './model.ts';
import { validateAcceptedUpdate } from './updates.ts';
import { hash } from './scope.ts';

function absent(error: unknown) { return error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
export async function readJson(path: string): Promise<unknown> {
  const file = await open(path, 'r');
  try {
    const limit = 2 * 1024 * 1024;
    const buffer = Buffer.alloc(limit + 1);
    let size = 0;
    while (size <= limit) {
      const { bytesRead } = await file.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    requireIntake(size <= limit, 'input_too_large');
    try { return JSON.parse(buffer.subarray(0, size).toString('utf8')); }
    catch { throw new IntakeError('invalid_json'); }
  } finally { await file.close(); }
}
export const proposalPath = (root: string, target: string) => join(root, 'updates', targetFor(target).id + '.json');
export async function readBundle(root: string) {
  return validateBundle(await readJson(join(root, 'data/atlas.json')));
}
export async function loadRelease(root: string) {
  const bundle = await readBundle(root);
  let files: string[];
  try { files = await readdir(join(root, 'updates')); }
  catch (error) { if (absent(error)) return bundle; throw error; }
  for (const name of files.filter(name => name.endsWith('.json'))) {
    const proposal = proposalSchema.parse(await readJson(join(root, 'updates', name)));
    requireIntake(name === proposal.target + '.json', 'unknown_proposal_file');
    validateAcceptedUpdate(bundle, proposal);
  }
  return bundle;
}
async function withReleaseLock<T>(root: string, operation: (assertHeld: () => void) => Promise<T>) {
  let compromised = false;
  const release = await lockfile.lock(join(root, 'data/atlas.json'), {
    onCompromised: () => { compromised = true; },
  }).catch((error: unknown) => {
    const locked = error instanceof Error && 'code' in error && error.code === 'ELOCKED';
    throw new IntakeError(locked ? 'concurrent_intake_operation' : 'intake_lock_failed');
  });
  try { return await operation(() => requireIntake(!compromised, 'intake_lock_lost')); }
  finally { if (!compromised) await release(); }
}
async function atomicJson(path: string, value: unknown, assertHeld: () => void) {
  const temporary = path + '.tmp-' + randomUUID();
  const file = await open(temporary, 'wx');
  try {
    try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); }
    finally { await file.close(); }
    assertHeld();
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(error => { if (!absent(error)) throw error; });
  }
}
export async function saveProposal(root: string, bundle: AtlasBundle, proposal: Proposal) {
  return withReleaseLock(root, async assertHeld => {
    requireIntake((await readBundle(root)).datasetRevision === bundle.datasetRevision, 'concurrent_dataset_change');
    const path = proposalPath(root, proposal.target);
    let existing: Proposal | undefined;
    try { existing = proposalSchema.parse(await readJson(path)); }
    catch (error) { if (!absent(error)) throw error; }
    if (existing?.review === null) {
      requireIntake(existing.target === proposal.target && existing.repository === proposal.repository &&
        existing.before === proposal.before && existing.after === proposal.after &&
        existing.baseFingerprint === proposal.baseFingerprint, 'pending_proposal_exists');
      return existing;
    }
    if (existing) validateAcceptedUpdate(bundle, existing);
    await mkdir(join(root, 'updates'), { recursive: true });
    await atomicJson(path, proposal, assertHeld);
    return proposal;
  });
}
export async function saveAccepted(root: string, original: AtlasBundle,
  result: { bundle: AtlasBundle; proposal: Proposal }, expectedProposal: Proposal) {
  await withReleaseLock(root, async assertHeld => {
    requireIntake((await readBundle(root)).datasetRevision === original.datasetRevision, 'concurrent_dataset_change');
    const path = proposalPath(root, result.proposal.target);
    requireIntake(hash(await readJson(path)) === hash(expectedProposal), 'concurrent_proposal_change');
    // Persist the receipt first. A crash before the bundle write is recoverable by repeating acceptance.
    await atomicJson(path, result.proposal, assertHeld);
    await atomicJson(join(root, 'data/atlas.json'), result.bundle, assertHeld);
  });
}
