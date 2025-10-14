/**
 * 基于 cli-progress-footer 的终端进度条封装。
 */

import process from 'node:process';
import chalk from 'chalk';
import cliProgressFooter from 'cli-progress-footer';

/**
 * 控制底部进度条的封装类。
 */
export class ProgressTracker {
  /** cli-progress-footer 实例。 */
  private footer: ReturnType<typeof cliProgressFooter> | null = null;

  /** 当前处理的文件索引（从 1 开始）。 */
  private current = 0;

  /** 需要处理的总文件数。 */
  private readonly total: number;

  /** 是否已启动。 */
  private started = false;

  /** 是否已完成。 */
  private finished = false;

  constructor(total: number) {
    this.total = total;
  }

  /**
   * 启动进度条。
   */
  async start(fileName: string): Promise<void> {
    if (this.started || !process.stdout.isTTY) {
      return;
    }

    this.started = true;
    this.current = 1;

    // 初始化 cli-progress-footer。
    this.footer = cliProgressFooter();

    // 渲染初始进度。
    this.render(fileName);

    // 短暂延迟，确保进度条刷新。
    await this.delay(100);
  }

  /**
   * 处理下一个文件。
   */
  async next(fileName: string): Promise<void> {
    if (!this.started || this.finished || !this.footer) {
      return;
    }

    this.current += 1;
    this.render(fileName);

    // 短暂延迟，确保进度条刷新。
    await this.delay(100);
  }

  /**
   * 兼容旧接口，无需实际操作。
   */
  hide(): void {
    // cli-progress-footer 会自动处理输出位置。
  }

  /**
   * 清除进度显示。
   */
  finish(): void {
    if (!this.started || this.finished) {
      return;
    }

    this.finished = true;

    if (this.footer) {
      // 清空进度显示。
      this.footer.updateProgress('');
    }
  }

  /**
   * 渲染进度条内容。
   */
  private render(fileName: string): void {
    if (!this.footer) {
      return;
    }

    const percentage = Math.round((this.current / this.total) * 100);
    const progress = chalk.dim(`[${this.current}/${this.total}]`);
    const bar = this.renderBar(percentage);
    const file = chalk.cyan(this.truncateFileName(fileName));

    // 更新底部进度显示。
    this.footer.updateProgress(`${progress} ${bar} ${file}\n`);
  }

  /**
   * 根据百分比渲染进度条。
   */
  private renderBar(percentage: number): string {
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;

    const filledBar = chalk.green('█'.repeat(filled));
    const emptyBar = chalk.dim('░'.repeat(empty));

    return `${filledBar}${emptyBar} ${chalk.bold.white(`${percentage}%`.padStart(4))}`;
  }

  /**
   * 截断过长的文件名。
   */
  private truncateFileName(fileName: string, maxLength = 40): string {
    if (fileName.length <= maxLength) {
      return fileName;
    }

    // 保留前后部分，中间用 ... 代替。
    const keepLength = Math.floor((maxLength - 3) / 2);
    return `${fileName.slice(0, keepLength)}...${fileName.slice(-keepLength)}`;
  }

  /**
   * 延迟指定毫秒数。
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a ProgressTracker configured for the given total number of files.
 *
 * @param total - Total number of files to track
 * @returns A new ProgressTracker instance configured with `total`
 */
export function createProgressTracker(total: number): ProgressTracker {
  return new ProgressTracker(total);
}