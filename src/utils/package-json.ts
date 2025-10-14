/**
 * 处理 package.json 的读取、格式化与清理逻辑。
 */

import { promises as fs } from 'node:fs';
import { JSON_INDENT_SPACES, JSON_TRAILING_NEWLINE } from '../core/update/constants.js';
import { fileExists } from './fs.js';

/**
 * Checks whether a value is a non-empty package name.
 *
 * @param name - Candidate package name to validate
 * @returns `true` if `name` is a string with length greater than zero, `false` otherwise.
 */
export function isValidPackageName(name: string | undefined): name is string {
  return typeof name === 'string' && name.length > 0;
}

/**
 * Serialize a package.json object to a consistently formatted JSON string.
 *
 * @param packageObject - The package.json value to serialize
 * @returns The JSON representation of `packageObject` using a fixed indentation and a trailing newline
 */
export function formatPackageJson(packageObject: unknown): string {
  const serialized = JSON.stringify(packageObject, null, JSON_INDENT_SPACES);
  return serialized + JSON_TRAILING_NEWLINE;
}

/**
 * Extracts the `name` field from package.json content.
 *
 * @param content - The raw JSON text of a package.json file
 * @returns The package name if present and a string, `undefined` otherwise
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
 * Normalize package.json content and optionally enforce a specific package name.
 *
 * @param content - The original package.json text to parse and format.
 * @param enforcedName - When provided and a valid package name, replaces the `name` field in the output.
 * @returns The formatted package.json string with standardized indentation and a trailing newline; if `content` is not valid JSON, returns the original `content` unchanged.
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
 * Retrieve the package name declared in the package.json at the provided path.
 *
 * @param targetPath - Filesystem path to the package.json file to read.
 * @returns The `name` value from the file, or an empty string if the file does not exist, the `name` is missing, or the file cannot be parsed.
 */
export async function getTargetPackageName(targetPath: string): Promise<string> {
  if (!(await fileExists(targetPath))) {
    return '';
  }

  const targetRaw = await fs.readFile(targetPath, 'utf-8');
  return getPackageName(targetRaw) ?? '';
}
