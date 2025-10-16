/**
 * 从模板目录同步文件到当前项目。
 */

import process from 'node:process';
import { applyBatchUpdate } from '../core/update/applier.ts';
import { IGNORED_FILE_NAME } from '../core/update/constants.ts';
import { collectPendingUpdates } from '../core/update/differ.ts';
import { runInteractiveUpdate } from '../core/update/interactive.ts';
import type { UpdateOptions } from '../core/update/types.ts';
import { createIgnoreMatcher } from '../utils/ignore.ts';
import { logger } from '../utils/logger.ts';
import { showUpdateSummary } from '../utils/summary.ts';
import { ensureTemplateReady } from '../utils/template-fetch.ts';
import {
  chooseTemplate,
  findTemplateOrThrow,
  readStoredTemplate,
  type StoredTemplateManifest,
  writeStoredTemplate,
} from '../utils/templates.ts';

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

  try {
    const storedTemplate = await readStoredTemplate(currentDir);
    const template = await resolveTemplateSelection(storedTemplate);

    const { path: templatesDir, commit } = await ensureTemplateReady(template);
    logger.detail(`Using template ${template.displayName} (${template.name}) @ ${commit}`);

    const { ignores: shouldIgnore, hasPatterns } = await createIgnoreMatcher(currentDir);
    if (hasPatterns) {
      logger.note(`Using ignore rules from ${IGNORED_FILE_NAME}`);
    }

    logger.info('📂 Scanning for updates...\n');
    const pendingUpdates = await collectPendingUpdates(templatesDir, currentDir, shouldIgnore);

    if (pendingUpdates.length === 0) {
      logger.success('\n✅ All files are up to date!');
      await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source);
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
      await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source);
      logger.success('\n✅ All files updated successfully!');
      return;
    }

    await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
    await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source);
    logger.success('\n✅ Update complete!');
  } catch (error) {
    logger.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}

async function resolveTemplateSelection(stored: StoredTemplateManifest | null) {
  let defaultName = stored?.name;

  if (stored?.name) {
    try {
      await findTemplateOrThrow(stored.name);
    } catch {
      logger.warn(`⚠️ Stored template "${stored.name}" is no longer defined. Please select a new template to continue.`);
      defaultName = undefined;
    }
  }

  return chooseTemplate('Select a template to sync from', defaultName);
}

async function writeManifestIfNeeded(
  projectDir: string,
  stored: StoredTemplateManifest | null,
  templateName: string,
  commit: string,
  source: StoredTemplateManifest['source'],
): Promise<void> {
  const manifest: StoredTemplateManifest = {
    name: templateName,
    commit,
    source,
    appliedAt: new Date().toISOString(),
  };

  if (!stored || stored.name !== manifest.name || stored.commit !== manifest.commit) {
    await writeStoredTemplate(projectDir, manifest);
  }
}
