/**
 * 差异检测模块
 * 负责比较模板与项目文件，生成更新列表
 */

import path from 'node:path';
import { getDiffStats } from '../../utils/diff.js';
import { fileExists, readFileContent } from '../../utils/fs.js';
import { logDiffResult } from '../../utils/logger.js';
import { UPDATE_KIND_PRIORITY } from './constants.js';
import { getTemplateUpdateHandlers } from './handlers.js';
import { scanProjectFiles, scanTemplateFiles } from './scanner.js';
import type { DiffSummary, FileUpdate, IgnoreMatcher, PendingUpdate, TemplateUpdateContext } from './types.js';

/**
 * 汇总模板与项目之间的差异，生成待处理的更新列表
 *
 * @param templatesDir - 模板目录路径
 * @param currentDir - 当前项目目录
 * @param shouldIgnore - 忽略规则匹配器
 * @returns 排序后的更新列表
 */
export async function collectPendingUpdates(
  templatesDir: string,
  currentDir: string,
  shouldIgnore: IgnoreMatcher,
): Promise<PendingUpdate[]> {
  const allTemplateFiles = await scanTemplateFiles(templatesDir, shouldIgnore);
  const projectFiles = await scanProjectFiles(currentDir, allTemplateFiles, shouldIgnore);
  const updates: PendingUpdate[] = [];

  for (const file of allTemplateFiles) {
    const templateUpdates = await buildUpdatesForTemplateFile(
      file,
      templatesDir,
      currentDir,
      projectFiles,
      shouldIgnore,
    );
    updates.push(...templateUpdates);
  }

  const projectOnlyUpdates = await collectProjectOnlyUpdates(projectFiles, currentDir, shouldIgnore);
  updates.push(...projectOnlyUpdates);

  sortPendingUpdates(updates);

  return updates;
}

/**
 * 按更新类型和文件路径排序更新列表
 *
 * 排序规则：
 * 1. 首先按 UPDATE_KIND_PRIORITY 排序（modify → add → delete）
 * 2. 相同类型内按文件路径字母顺序排序
 *
 * 注意：此函数会就地修改数组（in-place sort）
 */
function sortPendingUpdates(updates: PendingUpdate[]): void {
  updates.sort((firstUpdate, secondUpdate) => {
    if (firstUpdate.kind === secondUpdate.kind) {
      return firstUpdate.file.path.localeCompare(secondUpdate.file.path);
    }
    return UPDATE_KIND_PRIORITY[firstUpdate.kind] - UPDATE_KIND_PRIORITY[secondUpdate.kind];
  });
}

/**
 * 为模板文件构建更新列表
 *
 * 使用责任链模式（Chain of Responsibility）遍历处理器
 */
async function buildUpdatesForTemplateFile(
  file: FileUpdate,
  templatesDir: string,
  currentDir: string,
  projectFiles: Set<string>,
  shouldIgnore: IgnoreMatcher,
): Promise<PendingUpdate[]> {
  const sourcePath = path.join(templatesDir, file.path);
  const targetPath = path.join(currentDir, file.path);
  const context: TemplateUpdateContext = {
    file,
    templatesDir,
    currentDir,
    projectFiles,
    shouldIgnore,
    sourcePath,
    targetPath,
  };

  const handlers = getTemplateUpdateHandlers();
  for (const handler of handlers) {
    if (await handler.matches(context)) {
      return handler.handle(context);
    }
  }

  return [];
}

/**
 * 收集项目独有文件的删除更新
 *
 * 这些文件存在于项目中，但不在模板中
 */
async function collectProjectOnlyUpdates(
  projectFiles: Set<string>,
  currentDir: string,
  shouldIgnore: IgnoreMatcher,
): Promise<PendingUpdate[]> {
  const updates: PendingUpdate[] = [];

  for (const projectOnlyPath of projectFiles) {
    if (shouldIgnore(projectOnlyPath, false)) {
      continue;
    }

    const targetPath = path.join(currentDir, projectOnlyPath);

    if (!(await fileExists(targetPath))) {
      continue;
    }

    const projectRead = await readFileContent(targetPath);
    const file: FileUpdate = {
      path: projectOnlyPath,
      description: `Project file: ${projectOnlyPath}`,
    };

    if (projectRead.isBinary) {
      const stats: DiffSummary = null;
      updates.push({
        kind: 'delete',
        file,
        stats,
        isBinary: true,
      });
      logDiffResult('delete', projectOnlyPath, stats);
      continue;
    }

    const stats = getDiffStats(projectRead.content, '');
    updates.push({
      kind: 'delete',
      file,
      stats,
      isBinary: false,
      sourceContent: '',
      targetContent: projectRead.content,
    });
    logDiffResult('delete', projectOnlyPath, stats);
  }

  return updates;
}
