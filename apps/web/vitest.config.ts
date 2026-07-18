import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 15_000,
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@Ordio/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@Ordio/engine': path.resolve(__dirname, '../../packages/engine/src'),
    },
  },
});
