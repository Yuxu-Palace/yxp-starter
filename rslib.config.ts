import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: {
        distPath: './bin',
      },
    },
  ],
  source: {
    entry: {
      index: ['./src/**'],
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
