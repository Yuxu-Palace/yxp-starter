import chalk from 'chalk';
import { type Change, diffLines } from 'diff';
import { logger } from './logger';

/**
 * 以彩色文本形式打印两份内容的行级差异。
 */
export function showDiff(oldContent: string, newContent: string, fileName: string): void {
  logger.detail(`\n📝 Changes in ${fileName}:`);
  logger.note('─'.repeat(60));

  const diff: Change[] = diffLines(oldContent, newContent);
  let addedLines = 0;
  let removedLines = 0;

  for (let index = 0; index < diff.length; index += 1) {
    const part = diff[index];
    // diffLines 会把连续内容放在同一个片段，需要逐行拆分。
    const lines = part.value.split('\n').filter((line, lineIndex, arr) => {
      // 移除 diff 在文件末尾换行时生成的空行。
      return lineIndex < arr.length - 1 || line !== '';
    });

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      if (part.added) {
        logger.plain(chalk.green(`+ ${line}`));
        addedLines++;
      } else if (part.removed) {
        logger.plain(chalk.red(`- ${line}`));
        removedLines++;
      } else {
        logger.plain(chalk.gray(`  ${line}`));
      }
    }
  }

  logger.note('─'.repeat(60));
  logger.plain(chalk.cyan(`Summary: ${chalk.green(`+${addedLines}`)} ${chalk.red(`-${removedLines}`)} lines`));
}

/**
 * 统计差异行数，便于生成摘要与提示。
 */
export function getDiffStats(oldContent: string, newContent: string): { added: number; removed: number } {
  const diff: Change[] = diffLines(oldContent, newContent);
  let added = 0;
  let removed = 0;

  for (let index = 0; index < diff.length; index += 1) {
    const part = diff[index];
    const lines = part.value.split('\n').filter((line, lineIndex, arr) => lineIndex < arr.length - 1 || line !== '');
    // 每个片段的有效行数作为增删统计依据。
    const lineCount = lines.length;
    if (part.added) {
      added += lineCount;
    } else if (part.removed) {
      removed += lineCount;
    }
  }

  return { added, removed };
}
