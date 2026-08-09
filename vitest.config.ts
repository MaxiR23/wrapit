import { join } from 'node:path';

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      // Must match the "@/*" path in tsconfig.json.
      '@': join(import.meta.dirname, 'src'),
    },
  },
});
