/**
 * 处理跨平台路径差异。
 */

import path from 'node:path';

/**
 * 将平台路径转换为 POSIX 风格，方便 ignore 匹配。
 */
export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
