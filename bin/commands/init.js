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
// 模板中需要忽略的目录或文件，防止复制依赖和构建产物。
const TEMPLATE_IGNORE_ENTRIES = new Set(["node_modules", ".pnpm", "dist"]);
// 将模板目录内容完整复制到目标目录（保留原有目录结构）。
async function copyTemplateContents(templatesDir, targetDir) {
	const entries = await fs.readdir(templatesDir, { withFileTypes: true });
	for (const entry of entries) {
		if (TEMPLATE_IGNORE_ENTRIES.has(entry.name)) {
			continue;
		}
		const sourcePath = path.join(templatesDir, entry.name);
		const destinationPath = path.join(targetDir, entry.name);
		if (entry.isDirectory()) {
			// 目录采用递归拷贝，保持层级结构。
			await copyDirectory(sourcePath, destinationPath);
			console.log(chalk.green(`✓ Copied ${entry.name}/`));
		} else {
			// 普通文件直接复制。
			await fs.copyFile(sourcePath, destinationPath);
			console.log(chalk.green(`✓ Copied ${entry.name}`));
		}
	}
}
// CLI init 子命令：根据模板创建一个新的项目目录。
export async function init(projectName) {
	console.log(chalk.blue(`\n🚀 Initializing YXP project: ${projectName}\n`));
	const targetDir = path.resolve(process.cwd(), projectName);
	const templatesDir = path.resolve(__dirname, "../../templates");
	// 1. 确保目标目录尚不存在。
	if (await fileExists(targetDir)) {
		console.log(chalk.red(`❌ Directory ${projectName} already exists!`));
		process.exit(1);
	}
	try {
		// 2. 创建项目目录结构。
		await fs.mkdir(targetDir, { recursive: true });
		console.log(chalk.green(`✓ Created directory: ${projectName}`));
		// 3. 将模板文件复制到项目目录。
		console.log(chalk.blue("\n📦 Copying template files..."));
		await copyTemplateContents(templatesDir, targetDir);
		console.log(chalk.blue("\n🪄 Customizing template placeholders..."));
		await applyTemplatePlaceholders(targetDir, projectName);
		// 4. 将 package.json 中的名称替换为项目名。
		console.log(chalk.blue("\n📝 Customizing package.json..."));
		await customizePackageJson(targetDir, projectName);
		console.log(chalk.green("✓ Customized package.json"));
		// 5. 完成初始化并输出后续指引。
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
// 替换模板中的占位符，例如 README 里的 {{projectName}}。
async function applyTemplatePlaceholders(targetDir, projectName) {
	const filesToCustomize = ["README.md"];
	for (const relativePath of filesToCustomize) {
		const absolutePath = path.join(targetDir, relativePath);
		if (!(await fileExists(absolutePath))) {
			continue;
		}
		const content = await fs.readFile(absolutePath, "utf-8");
		// 使用全局正则替换所有 {{projectName}} 占位符。
		const replaced = content.replace(/{{projectName}}/g, projectName);
		if (content !== replaced) {
			await fs.writeFile(absolutePath, replaced);
			console.log(chalk.green(`✓ Customized ${relativePath}`));
		}
	}
}
// 调整 package.json：设置项目名并移除模板特有依赖。
async function customizePackageJson(targetDir, projectName) {
	const packagePath = path.join(targetDir, "package.json");
	if (!(await fileExists(packagePath))) {
		console.log(
			chalk.yellow(
				"⚠️  package.json not found in template, skipping customization.",
			),
		);
		return;
	}
	const packageJson = await readJsonFile(packagePath);
	// 将项目名称替换为用户指定的名称。
	packageJson.name = projectName;
	if (!packageJson.devDependencies) {
		packageJson.devDependencies = {};
	}
	if (packageJson.devDependencies["yxp-starter"]) {
		// 模板自身依赖仅在模板项目里需要，初始化后移除。
		const { "yxp-starter": _removed, ...rest } = packageJson.devDependencies;
		packageJson.devDependencies = rest;
	}
	await writeJsonFile(packagePath, packageJson);
}
