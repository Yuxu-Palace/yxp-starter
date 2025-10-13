import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rslib/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  lib: [
    {
      format: 'esm',
      dts: true,
      output: {
        cleanDistPath: true,
        distPath: { root: path.resolve(__dirname, 'dist/esm') },
      },
    },
    {
      format: 'cjs',
      dts: {
        autoExtension: true,
      },
      output: {
        cleanDistPath: true,
        distPath: { root: path.resolve(__dirname, 'dist/cjs') },
      },
    },
  ],
});
