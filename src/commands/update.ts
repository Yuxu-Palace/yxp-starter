import process from 'node:process';
import { applyBatchUpdate } from '@/core/update/applier';
import { collectPendingUpdates } from '@/core/update/differ';
import { runInteractiveUpdate } from '@/core/update/interactive';
import type { PendingUpdate, UpdateOptions } from '@/core/update/types';
import { MissingFileManifestError } from '@/core/update/types';
import { createIgnoreMatcher } from '@/utils/ignore';
import { logger } from '@/utils/logger';
import { showUpdateSummary } from '@/utils/summary';
import { ensureTemplateReady, selectDownloader } from '@/utils/template-fetch';
import {
  buildStoredTemplateManifest,
  chooseTemplate,
  findTemplateOrThrow,
  readStoredTemplate,
  type StoredTemplateManifest,
  writeStoredTemplate,
} from '@/utils/templates';
import { buildJsonPreserveMap, loadYxpConfig } from '@/utils/yxp-config';

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

    const { path: templatesDir, downloader: usedDownloader } = await ensureTemplateReady(template, downloader);
    logger.detail(`Using template ${template.displayName} (${template.name})`);

    const loadedConfig = await loadYxpConfig(currentDir);
    const updateConfig = loadedConfig?.config.update;
    const jsonPreserveMap = buildJsonPreserveMap(updateConfig);
    const applyOptions = { jsonPreserveMap };

    const { ignores: shouldIgnore, sources: ignoreSources } = await createIgnoreMatcher(currentDir, loadedConfig);
    if (ignoreSources.length > 0) {
      logger.note(`Using ignore rules from ${ignoreSources.join(', ')}`);
    }

    logger.info('📂 Scanning for updates...\n');
    const pendingUpdates = await collectPendingUpdates(
      templatesDir,
      currentDir,
      shouldIgnore,
      jsonPreserveMap,
      storedTemplate?.files,
    );

    if (pendingUpdates.length === 0) {
      logger.success('\n✅ All files are up to date!');
      await writeManifestIfNeeded(
        currentDir,
        storedTemplate,
        template.name,
        template.source,
        usedDownloader,
        pendingUpdates,
        storedTemplate?.files,
      );
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
      await applyBatchUpdate(pendingUpdates, templatesDir, currentDir, applyOptions);
      await writeManifestIfNeeded(
        currentDir,
        storedTemplate,
        template.name,
        template.source,
        usedDownloader,
        pendingUpdates,
        storedTemplate?.files,
      );
      logger.success('\n✅ All files updated successfully!');
      return;
    }

    await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir, applyOptions);
    await writeManifestIfNeeded(
      currentDir,
      storedTemplate,
      template.name,
      template.source,
      usedDownloader,
      pendingUpdates,
      storedTemplate?.files,
    );
    logger.success('\n✅ Update complete!');
  } catch (error) {
    // 特殊处理缺少文件清单的错误，提供友好输出
    if (error instanceof MissingFileManifestError) {
      logger.error('\n❌ Update failed:\n');
      logger.error(error.message);
      process.exit(1);
    }

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
 * 根据更新结果记录最新的模板元数据，并同步文件清单。
 */
async function writeManifestIfNeeded(
  projectDir: string,
  stored: StoredTemplateManifest | null,
  templateName: string,
  source: StoredTemplateManifest['source'],
  downloader: string,
  pendingUpdates: PendingUpdate[],
  recordedFiles?: string[],
): Promise<void> {
  // 收集所有新增和修改的文件路径
  const addedOrModifiedFiles = pendingUpdates
    .filter((upd) => upd.kind === 'add' || upd.kind === 'modify')
    .map((upd) => upd.file.path);

  // 收集所有被删除的文件路径
  const deletedFiles = new Set(pendingUpdates.filter((upd) => upd.kind === 'delete').map((upd) => upd.file.path));

  // 合并文件清单：保留原有文件（排除被删除的） + 新增/修改的文件
  const existingFiles = (recordedFiles || []).filter((file) => !deletedFiles.has(file));
  const updatedFiles = [...new Set([...existingFiles, ...addedOrModifiedFiles])];

  const manifest = buildStoredTemplateManifest({
    name: templateName,
    source,
    downloader,
    files: updatedFiles.length > 0 ? updatedFiles : undefined,
  });

  // 仅在首次更新或模板配置发生实质性变化时才写入元数据
  // 这样可以避免不必要的 I/O 操作，同时确保记录准确反映当前使用的模板和下载器
  if (!stored || stored.name !== manifest.name || stored.downloader !== manifest.downloader) {
    await writeStoredTemplate(projectDir, manifest);
  } else {
    // 即使模板配置没变，也需要更新文件清单
    await writeStoredTemplate(projectDir, manifest);
  }
}
