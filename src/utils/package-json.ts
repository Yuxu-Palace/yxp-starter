import { fileExists } from './fs';
import { formatJson, readJsonFile } from './json';

/**
 * 从对象中挑选指定的键，返回新对象。
 */
export function pickFields<T extends Record<string, unknown>>(
  obj: T,
  keys: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * 保留指定的 package.json 字段，返回新的对象副本。
 */
export function preservePackageFields<T extends Record<string, unknown>>(
  sourceObject: T,
  targetObject: Record<string, unknown> | undefined,
  fieldsToPreserve: readonly string[],
): T {
  if (!Array.isArray(fieldsToPreserve) || fieldsToPreserve.length === 0 || !targetObject) {
    return sourceObject;
  }

  const preservedEntries = pickFields(targetObject, fieldsToPreserve);

  if (Object.keys(preservedEntries).length === 0) {
    return sourceObject;
  }

  return {
    ...sourceObject,
    ...preservedEntries,
  } as T;
}

/**
 * 将需保留的字段注入 JSON 字符串，保持模板与项目的一致性。
 */
export function applyPreservedJsonFields(content: string, preservedFields?: Record<string, unknown>): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (preservedFields) {
      for (const [key, value] of Object.entries(preservedFields)) {
        parsed[key] = value;
      }
    }
    return formatJson(parsed);
  } catch {
    return content;
  }
}

/**
 * 读取 JSON 文件并提取指定字段。
 */
export async function readJsonFileFields(targetPath: string, fields: string[]): Promise<Record<string, unknown>> {
  if (!(await fileExists(targetPath))) {
    return {};
  }

  try {
    const parsed = await readJsonFile<Record<string, unknown>>(targetPath);
    return pickFields(parsed, fields);
  } catch {
    return {};
  }
}
