/**
 * 提供 gitignore 风格的忽略能力。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { IGNORED_FILE_NAME } from '../core/update/constants.ts';
import type { IgnoreMatcher } from '../core/update/types.ts';
import { fileExists } from './fs.ts';
import { toPosixPath } from './path.ts';

/**
 * 构造忽略匹配器，不存在时返回总是允许的匹配器。
 */
export async function createIgnoreMatcher(
  currentDir: string,
): Promise<{ ignores: IgnoreMatcher; hasPatterns: boolean }> {
  const ignoreFilePath = path.join(currentDir, IGNORED_FILE_NAME);

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
      return ignoreEngine.ignores(normalized) || (isDirectory && ignoreEngine.ignores(`${normalized}/`));
    },
    hasPatterns,
  };
}
