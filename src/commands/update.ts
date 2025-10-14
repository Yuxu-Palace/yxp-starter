/**
 * 从模板目录同步文件到当前项目。
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applyBatchUpdate } from '../core/update/applier.js';
import { collectPendingUpdates } from '../core/update/differ.js';
import { runInteractiveUpdate } from '../core/update/interactive.js';
import type { UpdateOptions } from '../core/update/types.js';
import { fileExists } from '../utils/fs.js';
import { createIgnoreMatcher } from '../utils/ignore.js';
import { logger } from '../utils/logger.js';
import { showUpdateSummary } from '../utils/summary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Verify that the given directory contains a package.json indicating a Node project.
 *
 * @param currentDir - Filesystem path of the directory to validate
 * @returns `true` if `package.json` exists in `currentDir`; exits the process with code 1 if not found.
 */
async function validateProjectContext(currentDir: string): Promise<boolean> {
  const packageJsonPath = path.join(currentDir, 'package.json');

  if (!(await fileExists(packageJsonPath))) {
    logger.error('❌ No package.json found. Are you in a project directory?');
    process.exit(1);
  }

  return true;
}

/**
 * Synchronizes template files into the current project directory.
 *
 * Performs a scan for pending template updates, shows a summary, and then either performs
 * no changes (dry run), applies all updates in batch, or runs an interactive update flow
 * based on the provided options.
 *
 * @param options - Command options that control update behavior
 * @param options.all - If true, apply all pending updates without prompting
 * @param options.skipAll - If true, perform a preview only and do not modify files
 */
export async function update(options: UpdateOptions = {}): Promise<void> {
  logger.info('\n🔄 Updating project from yxp-starter...\n');

  const currentDir = process.cwd();
  const templatesDir = path.resolve(__dirname, '../../templates');

  try {
    const shouldContinue = await validateProjectContext(currentDir);
    if (!shouldContinue) {
      return;
    }

    const { ignores: shouldIgnore, hasPatterns } = await createIgnoreMatcher(currentDir);
    if (hasPatterns) {
      logger.note('Using ignore rules from .yxpignore');
    }

    logger.info('📂 Scanning for updates...\n');
    const pendingUpdates = await collectPendingUpdates(templatesDir, currentDir, shouldIgnore);

    if (pendingUpdates.length === 0) {
      logger.success('\n✅ All files are up to date!');
      return;
    }

    logger.detail(`\n📊 Found ${pendingUpdates.length} file(s) with updates`);
    showUpdateSummary(pendingUpdates);

    if (options.skipAll) {
      logger.note('Dry run mode - no files will be updated.');
      return;
    }

    if (options.all) {
      logger.info('Updating all files...\n');
      await applyBatchUpdate(pendingUpdates, templatesDir, currentDir);
      logger.success('\n✅ All files updated successfully!');
      return;
    }

    await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
    logger.success('\n✅ Update complete!');
  } catch (error) {
    logger.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}
