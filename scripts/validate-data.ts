import { fileURLToPath } from 'node:url';
import { loadRelease } from '../src/intake/files.ts';
try {
  const bundle = await loadRelease(fileURLToPath(new URL('../', import.meta.url)));
  process.stdout.write(`Atlas schema ${bundle.schemaVersion}: ${bundle.datasetRevision}\n`);
} catch {
  process.stderr.write('Atlas validation failed. Check schema, references, source identities, datasetRevision and proof update reviews.\n');
  process.exitCode = 1;
}
