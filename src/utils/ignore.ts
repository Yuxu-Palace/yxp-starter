/**
 * 解析 .yxpignore，提供 gitignore 风格的忽略能力。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import type { IgnoreMatcher } from '../core/update/types.js';
import { fileExists } from './fs.js';
import { toPosixPath } from './path.js';

/**
 * Create a matcher from a .yxpignore file in the given directory.
 *
 * If a .yxpignore file is present, the matcher evaluates paths against its patterns; otherwise the matcher allows everything.
 *
 * @returns An object with:
 * - `ignores(relativePath: string, isDirectory?: boolean)` — `true` if the given relative path is matched by the .yxpignore rules, `false` otherwise. Directory checks test both the path with a trailing slash and without. A falsy `relativePath` always yields `false`.
 * - `hasPatterns` — `true` if the .yxpignore file contains any non-whitespace content, `false` otherwise.
 */
export async function createIgnoreMatcher(
  currentDir: string,
): Promise<{ ignores: IgnoreMatcher; hasPatterns: boolean }> {
  const ignoreFilePath = path.join(currentDir, '.yxpignore');

  if (!(await fileExists(ignoreFilePath))) {
    return {
      ignores: () => false,
      hasPatterns: false,
    };
  }

  const rawContent = await fs.readFile(ignoreFilePath, 'utf-8');
  const hasPatterns = rawContent.trim().length > 0;
  const ignoreEngine = ignore();
  ignoreEngine.add(rawContent);

  return {
    // 目录需要同时测试 `path/` 与 `path`，以适配 ignore 的规则。
    ignores: (relativePath: string, isDirectory = false) => {
      if (!relativePath) {
        return false;
      }

      const normalized = toPosixPath(relativePath);
      if (isDirectory) {
        return ignoreEngine.ignores(`${normalized}/`) || ignoreEngine.ignores(normalized);
      }

      return ignoreEngine.ignores(normalized);
    },
    hasPatterns,
  };
}
