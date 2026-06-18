import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@wc2026/shared': path.resolve(__dirname, '../shared/src/types.ts'),
    },
  },
  test: {
    globals: true,
  },
});
