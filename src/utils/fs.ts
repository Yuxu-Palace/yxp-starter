import { promises as fs } from 'node:fs';
import path from 'node:path';

// 二进制检测时采样的最大字节数，平衡准确度与性能。
const BINARY_SAMPLE_SIZE = 4096;

// 粗略判断 Buffer 是否包含大量非文本字符，用于识别二进制文件。
function isBinaryBuffer(buffer: Buffer): boolean {
  const length = buffer.length;
  if (length === 0) {
    return false;
  }

  // 只取前若干字节做采样，避免大文件全量扫描。
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

// 读取文件内容，同时返回原始 Buffer，方便后续进行字节级比较。
export type FileReadResult =
  | { raw: Buffer; content: string; isBinary: false }
  | { raw: Buffer; content: Buffer; isBinary: true };

// 根据文件类型返回字符串或 Buffer，避免二进制内容被误当作文本处理。
export async function readFileContent(filePath: string): Promise<FileReadResult> {
  const buffer = await fs.readFile(filePath);
  if (isBinaryBuffer(buffer)) {
    return { raw: buffer, content: buffer, isBinary: true };
  }

  return { raw: buffer, content: buffer.toString('utf-8'), isBinary: false };
}

// 递归复制目录，保持原有结构。
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// 检查文件是否存在，使用 access 避免抛出异常。
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// 读取 JSON 并反序列化为泛型结果。
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

// 格式化写入 JSON，统一缩进与换行。
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
