import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['tests/**/*.test.{ts,tsx}'],
  coverage: { provider: 'v8', include: ['src/**/*.{ts,tsx}'], exclude: ['src/ui/main.tsx', 'src/server/index.ts'],
    thresholds: { lines: 80, statements: 80, branches: 80, functions: 80 } },
} });
