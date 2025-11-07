import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileExists } from './fs';

const CONFIG_FILE_CANDIDATES = ['yxp.config.js', 'yxp.config.cjs', 'yxp.config.mjs'];

export interface UpdatePackageJsonConfig {
  preserve?: string[];
}

export interface JsonFileRuleConfig {
  preserve?: string[];
}

export interface UpdateRuleConfig {
  ignore?: string[];
  include?: string[];
  skipDynamic?: string[];
  jsonFiles?: Record<string, JsonFileRuleConfig | null | undefined>;
}

export interface YxpConfig {
  update?: UpdateRuleConfig;
}

export interface LoadedYxpConfig {
  filePath: string;
  config: YxpConfig;
}

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => item.length > 0);
}

function normalizeConfigPath(filePath: string): string {
  if (!filePath) {
    return '';
  }

  const trimmed = filePath.trim().replace(/^\.\//, '');
  return trimmed.replace(/\\/g, '/');
}

function mergePreserveFields(target: Record<string, string[]>, filePath: string, fields: string[]): void {
  if (!filePath || fields.length === 0) {
    return;
  }

  const normalizedPath = normalizeConfigPath(filePath);
  if (!normalizedPath) {
    return;
  }

  const existing = new Set(target[normalizedPath] ?? []);
  for (const field of fields) {
    existing.add(field);
  }
  target[normalizedPath] = Array.from(existing);
}

/**
 * 构建 JSON 文件字段保留规则映射，始终包含 package.json:name。
 */
export function buildJsonPreserveMap(updateConfig?: UpdateRuleConfig): Record<string, string[]> {
  const preserveMap: Record<string, string[]> = {
    'package.json': ['name'],
  };

  if (!updateConfig) {
    return preserveMap;
  }

  if (updateConfig.jsonFiles) {
    for (const [filePath, rule] of Object.entries(updateConfig.jsonFiles)) {
      if (!rule) {
        continue;
      }
      mergePreserveFields(preserveMap, filePath, normalizeStringArray(rule.preserve));
    }
  }

  return preserveMap;
}

/**
 * 动态加载 yxp.config.*，若不存在则返回 null。
 */
export async function loadYxpConfig(rootDir: string): Promise<LoadedYxpConfig | null> {
  for (const fileName of CONFIG_FILE_CANDIDATES) {
    const configPath = path.join(rootDir, fileName);
    if (!(await fileExists(configPath))) {
      continue;
    }

    try {
      const loadedModule = await import(pathToFileURL(configPath).href);
      const exportedConfig = (loadedModule?.default ?? loadedModule) as unknown;

      if (!exportedConfig || typeof exportedConfig !== 'object') {
        throw new Error(`Expected ${fileName} to export a configuration object.`);
      }

      return {
        filePath: configPath,
        config: exportedConfig as YxpConfig,
      };
    } catch (error) {
      throw new Error(`Failed to load ${fileName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return null;
}
