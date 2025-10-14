/**
 * 负责生成模板与当前项目之间的差异列表。
 */

import path from 'node:path';
import { getDiffStats } from '../../utils/diff.js';
import { fileExists, readFileContent } from '../../utils/fs.js';
import { UPDATE_KIND_PRIORITY } from './constants.js';
import { getTemplateUpdateHandlers } from './handlers.js';
import { scanProjectFiles, scanTemplateFiles } from './scanner.js';
import type { DiffSummary, FileUpdate, IgnoreMatcher, PendingUpdate, TemplateUpdateContext } from './types.js';

/**
 * 扫描模板与项目的差异并返回待处理更新。
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
 * 按类型（modify → add → delete）和路径排序，保证输出稳定。
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
 * 通过处理器链为单个模板文件生成更新。
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
 * 为项目独有的文件生成删除操作。
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
  }

  return updates;
}
