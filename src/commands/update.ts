/**
 * 从模板目录同步文件到当前项目。
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { applyBatchUpdate } from '../core/update/applier.js';
import { IGNORED_FILE_NAME } from '../core/update/constants.js';
import { collectPendingUpdates } from '../core/update/differ.js';
import { runInteractiveUpdate } from '../core/update/interactive.js';
import type { UpdateOptions } from '../core/update/types.js';
import { createIgnoreMatcher } from '../utils/ignore.js';
import { logger } from '../utils/logger.js';
import { showUpdateSummary } from '../utils/summary.js';
import { chooseTemplate, readStoredTemplate, writeStoredTemplate } from '../utils/templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 验证当前目录是否满足更新前置条件。
 */
/**
 * 执行更新命令。
 *
 * @param options - 命令选项
 * @param options.all - 批量更新全部文件
 * @param options.skipAll - 预览模式，不执行更新
 */
export async function update(options: UpdateOptions = {}): Promise<void> {
  logger.info('\n🔄 Updating project from yxp-starter...\n');

  const currentDir = process.cwd();
  const templatesRoot = path.resolve(__dirname, '../../templates');

  try {
    const storedTemplate = await readStoredTemplate(currentDir);
    const template = await chooseTemplate(templatesRoot, 'Select a template to sync from', storedTemplate ?? undefined);
    if (storedTemplate !== template.name) {
      await writeStoredTemplate(currentDir, template.name);
    }
    const templatesDir = template.path;
    logger.detail(`Using template: ${template.name}`);

    const { ignores: shouldIgnore, hasPatterns } = await createIgnoreMatcher(currentDir);
    if (hasPatterns) {
      logger.note(`Using ignore rules from ${IGNORED_FILE_NAME}`);
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
