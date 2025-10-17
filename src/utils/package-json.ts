/**
 * 处理 package.json 的读取、格式化与清理逻辑。
 */

import { promises as fs } from 'node:fs';
import { fileExists } from './fs';
import { formatJson } from './json';

/**
 * 判断值是否为非空字符串。
 */
function isNotEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * 在解析后的 package.json 对象上按需覆盖指定字段。
 */
export function applyPackageField<T extends Record<string, unknown>, K extends PropertyKey>(
  packageObject: T,
  key: K,
  value: unknown,
): T & Record<K, unknown> {
  return {
    ...packageObject,
    [key]: value,
  } as T & Record<K, unknown>;
}

/**
 * 按需更新 package.json 的 name 字段。
 */
export function applyPackageNameField<T extends Record<string, unknown>>(packageObject: T, enforcedName?: string): T {
  if (!isNotEmptyString(enforcedName)) {
    return packageObject;
  }

  return applyPackageField(packageObject, 'name', enforcedName);
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
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return formatJson(applyPackageNameField(parsed, enforcedName));
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
