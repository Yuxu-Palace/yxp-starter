import { promises as fs } from 'node:fs';
import path from 'node:path';

// 二进制检测时采样的最大字节数，用于兼顾准确度与性能。
const BINARY_SAMPLE_SIZE = 4096;

/**
 * 粗略判断 Buffer 是否包含大量非文本字符，用于识别二进制文件。
 */
function isBinaryBuffer(buffer: Buffer): boolean {
  const length = buffer.length;
  if (length === 0) {
    return false;
  }

  // 仅取前若干字节做采样，避免大文件全量扫描。
  const sampleSize = Math.min(length, BINARY_SAMPLE_SIZE);
  let suspicious = 0;

  for (let index = 0; index < sampleSize; index += 1) {
    const byte = buffer[index];
    if (byte === 0) {
      return true;
    }
    if (byte < 7 || (byte > 13 && byte < 32) || byte > 126) {
      suspicious += 1;
      if (suspicious / sampleSize > 0.3) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 读取文件内容，同时返回原始 Buffer，方便后续字节级比较。
 */
export type FileReadResult =
  | { raw: Buffer; content: string; isBinary: false }
  | { raw: Buffer; content: Buffer; isBinary: true };

/**
 * 根据文件类型返回字符串或 Buffer，避免误把二进制内容当作文本。
 */
export async function readFileContent(filePath: string): Promise<FileReadResult> {
  const buffer = await fs.readFile(filePath);
  if (isBinaryBuffer(buffer)) {
    return { raw: buffer, content: buffer, isBinary: true };
  }

  return { raw: buffer, content: buffer.toString('utf-8'), isBinary: false };
}

/**
 * 递归复制目录，保持原有结构。
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * 检查文件是否存在，使用 access 避免抛出异常。
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
