/**
 * 定义更新流程中用到的各类处理器。
 */

import { promises as fs } from 'node:fs';
import { getDiffStats } from '../../utils/diff.ts';
import { fileExists, readFileContent } from '../../utils/fs.ts';
import { logDiffResult } from '../../utils/logger.ts';
import { getPackageName, sanitizePackageJsonContent } from '../../utils/package-json.ts';
import { SKIPPED_DYNAMIC_FILES } from './constants.ts';
import type { DiffSummary, FileUpdate, PendingUpdate, TemplateUpdateHandler } from './types.ts';

/**
 * 生成模板中新文件的新增操作。
 */
export async function buildAdditionUpdates(file: FileUpdate, sourcePath: string): Promise<PendingUpdate[]> {
  const templateRead = await readFileContent(sourcePath);

  if (templateRead.isBinary) {
    const stats: DiffSummary = null;
    logDiffResult('add', file.path, stats);
    return [
      {
        kind: 'add',
        file,
        stats,
        isBinary: true,
      },
    ];
  }

  const missingTargetContent = '';
  const stats = getDiffStats(missingTargetContent, templateRead.content);
  logDiffResult('add', file.path, stats);
  return [
    {
      kind: 'add',
      file,
      stats,
      isBinary: false,
      sourceContent: templateRead.content,
      targetContent: missingTargetContent,
    },
  ];
}

/**
 * 生成 `package.json` 的差异记录并保留项目名称。
 */
export async function buildPackageJsonUpdates(
  file: FileUpdate,
  sourcePath: string,
  targetPath: string,
): Promise<PendingUpdate[]> {
  const [sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(sourcePath, 'utf-8'),
    fs.readFile(targetPath, 'utf-8'),
  ]);
  const targetName = getPackageName(targetRaw);
  const sanitizedSource = sanitizePackageJsonContent(sourceRaw, targetName);
  const sanitizedTarget = sanitizePackageJsonContent(targetRaw, targetName);

  if (sanitizedSource === sanitizedTarget) {
    return [];
  }

  const stats = getDiffStats(sanitizedTarget, sanitizedSource);
  logDiffResult('modify', file.path, stats);
  return [
    {
      kind: 'modify',
      file,
      stats,
      isBinary: false,
      sourceContent: sanitizedSource,
      targetContent: sanitizedTarget,
    },
  ];
}

/**
 * 处理模板与项目中已有文件的内容差异。
 */
export async function buildExistingFileUpdates(
  file: FileUpdate,
  sourcePath: string,
  targetPath: string,
): Promise<PendingUpdate[]> {
  const [sourceRead, targetRead] = await Promise.all([readFileContent(sourcePath), readFileContent(targetPath)]);

  const sourceBuffer = sourceRead.isBinary ? sourceRead.content : sourceRead.raw;
  const targetBuffer = targetRead.isBinary ? targetRead.content : targetRead.raw;

  if (sourceBuffer.compare(targetBuffer) === 0) {
    return [];
  }

  if (sourceRead.isBinary || targetRead.isBinary) {
    const stats: DiffSummary = null;
    logDiffResult('modify', file.path, stats);
    return [
      {
        kind: 'modify',
        file,
        stats,
        isBinary: true,
      },
    ];
  }

  const stats = getDiffStats(targetRead.content, sourceRead.content);
  return [
    {
      kind: 'modify',
      file,
      stats,
      isBinary: false,
      sourceContent: sourceRead.content,
      targetContent: targetRead.content,
    },
  ];
}

/**
 * 返回责任链，按顺序匹配并生成对应的更新操作。
 */
export function getTemplateUpdateHandlers(): TemplateUpdateHandler[] {
  return [
    // 忽略规则命中的文件
    {
      matches: ({ file, shouldIgnore }) => shouldIgnore(file.path, false),
      handle: async ({ file, projectFiles }) => {
        projectFiles.delete(file.path);
        return [];
      },
    },

    // 带动态内容的文件（如 README、.yxpignore）
    {
      matches: ({ file }) => SKIPPED_DYNAMIC_FILES.has(file.path),
      handle: async ({ file, projectFiles }) => {
        projectFiles.delete(file.path);
        return [];
      },
    },

    // 项目中缺失的文件
    {
      matches: async ({ targetPath }) => !(await fileExists(targetPath)),
      handle: async ({ file, sourcePath }) => buildAdditionUpdates(file, sourcePath),
    },

    // 针对 package.json 保留项目名称
    {
      matches: ({ file }) => file.path === 'package.json',
      handle: async ({ file, sourcePath, targetPath, projectFiles }) => {
        projectFiles.delete(file.path);
        return buildPackageJsonUpdates(file, sourcePath, targetPath);
      },
    },

    // 默认处理器
    {
      matches: async () => true,
      handle: async ({ file, sourcePath, targetPath, projectFiles }) => {
        projectFiles.delete(file.path);
        return buildExistingFileUpdates(file, sourcePath, targetPath);
      },
    },
  ];
}
