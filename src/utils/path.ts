/**
 * 处理跨平台路径差异。
 */

import path from 'node:path';

/**
 * Convert a filesystem path to POSIX-style by replacing platform-specific separators with `/`.
 *
 * @param filePath - The path to convert.
 * @returns The input path with all platform separators replaced by `/`.
 */
export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}