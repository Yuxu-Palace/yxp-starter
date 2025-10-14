/**
 * 更新应用模块
 * 负责将更新操作应用到磁盘，包括文件的新增、修改、删除
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.js';
import { getTargetPackageName, sanitizePackageJsonContent } from '../../utils/package-json.js';
import type { PendingUpdate } from './types.js';

/**
 * 将单个差异应用到磁盘
 *
 * 根据更新类型执行相应操作：
 * - add/modify: 复制文件（package.json 特殊处理）
 * - delete: 删除文件并清理空目录
 *
 * @param pending - 待处理的更新
 * @param templatesDir - 模板目录路径
 * @param currentDir - 当前项目目录
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
 * 在非交互模式下依次应用所有更新
 *
 * @param updates - 更新列表
 * @param templatesDir - 模板目录路径
 * @param currentDir - 当前项目目录
 */
export async function applyBatchUpdate(
  updates: PendingUpdate[],
  templatesDir: string,
  currentDir: string,
): Promise<void> {
  for (const pending of updates) {
    await applyUpdate(pending, templatesDir, currentDir);
  }
}

/**
 * 删除文件并清理产生的空目录
 *
 * 删除文件后，尝试自底向上清理空目录，保持项目目录结构整洁。
 * 例如：删除 a/b/c/file.txt 后，如果 c、b、a 目录都为空，则全部删除。
 */
async function applyFileDeletion(filePath: string, currentDir: string): Promise<void> {
  const targetPath = path.join(currentDir, filePath);
  await fs.rm(targetPath, { force: true });
  await cleanupEmptyDirs(path.dirname(targetPath), currentDir);
  logger.success(`✓ Deleted ${filePath}`);
}

/**
 * 应用 package.json 更新，同时保留项目名称
 *
 * 特殊处理逻辑：
 * - 从模板复制所有字段
 * - 但保留目标项目的 name 字段
 * - 这确保模板更新不会意外改变项目名称
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
 * 应用普通文件更新（直接复制）
 *
 * 简单的文件复制操作：
 * - 确保目标目录存在
 * - 从模板复制文件到项目
 */
async function applyRegularFileUpdate(pending: PendingUpdate, sourcePath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.copyFile(sourcePath, targetPath);

  const actionVerb = pending.kind === 'add' ? 'Added' : 'Updated';
  logger.success(`✓ ${actionVerb} ${pending.file.path}`);
}

/**
 * 检查是否是预期的文件系统错误
 *
 * 这些错误是正常的，不需要警告用户：
 * - ENOENT: 目录已不存在
 * - ENOTEMPTY: 目录非空
 * - EACCES: 权限问题
 */
function isExpectedCleanupError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('enoent') || errorMessage.includes('enotempty') || errorMessage.includes('eacces');
}

/**
 * 自底向上删除空目录
 *
 * 删除文件后清理产生的空目录层级，避免留下无用的目录结构
 *
 * @param startDir - 起始目录（通常是已删除文件的父目录）
 * @param stopDir - 停止目录（通常是项目根目录）
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
    // 只忽略预期的文件系统错误（如目录不存在、非空、权限问题）
    if (!isExpectedCleanupError(error)) {
      logger.warn(
        `Warning: Unexpected error during directory cleanup: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
