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
 * Generate a sorted list of pending file updates by comparing template files with the current project.
 *
 * Compares the template set under `templatesDir` against files in `currentDir`, producing PendingUpdate
 * items for additions, modifications, and deletions. Project-only files (those not present in templates)
 * are included as delete updates. The returned array is sorted deterministically by update kind and path.
 *
 * @param templatesDir - Path to the directory containing template files
 * @param currentDir - Path to the current project directory to compare against
 * @param shouldIgnore - Predicate that returns `true` for paths that should be excluded from scanning
 * @returns An array of PendingUpdate objects describing required file additions, modifications, and deletions, sorted by kind and path
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
 * Sorts pending updates in-place to produce a deterministic order.
 *
 * Orders updates first by kind using the predefined priority (modify → add → delete),
 * then by file path in lexicographic order when kinds are equal.
 *
 * @param updates - The array of PendingUpdate objects to sort; mutated in place.
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
 * Produce pending updates for a single template file by running the template update handler chain.
 *
 * @param file - The template file descriptor (path and metadata) to process
 * @param templatesDir - Root directory containing template files
 * @param currentDir - Root directory of the current project where updates will be applied
 * @param projectFiles - Set of project-relative file paths present in the current project
 * @param shouldIgnore - Function used to determine whether a given path should be ignored
 * @returns An array of PendingUpdate objects produced by the first handler whose `matches` returns true, or an empty array if no handler matches
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
 * Generate delete updates for files that exist in the project but are not present in the templates.
 *
 * Skips paths for which `shouldIgnore` returns true or whose target file does not exist. For binary files produces a delete update with `isBinary: true` and `stats` set to `null`. For text files produces a delete update with diff statistics computed against an empty source (i.e., deletion), `sourceContent` set to an empty string, and `targetContent` set to the file's current content.
 *
 * @param projectFiles - Set of file paths (relative to the project root) that are present only in the project
 * @param currentDir - Absolute path to the current project directory
 * @param shouldIgnore - Function used to determine whether a given path should be ignored
 * @returns An array of `PendingUpdate` objects representing delete operations for project-only files
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
