import { promises as fs } from 'node:fs';
import { fileExists } from './fs';
import { formatJson } from './json';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 在 package.json 对象上设置 name 字段，供初始化流程复用。
 */
export function applyPackageNameField<T extends Record<string, unknown>>(packageObject: T, enforcedName?: string): T {
  if (!isNonEmptyString(enforcedName)) {
    return packageObject;
  }

  return {
    ...packageObject,
    name: enforcedName,
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
