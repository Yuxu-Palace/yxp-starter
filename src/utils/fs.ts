import { promises as fs } from 'node:fs';
import path from 'node:path';

// 二进制检测时采样的最大字节数，用于兼顾准确度与性能。
const BINARY_SAMPLE_SIZE = 4096;

/**
 * Detects whether a Buffer likely contains binary data.
 *
 * An empty buffer is considered not binary. The function examines up to the first
 * 4096 bytes and flags the buffer as binary when it encounters a NUL byte or when
 * more than 30% of sampled bytes are outside common printable ASCII/control ranges.
 *
 * @param buffer - The Buffer to inspect for binary content
 * @returns `true` if the buffer is considered binary, `false` otherwise.
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
 * Read a file and provide its content in a form appropriate for text or binary files.
 *
 * @returns An object with the raw file `Buffer` in `raw`, a `content` property that is a decoded UTF-8 `string` for text files or the raw `Buffer` for binary files, and an `isBinary` boolean indicating which form `content` holds.
 */
export async function readFileContent(filePath: string): Promise<FileReadResult> {
  const buffer = await fs.readFile(filePath);
  if (isBinaryBuffer(buffer)) {
    return { raw: buffer, content: buffer, isBinary: true };
  }

  return { raw: buffer, content: buffer.toString('utf-8'), isBinary: false };
}

/**
 * Recursively copy the contents of one directory to another, preserving the directory structure.
 *
 * @param src - Path of the source directory to copy from
 * @param dest - Path of the destination directory to copy into; parent directories will be created as needed
 */
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

/**
 * Checks whether a filesystem path exists and is accessible.
 *
 * @param filePath - Path to the file or directory to check
 * @returns `true` if the path exists and is accessible, `false` otherwise
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a JSON file from disk.
 *
 * @param filePath - Path to the JSON file.
 * @returns The parsed JSON value typed as `T`.
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Write a value to a file as formatted JSON using two-space indentation and a trailing newline.
 *
 * Serializes `data` to JSON with 2-space indentation, appends a newline, and overwrites or creates `filePath`.
 *
 * @param filePath - Destination filesystem path for the JSON file
 * @param data - The value to serialize to JSON
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}