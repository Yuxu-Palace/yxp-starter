import chalk from 'chalk';
import type { PendingUpdate } from '../core/update/types';
import { logger } from './logger';

/**
 * 按更新类型分组展示待处理文件。
 */
export function showUpdateSummary(updates: PendingUpdate[]): void {
  const grouped = groupUpdatesByKind(updates);

  logger.plain(chalk.bold('\n📋 Files to update:\n'));

  // 修改的文件
  if (grouped.modify.length > 0) {
    logger.plain(chalk.cyan.bold(`  Modified (${grouped.modify.length}):`));
    for (let index = 0; index < grouped.modify.length; ++index) {
      const update = grouped.modify[index];
      const stats = formatStats(update);
      logger.plain(chalk.cyan(`    • ${update.file.path}${stats}`));
    }
    logger.plain();
  }

  // 新增的文件
  if (grouped.add.length > 0) {
    logger.plain(chalk.green.bold(`  Added (${grouped.add.length}):`));
    for (let index = 0; index < grouped.add.length; ++index) {
      const update = grouped.add[index];
      const stats = formatStats(update);
      logger.plain(chalk.green(`    • ${update.file.path}${stats}`));
    }
    logger.plain();
  }

  // 删除的文件
  if (grouped.delete.length > 0) {
    logger.plain(chalk.red.bold(`  Deleted (${grouped.delete.length}):`));
    for (let index = 0; index < grouped.delete.length; ++index) {
      const update = grouped.delete[index];
      const stats = formatStats(update);
      logger.plain(chalk.red(`    • ${update.file.path}${stats}`));
    }
    logger.plain();
  }
}

/**
 * 按更新类型分组。
 */
function groupUpdatesByKind(updates: PendingUpdate[]): Record<string, PendingUpdate[]> {
  const grouped: Record<string, PendingUpdate[]> = {
    modify: [],
    add: [],
    delete: [],
  };

  for (let index = 0; index < updates.length; ++index) {
    const update = updates[index];
    grouped[update.kind].push(update);
  }

  return grouped;
}

/**
 * 格式化差异统计。
 */
function formatStats(update: PendingUpdate): string {
  if (update.isBinary || !update.stats) {
    return ' (binary)';
  }

  const { added, removed } = update.stats;
  if (added === 0 && removed === 0) {
    return '';
  }

  const parts: string[] = [];
  if (added > 0) {
    parts.push(chalk.green(`+${added}`));
  }
  if (removed > 0) {
    parts.push(chalk.red(`-${removed}`));
  }

  return ` (${parts.join(' ')})`;
}
