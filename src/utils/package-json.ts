import { promises as fs } from 'node:fs';
import { fileExists } from './fs';
import { formatJson } from './json';

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

  const preservedEntries: Record<string, unknown> = {};
  for (let index = 0; index < fieldsToPreserve.length; ++index) {
    const field = fieldsToPreserve[index];
    if (typeof field !== 'string' || field.length === 0) {
      continue;
    }

    if (Object.hasOwn(targetObject, field)) {
      preservedEntries[field] = targetObject[field];
    }
  }

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
 * 解析 JSON 内容中的指定字段。
 */
export async function readJsonFileFields(targetPath: string, fields: string[]): Promise<Record<string, unknown>> {
  if (!(await fileExists(targetPath))) {
    return {};
  }

  try {
    const targetRaw = await fs.readFile(targetPath, 'utf-8');
    return extractFieldsFromJsonContent(targetRaw, fields);
  } catch {
    return {};
  }
}

export function extractFieldsFromJsonContent(content: string, fields: string[]): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const field of fields) {
      if (Object.hasOwn(parsed, field)) {
        result[field] = parsed[field];
      }
    }
    return result;
  } catch {
    return {};
  }
}
