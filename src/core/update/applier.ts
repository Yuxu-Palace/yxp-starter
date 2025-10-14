/**
 * 将模板中的改动写入当前项目。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.js';
import { getTargetPackageName, sanitizePackageJsonContent } from '../../utils/package-json.js';
import { createProgressTracker } from '../../utils/progress.js';
import type { PendingUpdate } from './types.js';

/**
 * Apply a single pending file update to the target project filesystem.
 *
 * Handles deletion, package.json modifications, and regular file additions or updates.
 *
 * @param pending - The pending update describing the file path and operation kind (`add`/`update`/`delete`).
 * @param templatesDir - Filesystem path to the templates root used as the source for additions/updates.
 * @param currentDir - Filesystem path to the target project root where changes should be applied.
 */
export async function applyUpdate(pending: PendingUpdate, templatesDir: string, currentDir: string): Promise<void> {
  if (pending.kind === 'delete') {
    return applyFileDeletion(pending.file.path, currentDir);
  }

  const sourcePath = path.join(templatesDir, pending.file.path);
  const targetPath = path.join(currentDir, pending.file.path);

  if (pending.file.path === 'package.json') {
    return applyPackageJsonUpdate(pending, sourcePath, targetPath);
  }

  return applyRegularFileUpdate(pending, sourcePath, targetPath);
}

/**
 * Apply a sequence of pending file updates to a project while reporting per-file progress.
 *
 * @param updates - The ordered list of pending updates to apply
 * @param templatesDir - Path to the templates directory containing source files
 * @param currentDir - Path to the target project directory where updates will be applied
 */
export async function applyBatchUpdate(
  updates: PendingUpdate[],
  templatesDir: string,
  currentDir: string,
): Promise<void> {
  const progress = createProgressTracker(updates.length);

  for (let index = 0; index < updates.length; index += 1) {
    const pending = updates[index];

    if (index === 0) {
      await progress.start(pending.file.path);
    } else {
      await progress.next(pending.file.path);
    }

    await applyUpdate(pending, templatesDir, currentDir);
  }

  progress.finish();
}

/**
 * Remove the specified file from the project and remove any now-empty parent directories up to the project root.
 *
 * @param filePath - Path to the file to delete, relative to `currentDir`
 * @param currentDir - Project root directory that bounds cleanup (cleanup stops at this directory)
 */
async function applyFileDeletion(filePath: string, currentDir: string): Promise<void> {
  const targetPath = path.join(currentDir, filePath);
  await fs.rm(targetPath, { force: true });
  await cleanupEmptyDirs(path.dirname(targetPath), currentDir);
  logger.success(`✓ Deleted ${filePath}`);
}

/**
 * Update the target project's package.json from a template while preserving the project's existing package name.
 *
 * Reads package.json content from the template, replaces the `name` field with the current project's package name,
 * ensures the destination directory exists, writes the updated content to the target path, and logs the action.
 *
 * @param pending - The pending update describing the file change (used to determine whether the file was added or updated and to obtain the file path for logging)
 * @param sourcePath - Filesystem path to the template package.json to read
 * @param targetPath - Filesystem path where the updated package.json should be written
 */
async function applyPackageJsonUpdate(pending: PendingUpdate, sourcePath: string, targetPath: string): Promise<void> {
  const sourceRaw = await fs.readFile(sourcePath, 'utf-8');
  const targetName = await getTargetPackageName(targetPath);
  const sanitizedContent = sanitizePackageJsonContent(sourceRaw, targetName);

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, sanitizedContent);

  const actionVerb = pending.kind === 'add' ? 'Added' : 'Updated';
  logger.success(`✓ ${actionVerb} ${pending.file.path}`);
}

/**
 * Copies a non-package template file into the project and logs whether it was added or updated.
 *
 * Ensures the destination directory exists before writing the file.
 *
 * @param pending - The pending update describing the operation and target file path (`pending.file.path` and `pending.kind`).
 * @param sourcePath - Filesystem path to the source template file.
 * @param targetPath - Filesystem path where the file should be written in the project.
 */
async function applyRegularFileUpdate(pending: PendingUpdate, sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);

  const actionVerb = pending.kind === 'add' ? 'Added' : 'Updated';
  logger.success(`✓ ${actionVerb} ${pending.file.path}`);
}

/**
 * Determines whether a filesystem error encountered during directory cleanup is expected and can be ignored.
 *
 * Returns `false` for non-`Error` values.
 *
 * @returns `true` if the error message contains `enoent`, `enotempty`, or `eacces`, `false` otherwise.
 */
function isExpectedCleanupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('enoent') || errorMessage.includes('enotempty') || errorMessage.includes('eacces');
}

/**
 * Remove empty directories upward from `startDir` until reaching `stopDir` or a non-empty directory.
 *
 * Attempts to delete each empty directory on the path from `startDir` toward `stopDir` (exclusive).
 * Ignores common filesystem race-condition errors; unexpected errors are logged as warnings.
 *
 * @param startDir - Path of the directory to start cleaning (the first directory considered for removal)
 * @param stopDir - Path at which cleanup stops and is not removed
 */
async function cleanupEmptyDirs(startDir: string, stopDir: string): Promise<void> {
  try {
    let currentDir = path.resolve(startDir);
    const stopDirResolved = path.resolve(stopDir);

    while (currentDir.startsWith(stopDirResolved) && currentDir !== stopDirResolved) {
      const directoryEntries = await fs.readdir(currentDir);

      if (directoryEntries.length > 0) {
        break;
      }

      await fs.rm(currentDir, { recursive: false });
      currentDir = path.dirname(currentDir);
    }
  } catch (error) {
    // 忽略常见的文件系统竞态，其余异常保留日志。
    if (!isExpectedCleanupError(error)) {
      logger.warn(
        `Warning: Unexpected error during directory cleanup: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
