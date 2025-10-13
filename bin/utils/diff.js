import chalk from "chalk";
import { diffLines } from "diff";
// 以彩色文本形式打印两个字符串的差异，利于用户在终端预览。
export function showDiff(oldContent, newContent, fileName) {
	console.log(chalk.cyan(`\n📝 Changes in ${fileName}:`));
	console.log(chalk.gray("─".repeat(60)));
	const diff = diffLines(oldContent, newContent);
	let addedLines = 0;
	let removedLines = 0;
	diff.forEach((part) => {
		// diffLines 会把连续内容放在同一个片段（part）中，需逐行处理。
		const lines = part.value.split("\n").filter((line, index, arr) => {
			// 移除 diff 在文件末尾换行时额外生成的空行。
			return index < arr.length - 1 || line !== "";
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
	console.log(chalk.gray("─".repeat(60)));
	console.log(
		chalk.cyan(
			`Summary: ${chalk.green(`+${addedLines}`)} ${chalk.red(`-${removedLines}`)} lines`,
		),
	);
}
// 统计差异行数，用于生成 Summary 和提示文案。
export function getDiffStats(oldContent, newContent) {
	const diff = diffLines(oldContent, newContent);
	let added = 0;
	let removed = 0;
	diff.forEach((part) => {
		const lines = part.value.split("\n").filter((line, index, arr) => {
			return index < arr.length - 1 || line !== "";
		});
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
