/**
 * update 命令入口
 * 从模板目录同步文件到当前项目，支持交互式选择和批量操作
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 确认当前目录具备更新条件（至少存在 package.json）
 *
 * @param currentDir - 当前目录路径
 * @returns 是否可以继续执行
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
 * update 命令的主入口
 *
 * 支持三种模式：
 * 1. 交互式模式（默认）：逐个文件确认
 * 2. 批量模式（--all）：直接应用全部变更
 * 3. 预览模式（--skip-all）：只展示差异，不执行更新
 *
 * @param options - 命令选项
 */
export async function update(options: UpdateOptions = {}): Promise<void> {
  logger.info('\n🔄 Updating project from yxp-starter...\n');

  const currentDir = process.cwd();
  const templatesDir = path.resolve(__dirname, '../../templates');

  try {
    // 1. 验证项目环境
    const shouldContinue = await validateProjectContext(currentDir);
    if (!shouldContinue) {
      return;
    }

    // 2. 加载忽略规则
    const { ignores: shouldIgnore, hasPatterns } = await createIgnoreMatcher(currentDir);
    if (hasPatterns) {
      logger.note('Using ignore rules from .yxpignore');
    }

    // 3. 扫描并收集差异
    logger.info('📂 Scanning for updates...\n');
    const pendingUpdates = await collectPendingUpdates(templatesDir, currentDir, shouldIgnore);

    // 4. 检查是否有更新
    if (pendingUpdates.length === 0) {
      logger.success('\n✅ All files are up to date!');
      return;
    }

    logger.detail(`\n📊 Found ${pendingUpdates.length} file(s) with updates\n`);

    // 5. 根据选项执行相应模式
    if (options.skipAll) {
      // 预览模式：只展示差异，不执行实际更新
      logger.note('Dry run mode - no files will be updated.');
      return;
    }

    if (options.all) {
      // 批量模式：不经确认直接应用全部变更
      logger.info('Updating all files...\n');
      await applyBatchUpdate(pendingUpdates, templatesDir, currentDir);
      logger.success('\n✅ All files updated successfully!');
      return;
    }

    // 默认：交互式模式，逐个文件确认
    await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
    logger.success('\n✅ Update complete!');
  } catch (error) {
    logger.error('\n❌ Update failed:', error);
    process.exit(1);
  }
}
