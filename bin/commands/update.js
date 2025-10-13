import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import prompts from "prompts";
import { getDiffStats, showDiff } from "../utils/diff.js";
import { fileExists, readFileContent, readJsonFile } from "../utils/fs.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 模板中需要跳过的目录，避免复制依赖或临时文件。
const IGNORED_TEMPLATE_ENTRIES = new Set([
	"node_modules",
	".pnpm",
	".git",
	"dist",
]);
// 项目扫描时忽略的目录，防止误将构建产物纳入同步。
const IGNORED_PROJECT_ENTRIES = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".turbo",
	"coverage",
]);
// 模板里含有动态内容的文件，更新时默认跳过。
const SKIPPED_DYNAMIC_FILES = new Set(["README.md"]);
// 扫描模板目录，收集所有需要同步的文件。
async function scanTemplateFiles(templatesDir) {
	const files = [];
	await scanDirectory(templatesDir, templatesDir, files);
	return files;
}
// 递归遍历目录并记录文件路径。
async function scanDirectory(dirPath, basePath, files) {
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		if (IGNORED_TEMPLATE_ENTRIES.has(entry.name)) {
			continue;
		}
		const fullPath = path.join(dirPath, entry.name);
		const relativePath = path.relative(basePath, fullPath);
		if (entry.isDirectory()) {
			await scanDirectory(fullPath, basePath, files);
		} else if (entry.isFile()) {
			files.push({
				path: relativePath,
				description: `Template file: ${relativePath}`,
			});
		}
	}
}
// 提取模板文件的顶级目录，用于限定项目扫描范围。
function getTopLevelEntries(files) {
	const entries = new Set();
	for (const file of files) {
		const [topLevel] = file.path.split(path.sep);
		entries.add(topLevel ?? file.path);
	}
	return entries;
}
// Directories managed for template synchronisation; files outside stay untouched.
// 只有列出的目录会进行同步，其他路径保持项目本地版本。
const MANAGED_DIRECTORIES = new Set([
	".github",
	".husky",
	".vscode",
	"templates",
	"src",
	"tests",
]);
// 按模板目录，扫描项目中待对齐的文件并收集路径。
async function scanProjectFiles(currentDir, templateFiles) {
	const results = new Set();
	const topLevelEntries = getTopLevelEntries(templateFiles);
	for (const entry of topLevelEntries) {
		const projectPath = path.join(currentDir, entry);
		if (!(await fileExists(projectPath))) {
			continue;
		}
		const stats = await fs.lstat(projectPath);
		if (stats.isDirectory()) {
			if (!MANAGED_DIRECTORIES.has(entry)) {
				continue;
			}
			await scanProjectDirectory(projectPath, currentDir, results);
		} else if (stats.isFile()) {
			results.add(entry);
		}
	}
	return results;
}
// 递归记录项目目录中的文件路径。
async function scanProjectDirectory(dirPath, basePath, files) {
	const entries = await fs.readdir(dirPath, { withFileTypes: true });
	for (const entry of entries) {
		if (IGNORED_PROJECT_ENTRIES.has(entry.name)) {
			continue;
		}
		const fullPath = path.join(dirPath, entry.name);
		const relativePath = path.relative(basePath, fullPath);
		if (entry.isDirectory()) {
			await scanProjectDirectory(fullPath, basePath, files);
		} else if (entry.isFile()) {
			files.add(relativePath);
		}
	}
}
// 格式化差异统计输出，使日志更易读。
function formatStats(stats) {
	if (!stats) {
		return chalk.magenta("(binary file)");
	}
	return `(${chalk.green(`+${stats.added}`)} ${chalk.red(`-${stats.removed}`)})`;
}
// 确认当前目录具备更新条件（存在 package.json 且包含依赖标记）。
async function validateProjectContext(currentDir) {
	const packageJsonPath = path.join(currentDir, "package.json");
	if (!(await fileExists(packageJsonPath))) {
		console.log(
			chalk.red("❌ No package.json found. Are you in a project directory?"),
		);
		process.exit(1);
	}
	const packageJson = await readJsonFile(packageJsonPath);
	const hasYxpStarter = Boolean(packageJson.devDependencies?.["yxp-starter"]);
	if (hasYxpStarter) {
		return true;
	}
	console.log(
		chalk.yellow("⚠️  This project does not seem to use yxp-starter."),
	);
	const { confirm } = await prompts({
		type: "confirm",
		name: "confirm",
		message: "Continue anyway?",
		initial: false,
	});
	if (!confirm) {
		console.log(chalk.gray("Update cancelled."));
		return false;
	}
	return true;
}
// 对 package.json 内容进行格式化，保证比较时忽略名称差异。
function sanitizePackageJsonContent(content, enforcedName) {
	try {
		const parsed = JSON.parse(content);
		if (typeof enforcedName === "string" && enforcedName.length > 0) {
			parsed.name = enforcedName;
		}
		const serialized = JSON.stringify(parsed, null, 2);
		return `${serialized}\n`;
	} catch {
		return content;
	}
}
// 从 package.json 的字符串内容中解析出项目名。
function getPackageName(content) {
	try {
		const parsed = JSON.parse(content);
		return typeof parsed.name === "string" ? parsed.name : undefined;
	} catch {
		return undefined;
	}
}
// 汇总模板与项目之间的差异，生成待处理的更新列表。
async function collectPendingUpdates(templatesDir, currentDir) {
	const allTemplateFiles = await scanTemplateFiles(templatesDir);
	const updates = [];
	const projectFiles = await scanProjectFiles(currentDir, allTemplateFiles);
	for (const file of allTemplateFiles) {
		if (SKIPPED_DYNAMIC_FILES.has(file.path)) {
			projectFiles.delete(file.path);
			console.log(chalk.gray(`→ Skipped ${file.path} (dynamic content)`));
			continue;
		}
		const sourcePath = path.join(templatesDir, file.path);
		const targetPath = path.join(currentDir, file.path);
		if (!(await fileExists(targetPath))) {
			const sourceResult = await readFileContent(sourcePath);
			if (sourceResult.isBinary) {
				// 目标缺失且模板是二进制文件，直接标记为新增。
				const stats = null;
				updates.push({
					kind: "add",
					file,
					stats,
					isBinary: true,
				});
				console.log(chalk.green(`+ add ${file.path} ${formatStats(stats)}`));
				continue;
			}
			const missingTargetContent = "";
			const addedSourceContent = sourceResult.content;
			const stats = getDiffStats(missingTargetContent, addedSourceContent);
			updates.push({
				kind: "add",
				file,
				stats,
				isBinary: false,
				sourceContent: addedSourceContent,
				targetContent: missingTargetContent,
			});
			console.log(chalk.green(`+ add ${file.path} ${formatStats(stats)}`));
			continue;
		}
		if (file.path === "package.json") {
			const [sourceRaw, targetRaw] = await Promise.all([
				fs.readFile(sourcePath, "utf-8"),
				fs.readFile(targetPath, "utf-8"),
			]);
			const targetName = getPackageName(targetRaw);
			const sanitizedSource = sanitizePackageJsonContent(sourceRaw, targetName);
			const sanitizedTarget = sanitizePackageJsonContent(targetRaw, targetName);
			if (sanitizedSource === sanitizedTarget) {
				console.log(chalk.gray(`→ ${file.path} is up to date`));
				projectFiles.delete(file.path);
				continue;
			}
			const stats = getDiffStats(sanitizedTarget, sanitizedSource);
			updates.push({
				kind: "modify",
				file,
				stats,
				isBinary: false,
				sourceContent: sanitizedSource,
				targetContent: sanitizedTarget,
			});
			projectFiles.delete(file.path);
			console.log(chalk.cyan(`~ modify ${file.path} ${formatStats(stats)}`));
			continue;
		}
		const [sourceResult, targetResult] = await Promise.all([
			readFileContent(sourcePath),
			readFileContent(targetPath),
		]);
		const sourceBuffer = sourceResult.isBinary
			? sourceResult.content
			: sourceResult.raw;
		const targetBuffer = targetResult.isBinary
			? targetResult.content
			: targetResult.raw;
		if (sourceBuffer.compare(targetBuffer) === 0) {
			// 原始字节一致，说明无需更新。
			console.log(chalk.gray(`→ ${file.path} is up to date`));
			projectFiles.delete(file.path);
			continue;
		}
		if (sourceResult.isBinary || targetResult.isBinary) {
			// 任一端为二进制文件，记录但不展示文本 diff。
			const stats = null;
			updates.push({
				kind: "modify",
				file,
				stats,
				isBinary: true,
			});
			projectFiles.delete(file.path);
			console.log(chalk.cyan(`~ modify ${file.path} ${formatStats(stats)}`));
			continue;
		}
		const sourceContent = sourceResult.content;
		const targetContent = targetResult.content;
		const stats = getDiffStats(targetContent, sourceContent);
		updates.push({
			kind: "modify",
			file,
			stats,
			isBinary: false,
			sourceContent,
			targetContent,
		});
		projectFiles.delete(file.path);
		console.log(chalk.cyan(`~ modify ${file.path} ${formatStats(stats)}`));
	}
	for (const projectOnlyPath of projectFiles) {
		const targetPath = path.join(currentDir, projectOnlyPath);
		if (!(await fileExists(targetPath))) {
			continue;
		}
		const targetResult = await readFileContent(targetPath);
		const file = {
			path: projectOnlyPath,
			description: `Project file: ${projectOnlyPath}`,
		};
		if (targetResult.isBinary) {
			// 项目独有的二进制文件，提示用户是否删除。
			const stats = null;
			updates.push({
				kind: "delete",
				file,
				stats,
				isBinary: true,
			});
			console.log(
				chalk.red(`- delete ${projectOnlyPath} ${formatStats(stats)}`),
			);
			continue;
		}
		const targetContent = targetResult.content;
		const stats = getDiffStats(targetContent, "");
		updates.push({
			kind: "delete",
			file,
			stats,
			isBinary: false,
			sourceContent: "",
			targetContent,
		});
		console.log(chalk.red(`- delete ${projectOnlyPath} ${formatStats(stats)}`));
	}
	updates.sort((firstUpdate, secondUpdate) => {
		if (firstUpdate.kind === secondUpdate.kind) {
			return firstUpdate.file.path.localeCompare(secondUpdate.file.path);
		}
		const priority = {
			modify: 0,
			add: 1,
			delete: 2,
		};
		return priority[firstUpdate.kind] - priority[secondUpdate.kind];
	});
	return updates;
}
// 在非交互模式下依次应用所有更新。
async function applyBatchUpdate(updates, templatesDir, currentDir) {
	for (const pending of updates) {
		await applyUpdate(pending, templatesDir, currentDir);
	}
}
// 交互式提示用户对当前差异采取的操作。
async function promptUpdateAction(pendingUpdate) {
	if (!pendingUpdate.isBinary) {
		showDiff(
			pendingUpdate.targetContent,
			pendingUpdate.sourceContent,
			pendingUpdate.file.path,
		);
	} else {
		console.log(
			chalk.gray(`
🧮 ${pendingUpdate.file.path} is a binary file; diff preview skipped.`),
		);
	}
	const statsLabel = formatStats(pendingUpdate.stats);
	const { message, choices } = buildPromptConfig(pendingUpdate, statsLabel);
	const { action } = await prompts({
		type: "select",
		name: "action",
		message,
		choices,
		initial: 0,
	});
	return action;
}
// 根据差异类型构造 prompts 的菜单配置。
function buildPromptConfig(pendingUpdate, statsLabel) {
	const fileName = chalk.cyan(pendingUpdate.file.path);
	if (pendingUpdate.kind === "add") {
		return {
			message: `Add new file ${fileName}? ${statsLabel}`,
			choices: [
				{ title: "Add (copy from template)", value: "update" },
				{ title: "Skip (keep missing)", value: "skip" },
				{ title: "Add all remaining files", value: "update-all" },
				{ title: "Skip all remaining files", value: "skip-all" },
			],
		};
	}
	if (pendingUpdate.kind === "delete") {
		return {
			message: `Delete ${fileName}? ${statsLabel}`,
			choices: [
				{ title: "Delete (remove file)", value: "update" },
				{ title: "Keep (do not delete)", value: "skip" },
				{ title: "Delete all remaining files", value: "update-all" },
				{ title: "Keep all remaining files", value: "skip-all" },
			],
		};
	}
	return {
		message: `Update ${fileName}? ${statsLabel}`,
		choices: [
			{ title: "Update (use new version)", value: "update" },
			{ title: "Skip (keep current version)", value: "skip" },
			{ title: "Update all remaining files", value: "update-all" },
			{ title: "Skip all remaining files", value: "skip-all" },
		],
	};
}
// 默认模式：逐条提示用户处理所有待更新文件。
async function runInteractiveUpdate(updates, templatesDir, currentDir) {
	for (let index = 0; index < updates.length; index += 1) {
		const pending = updates[index];
		const action = await promptUpdateAction(pending);
		if (action === "update") {
			await applyUpdate(pending, templatesDir, currentDir);
			console.log("");
			continue;
		}
		if (action === "skip") {
			console.log(chalk.yellow(`✗ Skipped ${pending.file.path}`));
			console.log("");
			continue;
		}
		if (action === "update-all") {
			await applyUpdate(pending, templatesDir, currentDir);
			console.log("");
			const remaining = updates.slice(index + 1);
			await applyBatchUpdate(remaining, templatesDir, currentDir);
			break;
		}
		console.log(chalk.yellow(`✗ Skipped ${pending.file.path}`));
		console.log(chalk.gray("Skipping all remaining files..."));
		console.log("");
		break;
	}
}
// 将单个差异应用到磁盘，包括新增、修改和删除。
async function applyUpdate(pending, templatesDir, currentDir) {
	const targetPath = path.join(currentDir, pending.file.path);
	if (pending.kind === "delete") {
		// 删除文件后尝试清理空目录，保持目录整洁。
		await fs.rm(targetPath, { force: true });
		await cleanupEmptyDirs(path.dirname(targetPath), currentDir);
		console.log(chalk.green(`✓ Deleted ${pending.file.path}`));
		return;
	}
	const sourcePath = path.join(templatesDir, pending.file.path);
	if (pending.file.path === "package.json") {
		// package.json 需要保留项目自身的 name 字段，因此额外处理。
		const sourceRaw = await fs.readFile(sourcePath, "utf-8");
		let targetName = "";
		if (await fileExists(targetPath)) {
			const targetRaw = await fs.readFile(targetPath, "utf-8");
			targetName = getPackageName(targetRaw) ?? targetName;
		}
		const sanitized = sanitizePackageJsonContent(sourceRaw, targetName);
		await fs.mkdir(path.dirname(targetPath), { recursive: true });
		await fs.writeFile(targetPath, sanitized);
		const verbLabel = pending.kind === "add" ? "Added" : "Updated";
		console.log(chalk.green(`✓ ${verbLabel} ${pending.file.path}`));
		return;
	}
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.copyFile(sourcePath, targetPath);
	const verb = pending.kind === "add" ? "Added" : "Updated";
	console.log(chalk.green(`✓ ${verb} ${pending.file.path}`));
}
// 自底向上删除空目录，避免留下无用层级。
async function cleanupEmptyDirs(startDir, stopDir) {
	try {
		let current = path.resolve(startDir);
		const stop = path.resolve(stopDir);
		while (current.startsWith(stop) && current !== stop) {
			const entries = await fs.readdir(current);
			if (entries.length > 0) {
				break;
			}
			await fs.rm(current, { recursive: false });
			current = path.dirname(current);
		}
	} catch {
		// Silently ignore cleanup failures; they are non-critical.
	}
}
export async function update(options) {
	// update 子命令入口，负责总体控制流程。
	console.log(chalk.blue("\n🔄 Updating project from yxp-starter...\n"));
	const currentDir = process.cwd();
	const templatesDir = path.resolve(__dirname, "../../templates");
	try {
		const shouldContinue = await validateProjectContext(currentDir);
		if (!shouldContinue) {
			return;
		}
		console.log(chalk.blue("📂 Scanning for updates...\n"));
		const pendingUpdates = await collectPendingUpdates(
			templatesDir,
			currentDir,
		);
		if (pendingUpdates.length === 0) {
			console.log(chalk.green("\n✅ All files are up to date!"));
			return;
		}
		console.log(
			chalk.cyan(`\n📊 Found ${pendingUpdates.length} file(s) with updates\n`),
		);
		if (options.skipAll) {
			// Skip-all 相当于 dry run，只展示日志，不执行实际更新。
			console.log(chalk.gray("Dry run mode - no files will be updated."));
			return;
		}
		if (options.all) {
			// --all 选项：不经确认直接应用全部变更。
			console.log(chalk.blue("Updating all files...\n"));
			await applyBatchUpdate(pendingUpdates, templatesDir, currentDir);
			console.log(chalk.green("\n✅ All files updated successfully!"));
			return;
		}
		await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
		console.log(chalk.green("\n✅ Update complete!"));
	} catch (error) {
		// 捕获任何未处理异常，确保 CLI 给出明确提示并以错误码退出。
		console.error(chalk.red("\n❌ Update failed:"), error);
		process.exit(1);
	}
}
