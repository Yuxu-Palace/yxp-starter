/**
 * 更新处理器配置
 * 使用策略模式定义不同文件类型的更新策略
 */

import { promises as fs } from 'node:fs';
import { getDiffStats } from '../../utils/diff.js';
import { fileExists, readFileContent } from '../../utils/fs.js';
import { logDiffResult } from '../../utils/logger.js';
import { getPackageName, sanitizePackageJsonContent } from '../../utils/package-json.js';
import { SKIPPED_DYNAMIC_FILES } from './constants.js';
import type { DiffSummary, FileUpdate, PendingUpdate, TemplateUpdateHandler } from './types.js';

/**
 * 构建文件新增的更新记录
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
 * 构建 package.json 更新记录
 *
 * 特殊处理逻辑：
 * - 标准化格式化，避免空格/换行差异导致的误报
 * - 保留目标项目的 name 字段
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
 * 构建已存在文件的更新记录
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
  logDiffResult('modify', file.path, stats);
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
 * 获取模板更新处理器列表
 *
 * 使用责任链模式（Chain of Responsibility）：
 * - 每个处理器检查是否匹配当前文件
 * - 第一个匹配的处理器负责处理该文件
 * - 处理器按优先级排序
 */
export function getTemplateUpdateHandlers(): TemplateUpdateHandler[] {
  return [
    // 1. 被忽略的文件 - 直接跳过
    {
      matches: ({ file, shouldIgnore }) => shouldIgnore(file.path, false),
      handle: async ({ file, projectFiles }) => {
        projectFiles.delete(file.path);
        return [];
      },
    },

    // 2. 动态内容文件（README.md, .yxpignore） - 跳过更新
    {
      matches: ({ file }) => SKIPPED_DYNAMIC_FILES.has(file.path),
      handle: async ({ file, projectFiles }) => {
        projectFiles.delete(file.path);
        return [];
      },
    },

    // 3. 项目中不存在的文件 - 标记为新增
    {
      matches: async ({ targetPath }) => !(await fileExists(targetPath)),
      handle: async ({ file, sourcePath }) => buildAdditionUpdates(file, sourcePath),
    },

    // 4. package.json - 特殊处理（保留项目名称）
    {
      matches: ({ file }) => file.path === 'package.json',
      handle: async ({ file, sourcePath, targetPath, projectFiles }) => {
        projectFiles.delete(file.path);
        return buildPackageJsonUpdates(file, sourcePath, targetPath);
      },
    },

    // 5. 默认处理器 - 处理普通文件修改
    {
      matches: async () => true,
      handle: async ({ file, sourcePath, targetPath, projectFiles }) => {
        projectFiles.delete(file.path);
        return buildExistingFileUpdates(file, sourcePath, targetPath);
      },
    },
  ];
}
