/**
 * 输出待更新文件的分组摘要。
 */

import chalk from 'chalk';
import type { PendingUpdate } from '../core/update/types.js';

/**
 * Display a grouped, colored console summary of pending file updates.
 *
 * Prints sections for Modified, Added, and Deleted files (when present), each prefixed with a count and listing per-file entries with brief change statistics.
 *
 * @param updates - Pending updates to summarize; each entry must include the file path and metadata used to render the per-file line
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
 * Group pending updates into buckets by their `kind` ("modify", "add", "delete").
 *
 * @param updates - Array of pending update entries to group
 * @returns An object with keys `modify`, `add`, and `delete`, each containing the array of updates for that kind
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
 * Format change statistics for a pending update.
 *
 * Returns `' (binary)'` when the update is a binary file or has no stats,
 * an empty string when both additions and deletions are zero, or a parenthesized
 * string containing colored `+N` and/or `-M` parts for additions and deletions.
 *
 * @param update - The pending update whose `isBinary` flag and `stats` (`added`, `removed`) are used to produce the formatted string
 * @returns `' (binary)'` for binary or missing stats, `''` when there are no changes, or a string like ` (+N -M)` with additions in green and deletions in red
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