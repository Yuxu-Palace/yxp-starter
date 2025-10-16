import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { TEMPLATE_IGNORE_ENTRIES } from '../core/update/constants.js';
import { copyDirectory, fileExists } from '../utils/fs.js';
import { readJsonFile, writeJsonFile } from '../utils/json.js';
import { logger } from '../utils/logger.js';
import { applyPackageNameField } from '../utils/package-json.js';
import { chooseTemplate, listTemplateOptions, type TemplateOption, writeStoredTemplate } from '../utils/templates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 将模板文件复制到目标目录。
 */
async function copyTemplateContents(templatesDir: string, targetDir: string): Promise<void> {
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (TEMPLATE_IGNORE_ENTRIES.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(templatesDir, entry.name);
    const destinationPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      logger.success(`✓ Copied ${entry.name}/`);
    } else {
      await fs.copyFile(sourcePath, destinationPath);
      logger.success(`✓ Copied ${entry.name}`);
    }
  }
}

interface InitCommandOptions {
  template?: string;
}

/**
 * 初始化新项目。
 */
export async function init(projectName: string, options: InitCommandOptions = {}): Promise<void> {
  logger.info('\n🚀 Welcome to use yxp cli to initialize the project.\n');

  const targetDir = path.resolve(process.cwd(), projectName);
  const templatesRoot = path.resolve(__dirname, '../../templates');

  if (await fileExists(targetDir)) {
    logger.error(`❌ Directory ${projectName} already exists!`);
    process.exit(1);
  }

  try {
    const template = await resolveTemplateSelection(templatesRoot, options.template);
    logger.info(`\n🧩 Using template: ${template.name}\n`);

    await fs.mkdir(targetDir, { recursive: true });
    logger.success(`✓ Created directory: ${projectName}`);

    logger.info('\n📦 Copying template files...');
    await copyTemplateContents(template.path, targetDir);

    logger.info('\n🪄 Customizing template placeholders...');
    await applyTemplatePlaceholders(targetDir, projectName);

    logger.info('\n📝 Customizing package.json...');
    await customizePackageJson(targetDir, projectName);
    logger.success('✓ Customized package.json');

    await writeStoredTemplate(targetDir, template.name);

    logger.success(`\n✅ Project ${projectName} created successfully!\n`);
    logger.detail('Next steps:');
    logger.note(`  cd ${projectName}`);
    logger.note('  pnpm install');
    logger.note('  pnpm dev\n');
  } catch (error) {
    logger.error('\n❌ Failed to create project:', error);
    process.exit(1);
  }
}

async function resolveTemplateSelection(templatesRoot: string, specifiedTemplate?: string): Promise<TemplateOption> {
  if (specifiedTemplate) {
    const options = await listTemplateOptions(templatesRoot);
    const matched = options.find((option) => option.name === specifiedTemplate);
    if (!matched) {
      const available = options.map((option) => option.name).join(', ') || 'none';
      logger.error(`❌ Template "${specifiedTemplate}" not found.`);
      logger.note(`Available templates: ${available}`);
      process.exit(1);
    }
    return matched;
  }

  return chooseTemplate(templatesRoot, 'Select a project template');
}

// 仅挑选初始化阶段会用到的 package.json 字段。
type TemplatePackageJson = {
  name?: string;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

/**
 * 替换模板文件中的占位符（例如 README 内的 {{projectName}}）。
 */
async function applyTemplatePlaceholders(targetDir: string, projectName: string): Promise<void> {
  const filesToCustomize = ['README.md'];

  for (let index = 0; index < filesToCustomize.length; index += 1) {
    const relativePath = filesToCustomize[index];
    const absolutePath = path.join(targetDir, relativePath);
    if (!(await fileExists(absolutePath))) {
      continue;
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const replaced = content.replace(/{{projectName}}/g, projectName);

    if (content !== replaced) {
      await fs.writeFile(absolutePath, replaced);
      logger.success(`✓ Customized ${relativePath}`);
    }
  }
}

/**
 * 更新 package.json，写入项目名。
 */
async function customizePackageJson(targetDir: string, projectName: string): Promise<void> {
  const packagePath = path.join(targetDir, 'package.json');
  if (!(await fileExists(packagePath))) {
    logger.warn('⚠️  package.json not found in template, skipping customization.');
    return;
  }

  const packageObj = await readJsonFile<TemplatePackageJson>(packagePath);

  const packageJson = applyPackageNameField(packageObj, projectName);
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  await writeJsonFile(packagePath, packageJson);
}
