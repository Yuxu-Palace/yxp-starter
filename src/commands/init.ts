import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { copyDirectory, fileExists, readJsonFile, writeJsonFile } from '../utils/fs.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 复制模板时跳过这些目录
const TEMPLATE_IGNORE_ENTRIES = new Set(['node_modules', '.pnpm', 'dist']);

/**
 * Copy files and subdirectories from a templates directory into the target directory while skipping configured ignore entries.
 *
 * This writes files and directories under `templatesDir` into `targetDir` and logs each copied entry. Entries listed in `TEMPLATE_IGNORE_ENTRIES` are not copied.
 *
 * @param templatesDir - Filesystem path of the source templates directory
 * @param targetDir - Filesystem path of the destination project directory
 */
async function copyTemplateContents(templatesDir: string, targetDir: string): Promise<void> {
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

/**
 * Create a new project directory from the bundled template, apply placeholders, and customize package.json.
 *
 * Creates the target directory, copies template files into it (skipping configured ignore entries), replaces template placeholders (e.g., `{{projectName}}`) in selected files, and updates the template's package.json with the given project name and removal of template-only devDependencies.
 *
 * @param projectName - Name of the new project and the directory to create
 *
 * Note: the process will exit with code 1 if the target directory already exists or if an unrecoverable error occurs during initialization.
 */
export async function init(projectName: string): Promise<void> {
  console.log(chalk.blue(`\n🚀 Initializing YXP project: ${projectName}\n`));

  const targetDir = path.resolve(process.cwd(), projectName);
  const templatesDir = path.resolve(__dirname, '../../templates');

  if (await fileExists(targetDir)) {
    console.log(chalk.red(`❌ Directory ${projectName} already exists!`));
    process.exit(1);
  }

  try {
    await fs.mkdir(targetDir, { recursive: true });
    console.log(chalk.green(`✓ Created directory: ${projectName}`));

    console.log(chalk.blue('\n📦 Copying template files...'));
    await copyTemplateContents(templatesDir, targetDir);

    console.log(chalk.blue('\n🪄 Customizing template placeholders...'));
    await applyTemplatePlaceholders(targetDir, projectName);

    console.log(chalk.blue('\n📝 Customizing package.json...'));
    await customizePackageJson(targetDir, projectName);
    console.log(chalk.green('✓ Customized package.json'));

    console.log(chalk.green(`\n✅ Project ${projectName} created successfully!\n`));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray(`  cd ${projectName}`));
    console.log(chalk.gray('  pnpm install'));
    console.log(chalk.gray('  pnpm dev\n'));
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to create project:'), error);
    process.exit(1);
  }
}

// 仅挑选初始化阶段会用到的 package.json 字段。
type TemplatePackageJson = {
  name?: string;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * Replace placeholder tokens in selected template files with the project name.
 *
 * Replaces occurrences of `{{projectName}}` in configured files (currently README.md) located under the provided directory.
 *
 * @param targetDir - Path to the project directory containing the template files
 * @param projectName - Project name to substitute for `{{projectName}}` placeholders
 */
async function applyTemplatePlaceholders(targetDir: string, projectName: string): Promise<void> {
  const filesToCustomize = ['README.md'];

  for (const relativePath of filesToCustomize) {
    const absolutePath = path.join(targetDir, relativePath);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const replaced = content.replace(/{{projectName}}/g, projectName);

    if (content !== replaced) {
      await fs.writeFile(absolutePath, replaced);
      console.log(chalk.green(`✓ Customized ${relativePath}`));
    }
  }
}

/**
 * Update package.json in the target directory: set the package name to `projectName` and remove the template-only devDependency `"yxp-starter"`.
 *
 * @param targetDir - Absolute path to the generated project directory containing package.json
 * @param projectName - The name to set in package.json
 */
async function customizePackageJson(targetDir: string, projectName: string): Promise<void> {
  const packagePath = path.join(targetDir, 'package.json');
  if (!(await fileExists(packagePath))) {
    console.log(chalk.yellow('⚠️  package.json not found in template, skipping customization.'));
    return;
  }

  const packageJson = await readJsonFile<TemplatePackageJson>(packagePath);
  packageJson.name = projectName;
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  if (packageJson.devDependencies['yxp-starter']) {
    // 模板依赖仅在模板项目需要，初始化后移除
    const { 'yxp-starter': _removed, ...rest } = packageJson.devDependencies;
    packageJson.devDependencies = rest;
  }

  await writeJsonFile(packagePath, packageJson);
}
