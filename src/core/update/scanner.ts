import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileExists } from '@/utils/fs';
import type { FileUpdate, IgnoreMatcher } from './types';
import { MissingFileManifestError } from './types';

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
 * 扫描项目中记录的模板文件。
 * 只扫描 recordedFiles 清单中的文件（精准模式）。
 */
export async function scanProjectFiles(currentDir: string, recordedFiles?: string[]): Promise<Set<string>> {
  const results = new Set<string>();

  // 必须提供文件清单，否则无法准确区分模板文件和业务文件
  if (!recordedFiles || recordedFiles.length === 0) {
    throw new MissingFileManifestError();
  }

  // 只扫描清单中记录的文件
  for (let index = 0; index < recordedFiles.length; ++index) {
    const filePath = recordedFiles[index];
    const fullPath = path.join(currentDir, filePath);
    if (await fileExists(fullPath)) {
      results.add(filePath);
    }
  }

  return results;
}
