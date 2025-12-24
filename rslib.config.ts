import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2022',
      bundle: true,
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
  output: {
    distPath: {
      root: 'bin',
    },
    filename: {
      js: '[name].cjs',
    },
    cleanDistPath: true,
  },
});
