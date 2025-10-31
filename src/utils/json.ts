import { promises as fs } from 'node:fs';
import { JSON_INDENT_SPACES, JSON_TRAILING_NEWLINE } from '../core/update/constants';
/**
 * 将任意对象序列化为统一缩进和换行的 JSON 字符串。
 */
export function formatJson(
  payload: unknown,
  options: {
    indentSpaces?: number;
    trailingNewline?: string;
  } = {
    indentSpaces: JSON_INDENT_SPACES,
    trailingNewline: JSON_TRAILING_NEWLINE,
  },
): string {
  const indentSpaces = options.indentSpaces ?? JSON_INDENT_SPACES;
  const trailingNewline = options.trailingNewline ?? JSON_TRAILING_NEWLINE;
  const serialized = JSON.stringify(payload, null, indentSpaces);
  return serialized + trailingNewline;
}

/**
 * 读取 JSON 文件并反序列化。
 */
export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * 以统一的缩进与换行格式写入 JSON。
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, formatJson(data));
}
