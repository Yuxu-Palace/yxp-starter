import { promises as fs } from 'node:fs';
import { getDiffStats } from '../../utils/diff';
import { fileExists, readFileContent } from '../../utils/fs';
import { logDiffResult } from '../../utils/logger';
import { applyPreservedJsonFields, pickFields } from '../../utils/package-json';
import { toPosixPath } from '../../utils/path';
import { SKIPPED_DYNAMIC_FILES } from './constants';
import type { DiffSummary, FileUpdate, PendingUpdate, TemplateUpdateHandler } from './types';

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
 * 生成需要保留字段的 JSON 文件差异。
 */
export async function buildJsonFileUpdates(
  file: FileUpdate,
  sourcePath: string,
  targetPath: string,
  fieldsToPreserve: string[],
): Promise<PendingUpdate[]> {
  const [sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(sourcePath, 'utf-8'),
    fs.readFile(targetPath, 'utf-8'),
  ]);

  const targetParsed = JSON.parse(targetRaw) as Record<string, unknown>;
  const preservedFields = pickFields(targetParsed, fieldsToPreserve);
  const sanitizedSource = applyPreservedJsonFields(sourceRaw, preservedFields);
  const sanitizedTarget = applyPreservedJsonFields(targetRaw, preservedFields);

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

    // 针对声明了保留字段的 JSON 文件
    {
      matches: ({ file, jsonPreserveMap }) => {
        const normalizedPath = toPosixPath(file.path);
        const fields = jsonPreserveMap[normalizedPath];
        return Array.isArray(fields) && fields.length > 0;
      },
      handle: async ({ file, sourcePath, targetPath, projectFiles, jsonPreserveMap }) => {
        projectFiles.delete(file.path);
        const normalizedPath = toPosixPath(file.path);
        const fields = jsonPreserveMap[normalizedPath] ?? [];
        return buildJsonFileUpdates(file, sourcePath, targetPath, fields);
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
