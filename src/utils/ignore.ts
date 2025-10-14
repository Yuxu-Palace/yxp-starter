/**
 * 文件忽略规则处理
 * 基于 .yxpignore 文件的 gitignore 风格的文件忽略功能
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import type { IgnoreMatcher } from '../core/update/types.js';
import { fileExists } from './fs.js';
import { toPosixPath } from './path.js';

/**
 * 创建文件忽略规则匹配器
 *
 * 从 .yxpignore 文件加载忽略规则（类似 .gitignore 格式）。
 * 如果文件不存在或为空，返回一个接受所有文件的匹配器。
 *
 * @param currentDir - 当前目录路径
 * @returns 包含匹配函数和是否有有效模式的对象
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
    // 目录路径需要特殊处理：测试 "path/" 和 "path" 两种形式
    // 因为 ignore 库对目录的匹配规则有特殊要求
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
