import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: true,
    },
  ],
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  output: {
    distPath: {
      root: 'bin',
      js: './',
      jsAsync: './',
    },
    cleanDistPath: true,
  },
});
