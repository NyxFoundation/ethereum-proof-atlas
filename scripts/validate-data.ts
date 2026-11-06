import { readFile } from 'node:fs/promises';
import { validateBundle } from '../src/domain/validate';
try {
  const bundle = await validateBundle(JSON.parse(await readFile(new URL('../data/atlas.json', import.meta.url), 'utf8')));
  process.stdout.write(`Atlas schema ${bundle.schemaVersion}: ${bundle.datasetRevision}\n`);
} catch {
  process.stderr.write('Atlas validation failed. Check schema, references, source identities and datasetRevision.\n');
  process.exitCode = 1;
}
