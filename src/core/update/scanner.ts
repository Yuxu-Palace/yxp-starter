/**
 * 文件系统扫描模块
 * 负责遍历模板和项目目录，收集文件列表
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileExists } from '../../utils/fs.js';
import { IGNORED_PROJECT_ENTRIES, IGNORED_TEMPLATE_ENTRIES } from './constants.js';
import type { FileUpdate, IgnoreMatcher } from './types.js';

/**
 * 扫描模板目录，收集所有需要同步的文件
 *
 * @param templatesDir - 模板目录路径
 * @param shouldIgnore - 忽略规则匹配器
 * @returns 模板文件列表
 */
export async function scanTemplateFiles(templatesDir: string, shouldIgnore: IgnoreMatcher): Promise<FileUpdate[]> {
  const files: FileUpdate[] = [];
  await scanDirectory(templatesDir, templatesDir, files, shouldIgnore);
  return files;
}

/**
 * 递归遍历目录并记录文件路径
 */
async function scanDirectory(
  dirPath: string,
  basePath: string,
  files: FileUpdate[],
  shouldIgnore: IgnoreMatcher,
): Promise<void> {
  const directoryEntries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of directoryEntries) {
    if (shouldSkipTemplateEntry(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      if (shouldIgnore(relativePath, true)) {
        continue;
      }
      await scanDirectory(fullPath, basePath, files, shouldIgnore);
      continue;
    }

    if (entry.isFile() && !shouldIgnore(relativePath, false)) {
      processScannedFile(files, relativePath);
    }
  }
}

/**
 * 检查目录项是否应该被跳过
 */
function shouldSkipTemplateEntry(entryName: string): boolean {
  return IGNORED_TEMPLATE_ENTRIES.has(entryName);
}

/**
 * 处理目录扫描中的单个文件
 */
function processScannedFile(files: FileUpdate[], relativePath: string): void {
  files.push({
    path: relativePath,
    description: `Template file: ${relativePath}`,
  });
}

/**
 * 提取模板文件的顶级目录
 *
 * 用于限定项目扫描范围，只扫描与模板相关的目录
 *
 * @param files - 模板文件列表
 * @returns 顶级目录名集合
 */
export function getTopLevelEntries(files: FileUpdate[]): Set<string> {
  const entries = new Set<string>();

  for (const file of files) {
    const [topLevel] = file.path.split(path.sep);
    entries.add(topLevel ?? file.path);
  }

  return entries;
}

/**
 * 按模板目录，扫描项目中待对齐的文件并收集路径
 *
 * 只扫描与模板顶级目录对应的项目目录
 *
 * @param currentDir - 当前项目目录
 * @param templateFiles - 模板文件列表
 * @param shouldIgnore - 忽略规则匹配器
 * @returns 项目文件路径集合
 */
export async function scanProjectFiles(
  currentDir: string,
  templateFiles: FileUpdate[],
  shouldIgnore: IgnoreMatcher,
): Promise<Set<string>> {
  const results = new Set<string>();
  const topLevelEntries = getTopLevelEntries(templateFiles);

  for (const entry of topLevelEntries) {
    const projectPath = path.join(currentDir, entry);

    if (!(await fileExists(projectPath))) {
      continue;
    }

    const stats = await fs.lstat(projectPath);

    if (stats.isDirectory()) {
      if (shouldIgnore(entry, true)) {
        continue;
      }
      await scanProjectDirectory(projectPath, currentDir, results, shouldIgnore);
    } else if (stats.isFile()) {
      if (shouldIgnore(entry, false)) {
        continue;
      }
      results.add(entry);
    }
  }

  return results;
}

/**
 * 递归记录项目目录中的文件路径
 */
async function scanProjectDirectory(
  dirPath: string,
  basePath: string,
  files: Set<string>,
  shouldIgnore: IgnoreMatcher,
): Promise<void> {
  const directoryEntries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of directoryEntries) {
    if (shouldSkipProjectEntry(entry.name)) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    if (entry.isDirectory()) {
      if (shouldIgnore(relativePath, true)) {
        continue;
      }
      await scanProjectDirectory(fullPath, basePath, files, shouldIgnore);
      continue;
    }

    if (entry.isFile() && !shouldIgnore(relativePath, false)) {
      files.add(relativePath);
    }
  }
}

/**
 * 检查项目目录项是否应该被跳过
 */
function shouldSkipProjectEntry(entryName: string): boolean {
  return IGNORED_PROJECT_ENTRIES.has(entryName);
}
