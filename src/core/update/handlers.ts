/**
 * 定义更新流程中用到的各类处理器。
 */

import { promises as fs } from 'node:fs';
import { getDiffStats } from '../../utils/diff.js';
import { fileExists, readFileContent } from '../../utils/fs.js';
import { logDiffResult } from '../../utils/logger.js';
import { getPackageName, sanitizePackageJsonContent } from '../../utils/package-json.js';
import { SKIPPED_DYNAMIC_FILES } from './constants.js';
import type { DiffSummary, FileUpdate, PendingUpdate, TemplateUpdateHandler } from './types.js';

/**
 * Produce pending add updates for a template file that does not exist in the target.
 *
 * For binary templates returns a single `add` update with `isBinary: true` and `stats` set to `null`.
 * For text templates returns a single `add` update with `isBinary: false`, `sourceContent` set to the template content,
 * `targetContent` set to an empty string, and `stats` computed from the empty target to the template content.
 *
 * @param file - Metadata describing the template file to add
 * @param sourcePath - Filesystem path to the template source file
 * @returns An array containing a single `PendingUpdate` representing the add operation for the file
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
 * Produce update(s) for package.json while preserving the existing project name.
 *
 * Reads, sanitizes, and compares the source and target package.json contents using the target's package name so that the project name is preserved; if they differ, returns a single pending modify update with computed diff stats.
 *
 * @returns An array containing one `PendingUpdate` for a `'modify'` of `package.json` with `sourceContent` and `targetContent` set to the sanitized contents and `stats` set to the diff metrics, or an empty array if no changes are detected.
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
 * Determines updates needed when a template file differs from an existing project file.
 *
 * @param file - Metadata for the template file being compared.
 * @param sourcePath - Filesystem path to the template source file.
 * @param targetPath - Filesystem path to the existing project file.
 * @returns An array of pending updates:
 * - Empty array if the files are identical.
 * - A single binary `modify` update with `isBinary: true` if either side is binary and contents differ.
 * - A single text `modify` update with `isBinary: false`, `stats` from the diff, and `sourceContent`/`targetContent` when both sides are text and differ.
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
 * Provide an ordered chain of template update handlers that match files and generate pending updates.
 *
 * Each handler is evaluated in sequence and may remove the processed file from the `projectFiles` set.
 *
 * @returns An array of TemplateUpdateHandler objects evaluated in order; each handler produces zero or more PendingUpdate entries for the matched file.
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
