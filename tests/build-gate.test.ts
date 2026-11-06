import { mkdtemp, mkdir, readFile, writeFile, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { validateBundle } from '../src/domain/validate';
import { detectUpdate } from '../src/intake/updates';
import { targets } from '../src/intake/model';

describe('package gate', () => {
  it.each(['unsafe-source', 'dangling-reference', 'unreviewed-proof-update'])('should fail a direct Vite build with %s', async defect => {
    const root = resolve('.');
    const directory = await mkdtemp(join(tmpdir(), 'atlas-build-test-'));
    try {
      for (const path of ['src/domain', 'src/intake', 'data', 'vite.config.ts', 'package.json', 'wrangler.jsonc']) {
        await cp(join(root, path), join(directory, path), {recursive: true});
      }
      await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
      const file = join(directory, 'data/atlas.json');
      const bundle = JSON.parse(await readFile(file, 'utf8'));
      if (defect === 'unsafe-source') bundle.artifacts[0].locations[0].url = 'javascript:alert(1)';
      else if (defect === 'dangling-reference') bundle.architectureEdges[0].source = 'missing';
      else {
        const proposal = await detectUpdate(await validateBundle(bundle), targets[0], {
          main: async () => 'a'.repeat(40), source: async () => 'b'.repeat(64),
        }, '2026-11-06T12:00:00Z');
        await mkdir(join(directory, 'updates'));
        await writeFile(join(directory, 'updates/gasper-lean4.json'), JSON.stringify(proposal));
      }
      await writeFile(file, JSON.stringify(bundle));
      const result = spawnSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
        cwd: directory, encoding: 'utf8', timeout: 30000,
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(defect === 'unsafe-source' ?
        'Source URLs must be absolute HTTPS' : defect === 'dangling-reference' ? 'Invalid atlas: edge endpoints' : 'pending_review');
    } finally {
      // Only this test's freshly allocated scratch directory is removed.
      await rm(directory, {recursive: true,force: true});
    }
  });
});
