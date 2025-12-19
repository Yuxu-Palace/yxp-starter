import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import prompts from 'prompts';
import { TEMPLATE_IGNORE_ENTRIES } from '../core/update/constants';
import { copyDirectory, fileExists } from '../utils/fs';
import { readJsonFile, writeJsonFile } from '../utils/json';
import { logger } from '../utils/logger';
import { preservePackageFields } from '../utils/package-json';
import { ensureTemplateReady, selectDownloader } from '../utils/template-fetch';
import {
  buildStoredTemplateManifest,
  chooseTemplate,
  findTemplateOrThrow,
  listTemplateOptions,
  type TemplateOption,
  writeStoredTemplate,
} from '../utils/templates';

/**
 * 将模板文件复制到目标目录。
 */
async function copyTemplateContents(templatesDir: string, targetDir: string): Promise<void> {
  const entries = await fs.readdir(templatesDir, { withFileTypes: true });

  for (let index = 0; index < entries.length; ++index) {
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
export async function init(rawProjectName: string | undefined, options: InitCommandOptions = {}): Promise<void> {
  logger.info('\n🚀 Welcome to use yxp cli to initialize the project.\n');

  try {
    const projectName = await resolveProjectName(rawProjectName);
    const targetDir = path.resolve(process.cwd(), projectName);

    if (await fileExists(targetDir)) {
      logger.error(`❌ Directory ${projectName} already exists!`);
      process.exit(1);
    }

    const downloader = await selectDownloader();
    const template = await resolveTemplateSelection(options.template);
    logger.info(`\n🧩 Using template: ${template.displayName} (${template.name})\n`);

    const { path: templateDir, downloader: usedDownloader } = await ensureTemplateReady(template, downloader);

    await fs.mkdir(targetDir, { recursive: true });
    logger.success(`✓ Created directory: ${projectName}`);

    logger.info('\n📦 Copying template files...');
    await copyTemplateContents(templateDir, targetDir);

    logger.info('\n🪄 Customizing template placeholders...');
    await applyTemplatePlaceholders(targetDir, projectName);

    logger.info('\n📝 Customizing package.json...');
    await customizePackageJson(targetDir, projectName, template);
    logger.success('✓ Customized package.json');

    const manifest = buildStoredTemplateManifest({
      name: template.name,
      source: template.source,
      downloader: usedDownloader,
    });
    await writeStoredTemplate(targetDir, manifest);

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

/**
 * 解析项目名称，若未提供则通过交互式提问获取。
 */
async function resolveProjectName(inputName?: string): Promise<string> {
  const normalized = inputName?.trim();
  if (normalized) {
    return normalized;
  }

  const { projectName } = await prompts(
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name',
      initial: 'my-project',
      validate: (value: string) => value.trim().length > 0 || 'Please enter a project name.',
    },
    {
      onCancel: () => {
        throw new Error('Project initialization cancelled.');
      },
    },
  );

  return projectName.trim();
}

/**
 * 根据用户输入或交互式选择确定要使用的模板。
 */
async function resolveTemplateSelection(specifiedTemplate?: string): Promise<TemplateOption> {
  if (specifiedTemplate) {
    try {
      return await findTemplateOrThrow(specifiedTemplate);
    } catch {
      const options = await listTemplateOptions();
      const available = options.map((option) => option.name).join(', ') || 'none';
      logger.error(`❌ Template "${specifiedTemplate}" not found.`);
      logger.note(`Available templates: ${available}`);
      process.exit(1);
    }
  }

  return chooseTemplate('Select a project template');
}

// 仅挑选初始化阶段会用到的 package.json 字段。
type TemplatePackageJson = {
  name?: string;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
};

const DEFAULT_PACKAGE_FIELDS_TO_PRESERVE = ['name'] as const;

function resolvePackageFieldsToPreserve(template: TemplateOption): string[] {
  const configured = template.packageFieldsToPreserve ?? [];
  if (configured.length === 0) {
    return [...DEFAULT_PACKAGE_FIELDS_TO_PRESERVE];
  }

  const deduped = new Set<string>(DEFAULT_PACKAGE_FIELDS_TO_PRESERVE);
  for (let index = 0; index < configured.length; ++index) {
    const field = configured[index];
    if (typeof field === 'string' && field.length > 0) {
      deduped.add(field);
    }
  }
  return Array.from(deduped);
}

/**
 * 替换模板文件中的占位符（例如 README 内的 {{projectName}}）。
 */
async function applyTemplatePlaceholders(targetDir: string, projectName: string): Promise<void> {
  const filesToCustomize = ['README.md'];

  for (let index = 0; index < filesToCustomize.length; ++index) {
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
async function customizePackageJson(targetDir: string, projectName: string, template: TemplateOption): Promise<void> {
  const packagePath = path.join(targetDir, 'package.json');
  if (!(await fileExists(packagePath))) {
    logger.warn('⚠️  package.json not found in template, skipping customization.');
    return;
  }

  const packageObj = await readJsonFile<TemplatePackageJson>(packagePath);

  const fieldsToPreserve = resolvePackageFieldsToPreserve(template);
  const enforcedFields: Record<string, unknown> = {
    name: projectName,
  };
  const packageJson = preservePackageFields(packageObj, enforcedFields, fieldsToPreserve);

  await writeJsonFile(packagePath, packageJson);
}
