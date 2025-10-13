import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import {
	copyDirectory,
	fileExists,
	readJsonFile,
	writeJsonFile,
} from "../utils/fs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATE_IGNORE_ENTRIES = new Set(["node_modules", ".pnpm", "dist"]);

async function copyTemplateContents(
	templatesDir: string,
	targetDir: string,
): Promise<void> {
	const entries = await fs.readdir(templatesDir, { withFileTypes: true });

	for (const entry of entries) {
		if (TEMPLATE_IGNORE_ENTRIES.has(entry.name)) {
			continue;
		}

		const sourcePath = path.join(templatesDir, entry.name);
		const destinationPath = path.join(targetDir, entry.name);

		if (entry.isDirectory()) {
			await copyDirectory(sourcePath, destinationPath);
			console.log(chalk.green(`✓ Copied ${entry.name}/`));
		} else {
			await fs.copyFile(sourcePath, destinationPath);
			console.log(chalk.green(`✓ Copied ${entry.name}`));
		}
	}
}

export async function init(projectName: string): Promise<void> {
	console.log(chalk.blue(`\n🚀 Initializing YXP project: ${projectName}\n`));

	const targetDir = path.resolve(process.cwd(), projectName);
	const templatesDir = path.resolve(__dirname, "../../templates");

	// 1. 检查目标目录是否存在
	if (await fileExists(targetDir)) {
		console.log(chalk.red(`❌ Directory ${projectName} already exists!`));
		process.exit(1);
	}

	try {
		// 2. 创建项目目录
		await fs.mkdir(targetDir, { recursive: true });
		console.log(chalk.green(`✓ Created directory: ${projectName}`));

		// 3. 复制模板文件
		console.log(chalk.blue("\n📦 Copying template files..."));
		await copyTemplateContents(templatesDir, targetDir);

		console.log(chalk.blue("\n🪄 Customizing template placeholders..."));
		await applyTemplatePlaceholders(targetDir, projectName);

		// 4. 调整 package.json
		console.log(chalk.blue("\n📝 Customizing package.json..."));
		await customizePackageJson(targetDir, projectName);
		console.log(chalk.green("✓ Customized package.json"));

		// 6. 完成
		console.log(
			chalk.green(`\n✅ Project ${projectName} created successfully!\n`),
		);
		console.log(chalk.cyan("Next steps:"));
		console.log(chalk.gray(`  cd ${projectName}`));
		console.log(chalk.gray("  pnpm install"));
		console.log(chalk.gray("  pnpm dev\n"));
	} catch (error) {
		console.error(chalk.red("\n❌ Failed to create project:"), error);
		process.exit(1);
	}
}

type TemplatePackageJson = {
	name?: string;
	devDependencies?: Record<string, string>;
	[key: string]: unknown;
};

async function applyTemplatePlaceholders(
	targetDir: string,
	projectName: string,
): Promise<void> {
	const filesToCustomize = ["README.md"];

	for (const relativePath of filesToCustomize) {
		const absolutePath = path.join(targetDir, relativePath);
		if (!(await fileExists(absolutePath))) {
			continue;
		}

		const content = await fs.readFile(absolutePath, "utf-8");
		const replaced = content.replace(/{{projectName}}/g, projectName);

		if (content !== replaced) {
			await fs.writeFile(absolutePath, replaced);
			console.log(chalk.green(`✓ Customized ${relativePath}`));
		}
	}
}

async function customizePackageJson(
	targetDir: string,
	projectName: string,
): Promise<void> {
	const packagePath = path.join(targetDir, "package.json");
	if (!(await fileExists(packagePath))) {
		console.log(
			chalk.yellow(
				"⚠️  package.json not found in template, skipping customization.",
			),
		);
		return;
	}

	const packageJson = await readJsonFile<TemplatePackageJson>(packagePath);
	packageJson.name = projectName;
	if (!packageJson.devDependencies) {
		packageJson.devDependencies = {};
	}

	if (packageJson.devDependencies["yxp-starter"]) {
		const { "yxp-starter": _removed, ...rest } = packageJson.devDependencies;
		packageJson.devDependencies = rest;
	}

	await writeJsonFile(packagePath, packageJson);
}
