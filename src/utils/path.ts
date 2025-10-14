/**
 * 路径处理工具
 * 处理跨平台路径问题，特别是 Windows 和 POSIX 系统的差异
 */

import path from 'node:path';

/**
 * 将平台特定的文件路径转换为 POSIX 格式
 *
 * 这对于跨平台的 ignore 模式匹配至关重要：
 * - ignore 库期望 POSIX 风格的路径（使用 / 作为分隔符）
 * - Windows 使用反斜杠 \，而 POSIX 系统使用正斜杠 /
 *
 * @param filePath - 平台特定的文件路径
 * @returns POSIX 格式的路径
 */
export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
