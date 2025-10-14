/**
 * package.json 文件处理工具
 * 提供 package.json 的读取、格式化和标准化功能
 */

import { promises as fs } from 'node:fs';
import { JSON_INDENT_SPACES, JSON_TRAILING_NEWLINE } from '../core/update/constants.js';
import { fileExists } from './fs.js';

/**
 * 验证 package name 是否有效
 * 使用类型谓词来缩小类型范围
 */
export function isValidPackageName(name: string | undefined): name is string {
  return typeof name === 'string' && name.length > 0;
}

/**
 * 格式化 package.json 对象为标准字符串
 *
 * 使用统一的格式化规则确保：
 * 1. 与 npm/pnpm 的标准输出一致
 * 2. 避免因格式差异导致的虚假 diff
 */
export function formatPackageJson(packageObject: unknown): string {
  const serialized = JSON.stringify(packageObject, null, JSON_INDENT_SPACES);
  return serialized + JSON_TRAILING_NEWLINE;
}

/**
 * 从 package.json 字符串中解析出项目名
 * @param content - package.json 文件内容
 * @returns 项目名称，解析失败返回 undefined
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
 * 对 package.json 内容进行标准化处理
 *
 * 主要用途：
 * 1. 统一格式化，避免空格/换行差异导致的误报
 * 2. 可选地强制设置项目名称（用于模板 → 项目的比较）
 *
 * @param content - 原始 JSON 字符串
 * @param enforcedName - 强制使用的包名（用于忽略模板和项目的名称差异）
 * @returns 标准化后的 JSON 字符串，如果解析失败则返回原内容
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
 * 获取目标 package.json 的项目名称
 *
 * 用于在更新 package.json 时保留项目自身的名称，
 * 避免被模板的 name 字段覆盖
 *
 * @param targetPath - package.json 文件路径
 * @returns 项目名称，如果文件不存在或解析失败则返回空字符串
 */
export async function getTargetPackageName(targetPath: string): Promise<string> {
  if (!(await fileExists(targetPath))) {
    return '';
  }

  const targetRaw = await fs.readFile(targetPath, 'utf-8');
  return getPackageName(targetRaw) ?? '';
}
