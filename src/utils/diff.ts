import chalk from 'chalk';
import { type Change, diffLines } from 'diff';

/**
 * 以彩色文本形式打印两份内容的行级差异。
 */
export function showDiff(oldContent: string, newContent: string, fileName: string): void {
  console.log(chalk.cyan(`\n📝 Changes in ${fileName}:`));
  console.log(chalk.gray('─'.repeat(60)));

  const diff: Change[] = diffLines(oldContent, newContent);
  let addedLines = 0;
  let removedLines = 0;

  diff.forEach((part) => {
    // diffLines 会把连续内容放在同一个片段，需要逐行拆分。
    const lines = part.value.split('\n').filter((line, index, arr) => {
      // 移除 diff 在文件末尾换行时生成的空行。
      return index < arr.length - 1 || line !== '';
    });

    lines.forEach((line) => {
      if (part.added) {
        console.log(chalk.green(`+ ${line}`));
        addedLines++;
      } else if (part.removed) {
        console.log(chalk.red(`- ${line}`));
        removedLines++;
      } else {
        console.log(chalk.gray(`  ${line}`));
      }
    });
  });

  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.cyan(`Summary: ${chalk.green(`+${addedLines}`)} ${chalk.red(`-${removedLines}`)} lines`));
}

/**
 * 统计差异行数，便于生成摘要与提示。
 */
export function getDiffStats(oldContent: string, newContent: string): { added: number; removed: number } {
  const diff: Change[] = diffLines(oldContent, newContent);
  let added = 0;
  let removed = 0;

  diff.forEach((part) => {
    const lines = part.value.split('\n').filter((line, index, arr) => index < arr.length - 1 || line !== '');
    // 每个片段的有效行数作为增删统计依据。
    const lineCount = lines.length;
    if (part.added) {
      added += lineCount;
    } else if (part.removed) {
      removed += lineCount;
    }
  });

  return { added, removed };
}
