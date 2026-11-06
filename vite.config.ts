import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';
import { loadRelease } from './src/intake/files.ts';

export default defineConfig(async () => {
  // This gate also runs on a direct vite build, not just the npm wrapper.
  const bundle = await loadRelease(fileURLToPath(new URL('./', import.meta.url)));
  return {
    plugins: [react(), cloudflare()],
    define: { __DATASET_REVISION__: JSON.stringify(bundle.datasetRevision) },
    server: { host: '127.0.0.1', cors: false },
    preview: { host: '127.0.0.1', cors: false },
  };
});
