import chalk from "chalk";
import { type Change, diffLines } from "diff";

export function showDiff(
	oldContent: string,
	newContent: string,
	fileName: string,
): void {
	console.log(chalk.cyan(`\n📝 Changes in ${fileName}:`));
	console.log(chalk.gray("─".repeat(60)));

	const diff: Change[] = diffLines(oldContent, newContent);
	let addedLines = 0;
	let removedLines = 0;

	diff.forEach((part) => {
		const lines = part.value.split("\n").filter((line, index, arr) => {
			// 过滤掉最后一个空行
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

export function getDiffStats(
	oldContent: string,
	newContent: string,
): { added: number; removed: number } {
	const diff: Change[] = diffLines(oldContent, newContent);
	let added = 0;
	let removed = 0;

	diff.forEach((part) => {
		const lineCount = part.value.split("\n").length - 1;
		if (part.added) {
			added += lineCount;
		} else if (part.removed) {
			removed += lineCount;
		}
	});

	return { added, removed };
}
