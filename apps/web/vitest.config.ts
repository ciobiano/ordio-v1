import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * Vite plugin that rewrites `jest.mock(` → `vi.mock(` and `jest.fn(` → `vi.fn(`
 * in test files only, so that tests written with Jest-style syntax work correctly
 * under Vitest (vi.mock is hoisted; jest.mock is not).
 */
function jestCompatPlugin(): Plugin {
  return {
    name: 'vitest:jest-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('__tests__') && !id.includes('.test.') && !id.includes('.spec.')) {
        return null;
      }
      const transformed = code
        .replace(/\bjest\.mock\(/g, 'vi.mock(')
        .replace(/\bjest\.fn\(/g, 'vi.fn(')
        .replace(/\bjest\.spyOn\(/g, 'vi.spyOn(')
        .replace(/\bjest\.Mock\b/g, 'import("vitest").Mock')
        .replace(/as jest\.Mock\b/g, 'as ReturnType<typeof vi.fn>');
      if (transformed !== code) {
        return { code: transformed, map: null };
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [react(), jestCompatPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@Ordio/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
