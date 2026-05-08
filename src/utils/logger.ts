import chalk from 'chalk';
import type { DiffSummary, UpdateKind } from '@/core/update/types';

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

  /** 按需定制颜色或样式输出。 */
  custom(message: string, colorize: (text: string) => string): void {
    console.log(colorize(message));
  },
};

/**
 * 将差异统计格式化为彩色字符串。
 */
export function formatStats(stats: DiffSummary): string {
  if (!stats) {
    return chalk.magenta('(binary file)');
  }
  return `(${chalk.green(`+${stats.added}`)} ${chalk.red(`-${stats.removed}`)})`;
}

/**
 * 打印文件差异结果，附带彩色徽章。
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
