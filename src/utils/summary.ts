/**
 * 输出待更新文件的分组摘要。
 */

import chalk from 'chalk';
import type { PendingUpdate } from '../core/update/types.js';

/**
 * 按更新类型分组展示待处理文件。
 */
export function showUpdateSummary(updates: PendingUpdate[]): void {
  const grouped = groupUpdatesByKind(updates);

  console.log(chalk.bold('\n📋 Files to update:\n'));

  // 修改的文件
  if (grouped.modify.length > 0) {
    console.log(chalk.cyan.bold(`  Modified (${grouped.modify.length}):`));
    for (const update of grouped.modify) {
      const stats = formatStats(update);
      console.log(chalk.cyan(`    • ${update.file.path}${stats}`));
    }
    console.log();
  }

  // 新增的文件
  if (grouped.add.length > 0) {
    console.log(chalk.green.bold(`  Added (${grouped.add.length}):`));
    for (const update of grouped.add) {
      const stats = formatStats(update);
      console.log(chalk.green(`    • ${update.file.path}${stats}`));
    }
    console.log();
  }

  // 删除的文件
  if (grouped.delete.length > 0) {
    console.log(chalk.red.bold(`  Deleted (${grouped.delete.length}):`));
    for (const update of grouped.delete) {
      const stats = formatStats(update);
      console.log(chalk.red(`    • ${update.file.path}${stats}`));
    }
    console.log();
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

  for (const update of updates) {
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
