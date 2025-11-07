import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore from 'ignore';
import { DEFAULT_UPDATE_IGNORE_PATTERNS, IGNORED_FILE_NAME } from '../core/update/constants';
import type { IgnoreMatcher } from '../core/update/types';
import { fileExists } from './fs';
import { toPosixPath } from './path';
import { type LoadedYxpConfig, loadYxpConfig, normalizeStringArray } from './yxp-config';

/**
 * 构造忽略匹配器，不存在忽略文件时返回总是允许的匹配器。
 */
export async function createIgnoreMatcher(
  currentDir: string,
  externalConfig?: LoadedYxpConfig | null,
): Promise<{ ignores: IgnoreMatcher; sources: string[] }> {
  const ignoreFilePath = path.join(currentDir, IGNORED_FILE_NAME);
  const ignoreEngine = ignore();
  const sources: string[] = [];

  if (DEFAULT_UPDATE_IGNORE_PATTERNS.length > 0) {
    ignoreEngine.add(DEFAULT_UPDATE_IGNORE_PATTERNS);
  }

  if (await fileExists(ignoreFilePath)) {
    const rawContent = await fs.readFile(ignoreFilePath, 'utf-8');
    if (rawContent.trim().length > 0) {
      ignoreEngine.add(rawContent);
      sources.push(IGNORED_FILE_NAME);
    }
  }

  const loadedConfig = externalConfig ?? (await loadYxpConfig(currentDir));
  if (loadedConfig?.config.update) {
    const { ignore: configIgnore, include: configInclude } = loadedConfig.config.update;
    const normalizedIgnore = normalizeStringArray(configIgnore);
    const normalizedInclude = normalizeStringArray(configInclude);

    if (normalizedIgnore.length > 0) {
      ignoreEngine.add(normalizedIgnore);
    }
    if (normalizedInclude.length > 0) {
      const includePatterns = normalizedInclude.map((pattern) => (pattern.startsWith('!') ? pattern : `!${pattern}`));
      ignoreEngine.add(includePatterns);
    }

    if (normalizedIgnore.length > 0 || normalizedInclude.length > 0) {
      sources.push(path.basename(loadedConfig.filePath));
    }
  }

  return {
    // 目录需要同时测试 `path/` 与 `path`，以适配 ignore 的规则。
    ignores: (relativePath: string, isDirectory = false) => {
      if (!relativePath) {
        return false;
      }

      const normalized = toPosixPath(relativePath);
      return ignoreEngine.ignores(normalized) || (isDirectory && ignoreEngine.ignores(`${normalized}/`));
    },
    sources,
  };
}
