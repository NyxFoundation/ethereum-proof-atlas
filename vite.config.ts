import { readFile } from 'node:fs/promises';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { validateBundle } from './src/domain/validate.ts';

export default defineConfig(async () => {
  // This gate also runs on a direct vite build, not just the npm wrapper.
  const bundle = await validateBundle(JSON.parse(await readFile(new URL('./data/atlas.json', import.meta.url), 'utf8')));
  return {
    plugins: [react(), cloudflare()],
    define: { __DATASET_REVISION__: JSON.stringify(bundle.datasetRevision) },
    server: { host: '127.0.0.1', cors: false },
    preview: { host: '127.0.0.1', cors: false },
  };
});
