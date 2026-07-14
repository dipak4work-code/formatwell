import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Parser tests need no DOM — TextEncoder/performance exist in Node.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
