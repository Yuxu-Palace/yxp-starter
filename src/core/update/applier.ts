import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '@/utils/logger';
import { applyPreservedJsonFields, readJsonFileFields } from '@/utils/package-json';
import { toPosixPath } from '@/utils/path';
import { createProgressTracker } from '@/utils/progress';
import type { ApplyUpdateOptions, PendingUpdate } from './types';

/**
 * 处理单个待更新文件并落盘。
 */
export async function applyUpdate(
  pending: PendingUpdate,
  templatesDir: string,
  currentDir: string,
  options: ApplyUpdateOptions,
): Promise<void> {
  if (pending.kind === 'delete') {
    return applyFileDeletion(pending.file.path, currentDir);
  }

  const sourcePath = path.join(templatesDir, pending.file.path);
  const targetPath = path.join(currentDir, pending.file.path);

  const normalizedPath = toPosixPath(pending.file.path);
  const jsonPreserveFields = options.jsonPreserveMap[normalizedPath];

  if (jsonPreserveFields && jsonPreserveFields.length > 0) {
    return applyJsonFileUpdate(pending, sourcePath, targetPath, jsonPreserveFields);
  }

  return applyRegularFileUpdate(pending, sourcePath, targetPath);
}

/**
 * 依次应用所有差异并输出进度。
 */
export async function applyBatchUpdate(
  updates: PendingUpdate[],
  templatesDir: string,
  currentDir: string,
  options: ApplyUpdateOptions,
): Promise<void> {
  const progress = createProgressTracker(updates.length);

  for (let index = 0; index < updates.length; ++index) {
    const pending = updates[index];

    if (index === 0) {
      await progress.start(pending.file.path);
    } else {
      await progress.next(pending.file.path);
    }

    await applyUpdate(pending, templatesDir, currentDir, options);
  }

  progress.finish();
}

/**
 * 删除目标文件后向上清理空目录。
 */
async function applyFileDeletion(filePath: string, currentDir: string): Promise<void> {
  const targetPath = path.join(currentDir, filePath);
  await fs.rm(targetPath, { force: true });
  await cleanupEmptyDirs(path.dirname(targetPath), currentDir);
  logger.success(`✓ Deleted ${filePath}`);
}

/**
 * 更新 `package.json`，同时保留项目原有名称。
 */
async function applyJsonFileUpdate(
  pending: PendingUpdate,
  sourcePath: string,
  targetPath: string,
  fieldsToPreserve: string[],
): Promise<void> {
  const sourceRaw = await fs.readFile(sourcePath, 'utf-8');
  const preservedFields = await readJsonFileFields(targetPath, fieldsToPreserve);
  const sanitizedContent = applyPreservedJsonFields(sourceRaw, preservedFields);

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, sanitizedContent);

  const actionVerb = pending.kind === 'add' ? 'Added' : 'Updated';
  logger.success(`✓ ${actionVerb} ${pending.file.path}`);
}

/**
 * 将普通文件从模板复制到项目目录。
 */
async function applyRegularFileUpdate(pending: PendingUpdate, sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);

  const actionVerb = pending.kind === 'add' ? 'Added' : 'Updated';
  logger.success(`✓ ${actionVerb} ${pending.file.path}`);
}

/**
 * 判断目录清理时可忽略的常见文件系统错误。
 */
function isExpectedCleanupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('enoent') || errorMessage.includes('enotempty') || errorMessage.includes('eacces');
}

/**
 * 从删除位置向上移除空目录，直到遇到项目根或非空目录。
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
