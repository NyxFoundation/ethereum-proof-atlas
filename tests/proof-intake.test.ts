import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import lockfile from 'proper-lockfile';
import data from '../data/atlas.json';
import { loadRelease, proposalPath, readBundle, readJson, saveAccepted, saveProposal } from '../src/intake/files';
import { acceptUpdate, detectUpdate } from '../src/intake/updates';
import { targets } from '../src/intake/model';
import { createApp } from '../src/server/app';
import { validateBundle } from '../src/domain/validate';

const now = '2026-11-06T12:00:00Z';
const head = 'a'.repeat(40);
const client = { main: async () => head, source: async () => 'b'.repeat(64) };
const review = { reviewer: 'curator', notes: 'Inspected source correspondence and applicability.' };
const execute = promisify(execFile);
async function scratch() {
  const root = await mkdtemp(join(tmpdir(), 'atlas-intake-test-'));
  await mkdir(join(root, 'data'));
  await writeFile(join(root, 'data/atlas.json'), JSON.stringify(data));
  return root;
}
const cleanup = (root: string) => rm(root, { recursive: true, force: true });

async function sourceServer(state: 'new' | 'open' | 'closed' | 'orphan' = 'new') {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    if (!request.url) { response.writeHead(400); response.end(); return; }
    requests.push(request.url);
    if (request.url!.startsWith('/repos/NyxFoundation/ethereum-proof-atlas/pulls?')) {
      const open = request.url!.includes('state=open');
      const found = state === 'open' && open || state === 'closed' && !open;
      response.end(JSON.stringify(found ? [{ head: { ref: `proof-updates/gasper-lean4/${head}`,
        repo: { full_name: 'NyxFoundation/ethereum-proof-atlas' } } }] : []));
      return;
    }
    if (request.url!.includes('/git/ref/heads/proof-updates/')) {
      response.statusCode = state === 'orphan' ? 200 : 404;
      response.end(JSON.stringify({ ref: 'existing-branch' }));
      return;
    }
    if (request.url!.includes('/git/ref/heads/main')) {
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ object: { type: 'commit', sha: head } }));
      return;
    }
    if (!request.url.startsWith('/NyxFoundation/gasper-lean4/')) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unknown fixture route' }));
      return;
    }
    response.setHeader('Content-Type', 'text/plain');
    response.end(request.url.includes(head) ? 'Updated source fixture; not a public proof.' : 'Previous source fixture.');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server did not start.');
  return { requests, url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
async function cli(root: string, transport: string, args: string[], environment: Record<string, string> = {}) {
  return execute(process.execPath, ['--import', transport, '--import', 'tsx', resolve('scripts/proof-updates.ts'), ...args, '--root', root], {
    cwd: resolve('.'), timeout: 30000, env: { ...process.env, GITHUB_TOKEN: undefined, GH_TOKEN: undefined, ...environment },
  });
}

describe('proof intake consumer flow', () => {
  it('should follow main, preserve the published bundle, record review, and serve the accepted pinned release through the real CLI', async () => {
    const root = await scratch();
    const server = await sourceServer();
    try {
      const transport = join(root, 'fixture-transport.mjs');
      await writeFile(transport, `const original = globalThis.fetch; globalThis.fetch = (input, init) => {
        const url = new URL(input); return original(new URL(url.pathname + url.search, ${JSON.stringify(server.url)}), init); };`);
      const check = await cli(root, transport, ['check', '--target', 'gasper-lean4', '--write']);
      expect(check.stdout).toContain('proof_update_detected');
      expect(await readBundle(root)).toEqual(data);
      await expect(loadRelease(root)).rejects.toThrow('pending_review');
      await expect(cli(root, transport, ['accept', '--target', 'gasper-lean4'])).rejects.toMatchObject({ stderr: expect.stringContaining('explicit_review_required') });
      const accepted = await cli(root, transport, ['accept', '--target', 'gasper-lean4', '--reviewer', 'curator', '--notes', review.notes, '--confirm-reviewed']);
      expect(accepted.stdout).toContain('proof_update_accepted');
      const release = await loadRelease(root);
      const app = createApp(release, () => {});
      const response = await app.request('/api/atlas?view=beacon&component=b-state&claim=ffg-structural-safety');
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.bundle.artifacts.find((a: { id: string }) => a.id === 'gasper-proof').revision).toBe(head);
      await expect(validateBundle(payload.bundle)).resolves.toEqual(release);
      expect(server.requests.filter(path => path.includes('/git/ref/heads/main'))).toHaveLength(1);
      const repeated = await cli(root, transport, ['accept', '--target', 'gasper-lean4', '--reviewer', 'curator', '--notes', review.notes, '--confirm-reviewed']);
      expect(repeated.stdout).toContain(release.datasetRevision);
      const unchanged = await cli(root, transport, ['check', '--target', 'gasper-lean4', '--write']);
      expect(unchanged.stdout).toContain('proof_update_unchanged');
      expect(await loadRelease(root)).toEqual(release);
    } finally { await server.close(); await cleanup(root); }
  }, 30000);

  it('should preserve human proposal edits and refuse to replace a different pending revision', async () => {
    const root = await scratch();
    try {
      const bundle = await readBundle(root);
      const proposal = (await detectUpdate(bundle, targets[0], client, now))!;
      await saveProposal(root, bundle, proposal);
      const human = { ...proposal, content: { ...proposal.content, claims: proposal.content.claims.map(c => ({ ...c, title: 'Human-edited title' })) } };
      await writeFile(proposalPath(root, targets[0].id), JSON.stringify(human));
      expect(await saveProposal(root, bundle, proposal)).toEqual(human);
      await expect(saveProposal(root, bundle, { ...proposal, after: 'c'.repeat(40) })).rejects.toThrow('pending_proposal_exists');
      expect(await readJson(proposalPath(root, targets[0].id))).toEqual(human);
    } finally { await cleanup(root); }
  });

  it('should permit a new candidate only after the previous receipt matches the published release', async () => {
    const root = await scratch();
    try {
      const original = await readBundle(root);
      const proposal = (await detectUpdate(original, targets[0], client, now))!;
      await saveProposal(root, original, proposal);
      const accepted = await acceptUpdate(original, proposal, review, client, now);
      await saveAccepted(root, original, accepted, proposal);
      const next = (await detectUpdate(accepted.bundle, targets[0], { ...client, main: async () => 'c'.repeat(40) }, now))!;
      expect(await saveProposal(root, accepted.bundle, next)).toEqual(next);
      await expect(loadRelease(root)).rejects.toThrow('pending_review');
    } finally { await cleanup(root); }
  });

  it('should refuse an oversized or misnamed proposal at the package boundary', async () => {
    const root = await scratch();
    try {
      const original = await readBundle(root);
      const proposal = (await detectUpdate(original, targets[0], client, now))!;
      await mkdir(join(root, 'updates'));
      await writeFile(join(root, 'updates/wrong.json'), JSON.stringify(proposal));
      await expect(loadRelease(root)).rejects.toThrow('unknown_proposal_file');
      const oversized = join(root, 'oversized.json');
      await writeFile(oversized, ' '.repeat(2 * 1024 * 1024 + 1));
      await expect(readJson(oversized)).rejects.toThrow('input_too_large');
    } finally { await cleanup(root); }
  });

  it('should refuse to overwrite a concurrently changed dataset', async () => {
    const root = await scratch();
    try {
      const original = await readBundle(root);
      const proposal = (await detectUpdate(original, targets[0], client, now))!;
      await saveProposal(root, original, proposal);
      const accepted = await acceptUpdate(original, proposal, review, client, now);
      await writeFile(join(root, 'data/atlas.json'), JSON.stringify(accepted.bundle));
      await expect(saveAccepted(root, original, accepted, proposal)).rejects.toThrow('concurrent_dataset_change');
      expect(JSON.parse(await readFile(join(root, 'data/atlas.json'), 'utf8'))).toEqual(accepted.bundle);
    } finally { await cleanup(root); }
  });

  it.each(['new', 'open', 'closed', 'orphan'] as const)('should respect the %s GitHub publication state through the workflow CLI', async state => {
    const root = await scratch();
    const server = await sourceServer(state);
    try {
      const transport = join(root, 'github-fixture.mjs');
      await writeFile(transport, `const original = globalThis.fetch; globalThis.fetch = (input, init) => {
        const url = new URL(input); return original(new URL(url.pathname + url.search, ${JSON.stringify(server.url)}), init); };`);
      const output = join(root, 'github-output');
      await writeFile(output, '');
      const environment = { GITHUB_TOKEN: 'fixture-token', GITHUB_REPOSITORY: 'NyxFoundation/ethereum-proof-atlas',
        GITHUB_OUTPUT: output, RUNNER_TEMP: root };
      const operation = cli(root, transport, ['check', '--target', 'gasper-lean4', '--write', '--github'], environment);
      if (state === 'orphan') await expect(operation).rejects.toMatchObject({ stderr: expect.stringContaining('orphaned_update_branch') });
      else {
        const result = await operation;
        expect(result.stdout).toContain(state === 'new' ? 'proof_update_detected' : 'proof_update_skipped');
        expect(result.stdout + result.stderr).not.toContain('fixture-token');
      }
      const outputs = await readFile(output, 'utf8');
      expect(outputs.includes('changed=true')).toBe(state === 'new');
      if (state === 'new') {
        expect(outputs).toContain(`branch=proof-updates/gasper-lean4/${head}`);
        expect(await readFile(join(root, 'proof-update-body.md'), 'utf8')).toContain(head);
      } else await expect(readJson(proposalPath(root, 'gasper-lean4'))).rejects.toThrow();
      if (state === 'open') {
        expect(server.requests.some(path => path.includes('/pulls?state=open'))).toBe(true);
        expect(server.requests.some(path => path.includes('/git/ref/heads/main'))).toBe(false);
      }
      expect(await readBundle(root)).toEqual(data);
    } finally { await server.close(); await cleanup(root); }
  });

  it('should reject concurrent intake writes while preserving both files', async () => {
    const root = await scratch();
    try {
      const bundle = await readBundle(root);
      const proposal = (await detectUpdate(bundle, targets[0], client, now))!;
      await saveProposal(root, bundle, proposal);
      const accepted = await acceptUpdate(bundle, proposal, review, client, now);
      const release = await lockfile.lock(join(root, 'data/atlas.json'));
      try {
        await expect(saveProposal(root, bundle, proposal)).rejects.toThrow('concurrent_intake_operation');
        await expect(saveAccepted(root, bundle, accepted, proposal)).rejects.toThrow('concurrent_intake_operation');
        expect(await readBundle(root)).toEqual(bundle);
        expect(await readJson(proposalPath(root, proposal.target))).toEqual(proposal);
      } finally { await release(); }
    } finally { await cleanup(root); }
  });

  it('should refuse to overwrite a proposal edited during source inspection', async () => {
    const root = await scratch();
    try {
      const bundle = await readBundle(root);
      const proposal = (await detectUpdate(bundle, targets[0], client, now))!;
      await saveProposal(root, bundle, proposal);
      const accepted = await acceptUpdate(bundle, proposal, review, client, now);
      const edited = structuredClone(proposal);
      edited.content.claims[0].title = 'More recent human edit';
      await writeFile(proposalPath(root, proposal.target), JSON.stringify(edited));
      await expect(saveAccepted(root, bundle, accepted, proposal)).rejects.toThrow('concurrent_proposal_change');
      expect(await readJson(proposalPath(root, proposal.target))).toEqual(edited);
      expect(await readBundle(root)).toEqual(bundle);
    } finally { await cleanup(root); }
  });

  it('should report malformed local JSON without exposing its contents', async () => {
    const root = await scratch();
    try {
      await writeFile(join(root, 'bad.json'), 'private invalid JSON');
      await expect(readJson(join(root, 'bad.json'))).rejects.toMatchObject({ message: 'invalid_json', code: 'invalid_json' });
    } finally { await cleanup(root); }
  });

  it('should recover a stale lock left by a terminated intake process', async () => {
    const root = await scratch();
    try {
      const bundle = await readBundle(root);
      const proposal = (await detectUpdate(bundle, targets[0], client, now))!;
      const lock = join(root, 'data/atlas.json.lock');
      await mkdir(lock);
      const expired = new Date(Date.now() - 20000);
      await utimes(lock, expired, expired);
      expect(await saveProposal(root, bundle, proposal)).toEqual(proposal);
    } finally { await cleanup(root); }
  });

  it('should report a missing local proposal without leaking local paths', async () => {
    const root = await scratch();
    try {
      const transport = join(root, 'offline-fixture.mjs');
      await writeFile(transport, 'globalThis.fetch = () => { throw new Error("Unexpected network request in offline test"); };');
      const args = ['accept', '--reviewer', 'curator', '--notes', review.notes, '--confirm-reviewed'];
      await expect(cli(root, transport, [...args, '--target', 'all'])).rejects.toMatchObject({ stderr: expect.stringContaining('select_one_target') });
      const operation = cli(root, transport, [...args, '--target', 'gasper-lean4']);
      await expect(operation).rejects.toMatchObject({ stderr: expect.stringContaining('file_not_found') });
      await expect(operation).rejects.toMatchObject({ stderr: expect.not.stringContaining(root) });
    } finally { await cleanup(root); }
  });

  it('should load the original release without an updates directory', async () => {
    const root = await scratch();
    try { expect(await loadRelease(root)).toEqual(data); }
    finally { await cleanup(root); }
  });
});
