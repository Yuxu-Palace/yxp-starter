import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import prompts from "prompts";
import { getDiffStats, showDiff } from "../utils/diff.js";
import { fileExists, readJsonFile } from "../utils/fs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface UpdateOptions {
	all?: boolean;
	skipAll?: boolean;
}

interface FileUpdate {
	path: string;
	description: string;
}

type ProjectPackageJson = {
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
};

interface DiffStats {
	added: number;
	removed: number;
}

type UpdateKind = "modify" | "add" | "delete";

interface PendingUpdate {
	kind: UpdateKind;
	file: FileUpdate;
	stats: DiffStats;
	sourceContent: string;
	targetContent: string;
}

const IGNORED_TEMPLATE_ENTRIES = new Set(["node_modules", ".pnpm", "dist"]);
const IGNORED_PROJECT_ENTRIES = new Set([
	"node_modules",
	".git",
	"dist",
	"build",
	".turbo",
	"coverage",
]);
const SKIPPED_DYNAMIC_FILES = new Set(["README.md"]);

async function scanTemplateFiles(templatesDir: string): Promise<FileUpdate[]> {
	const files: FileUpdate[] = [];
	await scanDirectory(templatesDir, templatesDir, files);
	return files;
}

async function scanDirectory(
	dirPath: string,
	basePath: string,
	files: FileUpdate[],
): Promise<void> {
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

function getTopLevelEntries(files: FileUpdate[]): Set<string> {
	const entries = new Set<string>();

	for (const file of files) {
		const [topLevel] = file.path.split(path.sep);
		entries.add(topLevel ?? file.path);
	}

	return entries;
}

// Directories managed for template synchronisation; files outside stay untouched.
const MANAGED_DIRECTORIES = new Set([
	".github",
	".husky",
	".vscode",
	"templates",
	"src",
	"tests",
]);

async function scanProjectFiles(
	currentDir: string,
	templateFiles: FileUpdate[],
): Promise<Set<string>> {
	const results = new Set<string>();
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

async function scanProjectDirectory(
	dirPath: string,
	basePath: string,
	files: Set<string>,
): Promise<void> {
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

function formatStats(stats: DiffStats): string {
	return `(${chalk.green(`+${stats.added}`)} ${chalk.red(`-${stats.removed}`)})`;
}

async function validateProjectContext(currentDir: string): Promise<boolean> {
	const packageJsonPath = path.join(currentDir, "package.json");

	if (!(await fileExists(packageJsonPath))) {
		console.log(
			chalk.red("❌ No package.json found. Are you in a project directory?"),
		);
		process.exit(1);
	}

	const packageJson = await readJsonFile<ProjectPackageJson>(packageJsonPath);
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

function sanitizePackageJsonContent(
	content: string,
	enforcedName?: string,
): string {
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

function getPackageName(content: string): string | undefined {
	try {
		const parsed = JSON.parse(content);
		return typeof parsed.name === "string" ? parsed.name : undefined;
	} catch {
		return undefined;
	}
}

async function collectPendingUpdates(
	templatesDir: string,
	currentDir: string,
): Promise<PendingUpdate[]> {
	const allTemplateFiles = await scanTemplateFiles(templatesDir);
	const updates: PendingUpdate[] = [];

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
			const addedSourceContent = await fs.readFile(sourcePath, "utf-8");
			const missingTargetContent = "";
			const stats = getDiffStats(missingTargetContent, addedSourceContent);
			updates.push({
				kind: "add",
				file,
				stats,
				sourceContent: addedSourceContent,
				targetContent: missingTargetContent,
			});
			console.log(
				chalk.green(`🆕 ${file.path} will be added ${formatStats(stats)}`),
			);
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
				sourceContent: sanitizedSource,
				targetContent: sanitizedTarget,
			});
			projectFiles.delete(file.path);
			console.log(
				chalk.cyan(`📝 ${file.path} has changes ${formatStats(stats)}`),
			);
			continue;
		}

		const [sourceContent, targetContent] = await Promise.all([
			fs.readFile(sourcePath, "utf-8"),
			fs.readFile(targetPath, "utf-8"),
		]);

		if (sourceContent === targetContent) {
			console.log(chalk.gray(`→ ${file.path} is up to date`));
			projectFiles.delete(file.path);
			continue;
		}

		const stats = getDiffStats(targetContent, sourceContent);
		updates.push({ kind: "modify", file, stats, sourceContent, targetContent });
		projectFiles.delete(file.path);

		console.log(
			chalk.cyan(`📝 ${file.path} has changes ${formatStats(stats)}`),
		);
	}

	for (const projectOnlyPath of projectFiles) {
		const targetPath = path.join(currentDir, projectOnlyPath);

		if (!(await fileExists(targetPath))) {
			continue;
		}

		const targetContent = await fs.readFile(targetPath, "utf-8");
		const stats = getDiffStats(targetContent, "");
		const file: FileUpdate = {
			path: projectOnlyPath,
			description: `Project file: ${projectOnlyPath}`,
		};
		updates.push({
			kind: "delete",
			file,
			stats,
			sourceContent: "",
			targetContent,
		});
		console.log(
			chalk.red(
				`🗑️  ${projectOnlyPath} only exists in project ${formatStats(stats)}`,
			),
		);
	}

	updates.sort((firstUpdate, secondUpdate) => {
		if (firstUpdate.kind === secondUpdate.kind) {
			return firstUpdate.file.path.localeCompare(secondUpdate.file.path);
		}
		const priority: Record<UpdateKind, number> = {
			modify: 0,
			add: 1,
			delete: 2,
		};
		return priority[firstUpdate.kind] - priority[secondUpdate.kind];
	});

	return updates;
}

async function applyBatchUpdate(
	updates: PendingUpdate[],
	templatesDir: string,
	currentDir: string,
): Promise<void> {
	for (const pending of updates) {
		await applyUpdate(pending, templatesDir, currentDir);
	}
}

type UpdateAction = "update" | "skip" | "update-all" | "skip-all";

async function promptUpdateAction(
	pendingUpdate: PendingUpdate,
): Promise<UpdateAction> {
	showDiff(
		pendingUpdate.targetContent,
		pendingUpdate.sourceContent,
		pendingUpdate.file.path,
	);

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

function buildPromptConfig(
	pendingUpdate: PendingUpdate,
	statsLabel: string,
): { message: string; choices: { title: string; value: UpdateAction }[] } {
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

async function runInteractiveUpdate(
	updates: PendingUpdate[],
	templatesDir: string,
	currentDir: string,
): Promise<void> {
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

async function applyUpdate(
	pending: PendingUpdate,
	templatesDir: string,
	currentDir: string,
): Promise<void> {
	const targetPath = path.join(currentDir, pending.file.path);

	if (pending.kind === "delete") {
		await fs.rm(targetPath, { force: true });
		await cleanupEmptyDirs(path.dirname(targetPath), currentDir);
		console.log(chalk.green(`✓ Deleted ${pending.file.path}`));
		return;
	}

	const sourcePath = path.join(templatesDir, pending.file.path);
	if (pending.file.path === "package.json") {
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

async function cleanupEmptyDirs(
	startDir: string,
	stopDir: string,
): Promise<void> {
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

export async function update(options: UpdateOptions): Promise<void> {
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
			console.log(chalk.gray("Dry run mode - no files will be updated."));
			return;
		}

		if (options.all) {
			console.log(chalk.blue("Updating all files...\n"));
			await applyBatchUpdate(pendingUpdates, templatesDir, currentDir);
			console.log(chalk.green("\n✅ All files updated successfully!"));
			return;
		}

		await runInteractiveUpdate(pendingUpdates, templatesDir, currentDir);
		console.log(chalk.green("\n✅ Update complete!"));
	} catch (error) {
		console.error(chalk.red("\n❌ Update failed:"), error);
		process.exit(1);
	}
}
