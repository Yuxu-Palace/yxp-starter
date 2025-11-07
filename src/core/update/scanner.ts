import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileExists } from '../../utils/fs';
import type { FileUpdate, IgnoreMatcher } from './types';

/**
 * 扫描模板目录并收集需要同步的文件。
 */
export async function scanTemplateFiles(templatesDir: string, shouldIgnore: IgnoreMatcher): Promise<FileUpdate[]> {
  const files: FileUpdate[] = [];
  await scanDirectory(templatesDir, templatesDir, files, shouldIgnore);
  return files;
}

/**
 * 递归扫描模板目录。
 */
async function scanDirectory(
  dirPath: string,
  basePath: string,
  files: FileUpdate[],
  shouldIgnore: IgnoreMatcher,
): Promise<void> {
  const directoryEntries = await fs.readdir(dirPath, { withFileTypes: true });

  for (let index = 0; index < directoryEntries.length; ++index) {
    const entry = directoryEntries[index];

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
 * 把扫描到的文件写入结果列表。
 */
function processScannedFile(files: FileUpdate[], relativePath: string): void {
  files.push({
    path: relativePath,
    description: `Template file: ${relativePath}`,
  });
}

/**
 * 提取模板文件的顶级目录，限定项目扫描范围。
 */
export function getTopLevelEntries(files: FileUpdate[]): Set<string> {
  const entries = new Set<string>();

  for (let index = 0; index < files.length; ++index) {
    const file = files[index];
    const [topLevel] = file.path.split(path.sep);
    entries.add(topLevel ?? file.path);
  }

  return entries;
}

/**
 * 扫描项目中与模板顶级目录对应的文件。
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
 * 递归扫描项目目录。
 */
async function scanProjectDirectory(
  dirPath: string,
  basePath: string,
  files: Set<string>,
  shouldIgnore: IgnoreMatcher,
): Promise<void> {
  const directoryEntries = await fs.readdir(dirPath, { withFileTypes: true });

  for (let index = 0; index < directoryEntries.length; ++index) {
    const entry = directoryEntries[index];

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
