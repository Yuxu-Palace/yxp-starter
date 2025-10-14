/**
 * 统一的日志工具
 * 封装 chalk 的颜色输出，提供语义化的日志接口
 */

import chalk from 'chalk';
import type { DiffSummary, UpdateKind } from '../core/update/types.js';

/** 日志工具对象 */
export const logger = {
  /** 信息日志（蓝色） */
  info(message: string): void {
    console.log(chalk.blue(message));
  },

  /** 详细信息（青色） */
  detail(message: string): void {
    console.log(chalk.cyan(message));
  },

  /** 成功消息（绿色） */
  success(message: string): void {
    console.log(chalk.green(message));
  },

  /** 警告消息（黄色） */
  warn(message: string): void {
    console.log(chalk.yellow(message));
  },

  /** 提示消息（灰色） */
  note(message: string): void {
    console.log(chalk.gray(message));
  },

  /** 普通输出 */
  plain(message = ''): void {
    console.log(message);
  },

  /** 错误消息（红色） */
  error(message: string, error?: unknown): void {
    if (error !== undefined) {
      console.error(chalk.red(message), error);
      return;
    }
    console.error(chalk.red(message));
  },
};

/**
 * 格式化差异统计为彩色字符串
 * @param stats - 差异统计（null 表示二进制文件）
 */
export function formatStats(stats: DiffSummary): string {
  if (!stats) {
    return chalk.magenta('(binary file)');
  }
  return `(${chalk.green(`+${stats.added}`)} ${chalk.red(`-${stats.removed}`)})`;
}

/**
 * 记录文件差异结果（带彩色徽章）
 * @param kind - 更新类型
 * @param filePath - 文件路径
 * @param stats - 差异统计
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
