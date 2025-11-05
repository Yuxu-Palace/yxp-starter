/**
 * 从模板目录同步文件到当前项目。
 */

import process from 'node:process';
import { applyBatchUpdate } from '../core/update/applier';
import { IGNORED_FILE_NAME } from '../core/update/constants';
import { collectPendingUpdates } from '../core/update/differ';
import { runInteractiveUpdate } from '../core/update/interactive';
import type { UpdateOptions } from '../core/update/types';
import { createIgnoreMatcher } from '../utils/ignore';
import { logger } from '../utils/logger';
import { showUpdateSummary } from '../utils/summary';
import { ensureTemplateReady, selectDownloader } from '../utils/template-fetch';
import {
  buildStoredTemplateManifest,
  chooseTemplate,
  findTemplateOrThrow,
  readStoredTemplate,
  type StoredTemplateManifest,
  writeStoredTemplate,
} from '../utils/templates';

/**
 * 执行更新命令，根据配置选择批量或交互式应用模板差异。
 */
export async function update(options: UpdateOptions = {}): Promise<void> {
  logger.info('\n🔄 Updating project from yxp-starter...\n');

  const currentDir = process.cwd();

  try {
    const storedTemplate = await readStoredTemplate(currentDir);
    const downloader = await selectDownloader(storedTemplate?.downloader);
    const template = await resolveTemplateSelection(storedTemplate);

    const { path: templatesDir, commit, downloader: usedDownloader } = await ensureTemplateReady(template, downloader);
    logger.detail(`Using template ${template.displayName} (${template.name}) @ ${commit}`);

    const { ignores: shouldIgnore, hasPatterns } = await createIgnoreMatcher(currentDir);
    if (hasPatterns) {
      logger.note(`Using ignore rules from ${IGNORED_FILE_NAME}`);
    }

    logger.info('📂 Scanning for updates...\n');
    const pendingUpdates = await collectPendingUpdates(templatesDir, currentDir, shouldIgnore);

    if (pendingUpdates.length === 0) {
      logger.success('\n✅ All files are up to date!');
      await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source, usedDownloader);
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
      await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source, usedDownloader);
      logger.success('\n✅ All files updated successfully!');
      return;
    }

    await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
    await writeManifestIfNeeded(currentDir, storedTemplate, template.name, commit, template.source, usedDownloader);
    logger.success('\n✅ Update complete!');
  } catch (error) {
    logger.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}

/**
 * 根据历史记录或用户交互确定用于同步的模板。
 */
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

/**
 * 根据更新结果记录最新的模板元数据，避免重复写入。
 */
async function writeManifestIfNeeded(
  projectDir: string,
  stored: StoredTemplateManifest | null,
  templateName: string,
  commit: string,
  source: StoredTemplateManifest['source'],
  downloader: string,
): Promise<void> {
  const manifest = buildStoredTemplateManifest({
    name: templateName,
    commit,
    source,
    downloader,
  });

  if (
    !stored ||
    stored.name !== manifest.name ||
    stored.commit !== manifest.commit ||
    stored.downloader !== manifest.downloader
  ) {
    await writeStoredTemplate(projectDir, manifest);
  }
}
