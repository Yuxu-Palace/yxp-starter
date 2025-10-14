/**
 * 处理 package.json 的读取、格式化与清理逻辑。
 */

import { promises as fs } from 'node:fs';
import { JSON_INDENT_SPACES, JSON_TRAILING_NEWLINE } from '../core/update/constants.js';
import { fileExists } from './fs.js';

/**
 * 验证 package name 是否有效，方便类型收窄。
 */
export function isValidPackageName(name: string | undefined): name is string {
  return typeof name === 'string' && name.length > 0;
}

/**
 * 按统一缩进与换行格式化 package.json。
 */
export function formatPackageJson(packageObject: unknown): string {
  const serialized = JSON.stringify(packageObject, null, JSON_INDENT_SPACES);
  return serialized + JSON_TRAILING_NEWLINE;
}

/**
 * 从 package.json 字符串中解析出项目名。
 */
export function getPackageName(content: string): string | undefined {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed.name === 'string' ? parsed.name : undefined;
  } catch {
    return;
  }
}

/**
 * 统一 package.json 内容，可选地覆盖项目名称。
 */
export function sanitizePackageJsonContent(content: string, enforcedName?: string): string {
  try {
    const parsed = JSON.parse(content);
    if (isValidPackageName(enforcedName)) {
      parsed.name = enforcedName;
    }
    return formatPackageJson(parsed);
  } catch {
    return content;
  }
}

/**
 * 读取项目自身的 package name，更新时用于保留名称。
 */
export async function getTargetPackageName(targetPath: string): Promise<string> {
  if (!(await fileExists(targetPath))) {
    return '';
  }

  const targetRaw = await fs.readFile(targetPath, 'utf-8');
  return getPackageName(targetRaw) ?? '';
}
