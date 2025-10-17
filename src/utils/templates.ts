import type { Dirent } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { fileExists } from './fs';

/** 模板记录文件名。 */
const TEMPLATE_MANIFEST = '.yxp-template';

/** 模板选择项。 */
export interface TemplateOption {
  name: string;
  path: string;
}

/**
 * 列出模板根目录下的所有模板目录。
 */
export async function listTemplateOptions(templatesRoot: string): Promise<TemplateOption[]> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(templatesRoot, { withFileTypes: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to access template directory at ${templatesRoot}: ${message}`);
  }

  const options: TemplateOption[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.isDirectory()) {
      options.push({
        name: entry.name,
        path: path.join(templatesRoot, entry.name),
      });
    }
  }

  return options;
}

/**
 * 交互式选择模板，支持提供默认模板名。
 */
export async function chooseTemplate(
  templatesRoot: string,
  message: string,
  defaultTemplate?: string,
): Promise<TemplateOption> {
  let options: TemplateOption[];

  try {
    options = await listTemplateOptions(templatesRoot);
  } catch (error) {
    throw new Error(
      `No templates available. Failed to resolve template directory at ${templatesRoot}. ` +
        'Please ensure the CLI package includes the templates folder.' +
        ` Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (options.length === 0) {
    throw new Error('No templates found. Please add a template before continuing.');
  }

  const defaultIndex = Math.max(
    defaultTemplate ? options.findIndex((option) => option.name === defaultTemplate) : 0,
    0,
  );

  const { template } = await prompts(
    {
      type: 'select',
      name: 'template',
      message,
      choices: options.map((option) => {
        return { title: option.name, value: option.name };
      }),
      initial: defaultIndex,
    },
    {
      onCancel: () => {
        throw new Error('Template selection cancelled.');
      },
    },
  );

  const selected = options.find((option) => option.name === template);
  if (!selected) {
    throw new Error('Unexpected error while selecting template.');
  }

  return selected;
}

/**
 * 从项目根目录读取已记录的模板名称。
 */
export async function readStoredTemplate(projectDir: string): Promise<string | null> {
  const manifestPath = path.join(projectDir, TEMPLATE_MANIFEST);
  if (!(await fileExists(manifestPath))) {
    return null;
  }

  const stored = await fs.readFile(manifestPath, 'utf-8');
  const name = stored.trim();
  return name.length > 0 ? name : null;
}

/**
 * 将当前模板名称写入项目根目录。
 */
export async function writeStoredTemplate(projectDir: string, templateName: string): Promise<void> {
  const manifestPath = path.join(projectDir, TEMPLATE_MANIFEST);
  await fs.writeFile(manifestPath, `${templateName}\n`, 'utf-8');
}
