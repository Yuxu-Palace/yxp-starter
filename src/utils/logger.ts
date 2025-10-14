/**
 * 封装 chalk，提供语义化的彩色日志输出。
 */

import chalk from 'chalk';
import type { DiffSummary, UpdateKind } from '../core/update/types.js';

/** 日志工具对象。 */
export const logger = {
  /** 输出信息日志（蓝色）。 */
  info(message: string): void {
    console.log(chalk.blue(message));
  },

  /** 输出详细信息（青色）。 */
  detail(message: string): void {
    console.log(chalk.cyan(message));
  },

  /** 输出成功消息（绿色）。 */
  success(message: string): void {
    console.log(chalk.green(message));
  },

  /** 输出警告消息（黄色）。 */
  warn(message: string): void {
    console.log(chalk.yellow(message));
  },

  /** 输出提示消息（灰色）。 */
  note(message: string): void {
    console.log(chalk.gray(message));
  },

  /** 输出原始文本。 */
  plain(message = ''): void {
    console.log(message);
  },

  /** 输出错误消息（红色）。 */
  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(chalk.red(message), error);
      return;
    }
    console.error(chalk.red(message));
  },
};

/**
 * Format a diff summary into a colored textual representation.
 *
 * @param stats - Diff summary containing `added` and `removed` counts; if falsy, indicates a binary file
 * @returns The formatted string — `(+<added> -<removed>)` with color highlighting, or `'(binary file)'` when `stats` is falsy
 */
export function formatStats(stats: DiffSummary): string {
  if (!stats) {
    return chalk.magenta('(binary file)');
  }
  return `(${chalk.green(`+${stats.added}`)} ${chalk.red(`-${stats.removed}`)})`;
}

/**
 * Prints a colorized diff line showing an update badge, the file path, and formatted diff statistics.
 *
 * @param kind - The type of update (`add`, `modify`, or `delete`) used to select badge and path colors
 * @param filePath - The file path to display
 * @param stats - Diff summary (added/removed counts); when falsy, indicates a binary/file-without-text diff
 */
export function logDiffResult(kind: UpdateKind, filePath: string, stats: DiffSummary): void {
  const styles: Record<UpdateKind, { badge: (text: string) => string; colorizePath: (text: string) => string }> = {
    add: { badge: (text) => chalk.bgGreen.black(text), colorizePath: (text) => chalk.green(text) },
    modify: { badge: (text) => chalk.bgCyan.black(text), colorizePath: (text) => chalk.cyan(text) },
    delete: { badge: (text) => chalk.bgRed.white(text), colorizePath: (text) => chalk.red(text) },
  };

  const { badge, colorizePath } = styles[kind];
  const actionLabel = badge(` ${kind.toUpperCase()} `);
  const highlightedPath = colorizePath(filePath);
  console.log(`${actionLabel} ${highlightedPath} ${formatStats(stats)}`);
}
