/**
 * 扫描模板与项目文件，用于后续差异分析。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileExists } from '../../utils/fs.js';
import { IGNORED_PROJECT_ENTRIES, IGNORED_TEMPLATE_ENTRIES } from './constants.js';
import type { FileUpdate, IgnoreMatcher } from './types.js';

/**
 * Recursively scans a templates directory and collects template files that should be considered for synchronization.
 *
 * @param templatesDir - Root templates directory to scan; result paths are relative to this directory.
 * @param shouldIgnore - Predicate called with `(relativePath, isDirectory)` that returns `true` for paths to ignore.
 * @returns An array of `FileUpdate` entries describing each template file to consider for synchronization.
 */
export async function scanTemplateFiles(templatesDir: string, shouldIgnore: IgnoreMatcher): Promise<FileUpdate[]> {
  const files: FileUpdate[] = [];
  await scanDirectory(templatesDir, templatesDir, files, shouldIgnore);
  return files;
}

/**
 * Recursively scans a template directory and adds non-ignored files to the provided FileUpdate accumulator.
 *
 * @param dirPath - Absolute path of the directory to scan
 * @param basePath - Base path used to compute each file's relative path that will be stored in the accumulator
 * @param files - Accumulator array that will receive FileUpdate entries for discovered template files
 * @param shouldIgnore - Predicate called as `shouldIgnore(relativePath, isDirectory)`; if it returns `true` the entry is skipped
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
 * Determines whether a single template directory entry should be skipped.
 *
 * @param entryName - The directory or file name at the template root to check
 * @returns `true` if the entry is present in the set of ignored template entries, `false` otherwise
 */
function shouldSkipTemplateEntry(entryName: string): boolean {
  return IGNORED_TEMPLATE_ENTRIES.has(entryName);
}

/**
 * Append a scanned template file entry to the results list.
 *
 * @param files - Array to receive the new FileUpdate entry
 * @param relativePath - Path of the scanned file relative to the templates root
 */
function processScannedFile(files: FileUpdate[], relativePath: string): void {
  files.push({
    path: relativePath,
    description: `Template file: ${relativePath}`,
  });
}

/**
 * Build a set of top-level path segments from a list of template file entries.
 *
 * Each FileUpdate's `path` is split by the platform path separator and the first
 * segment is added to the returned set; if a path has no separator, the full
 * path is used as the top-level entry.
 *
 * @param files - Array of FileUpdate objects whose `path` fields are relative paths
 * @returns A Set containing the top-level directory or file name for each entry in `files`
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
 * Collects project file paths that correspond to the template set's top-level entries.
 *
 * @param currentDir - Root directory of the project to scan; returned paths are relative to this directory
 * @param templateFiles - Template file descriptors used to derive top-level entries to check in the project
 * @param shouldIgnore - Predicate called as `(relativePath, isDirectory)` that returns `true` for paths to skip
 * @returns A Set of relative paths (relative to `currentDir`) that exist in the project and match the template top-level entries
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
 * Recursively scans a project directory and adds relative file paths for non-ignored files to `files`.
 *
 * @param dirPath - Absolute path of the directory to scan
 * @param basePath - Base path used to compute each file's relative path before adding to `files`
 * @param files - Set that will be populated with relative file paths found under `dirPath`
 * @param shouldIgnore - Function that determines whether a path should be ignored; called as `shouldIgnore(relativePath, isDirectory)`
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
 * Determines whether a project directory entry should be skipped.
 *
 * @param entryName - The name of the directory entry (file or folder)
 * @returns `true` if `entryName` is listed in `IGNORED_PROJECT_ENTRIES`, `false` otherwise
 */
function shouldSkipProjectEntry(entryName: string): boolean {
  return IGNORED_PROJECT_ENTRIES.has(entryName);
}
