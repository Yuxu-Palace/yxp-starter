/**
 * 处理跨平台路径差异与运行时路径解析。
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = resolvePackageRoot();
const TEMPLATES_ROOT = path.join(PACKAGE_ROOT, 'templates');

/**
 * 将平台路径转换为 POSIX 风格，方便 ignore 匹配。
 */
export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

/** 获取当前包的根目录。 */
export function getPackageRoot(): string {
  return PACKAGE_ROOT;
}

/** 获取模板目录的绝对路径。 */
export function getTemplatesRoot(): string {
  return TEMPLATES_ROOT;
}

function resolvePackageRoot(): string {
  const candidates = compact([moduleDirname(), cliDirname(), process.cwd()]);

  for (let index = 0; index < candidates.length; index += 1) {
    const startDir = candidates[index];
    const resolved = findUpwards(startDir, 'package.json');
    if (resolved) {
      return resolved;
    }
  }

  // 回退至当前模块目录，至少保证路径可用。
  return moduleDirname();
}

function moduleDirname(): string {
  const filename = fileURLToPath(import.meta.url);
  return path.dirname(filename);
}

function cliDirname(): string | undefined {
  if (!process.argv[1]) {
    return;
  }
  return path.dirname(process.argv[1]);
}

function compact<T>(values: (T | undefined | null)[]): T[] {
  const filtered: T[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value) {
      filtered.push(value);
    }
  }
  return filtered;
}

function findUpwards(startDir: string, targetName: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, targetName);
    if (existsSync(candidate)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}
