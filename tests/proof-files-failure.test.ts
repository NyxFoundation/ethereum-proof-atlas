import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import data from '../data/atlas.json';
import { targets } from '../src/intake/model';
import { acceptUpdate, detectUpdate } from '../src/intake/updates';
import { loadRelease, readBundle, saveAccepted, saveProposal } from '../src/intake/files';

const fault = vi.hoisted(() => ({ rename: false }));
vi.mock('node:fs/promises', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, rename: (...args: Parameters<typeof fs.rename>) =>
    fault.rename ? Promise.reject(new Error('Simulated storage failure')) : fs.rename(...args) };
});

it('should clean temporary files, retain the release and allow retry when an atomic rename fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'atlas-intake-failure-'));
  try {
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'data/atlas.json'), JSON.stringify(data));
    const bundle = await readBundle(root);
    const client = { main: async () => 'a'.repeat(40), source: async () => 'b'.repeat(64) };
    const now = '2026-11-06T12:00:00Z';
    const proposal = (await detectUpdate(bundle, targets[0], client, now))!;
    await saveProposal(root, bundle, proposal);
    const accepted = await acceptUpdate(bundle, proposal, { reviewer: 'curator', notes: 'Reviewed fixture source and applicability.' }, client, now);
    fault.rename = true;
    await expect(saveAccepted(root, bundle, accepted, proposal)).rejects.toThrow('Simulated storage failure');
    expect(await readdir(join(root, 'updates'))).toEqual(['gasper-lean4.json']);
    expect(await readdir(join(root, 'data'))).toEqual(['atlas.json']);
    expect(await readBundle(root)).toEqual(bundle);
    fault.rename = false;
    await saveAccepted(root, bundle, accepted, proposal);
    expect(await loadRelease(root)).toEqual(accepted.bundle);
  } finally { fault.rename = false; await rm(root, { recursive: true, force: true }); }
});
