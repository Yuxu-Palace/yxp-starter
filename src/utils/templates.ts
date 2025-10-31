import { promises as fs } from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { fileExists } from './fs';
import { readJsonFile, writeJsonFile } from './json';
import {
  findTemplateDefinition,
  listTemplateDefinitions,
  type TemplateDefinition,
  type TemplateSource,
} from './template-config';

/** 模板记录文件名。 */
const TEMPLATE_MANIFEST = '.yxp-template';

export type TemplateOption = TemplateDefinition;

export interface StoredTemplateManifest {
  name: string;
  commit: string;
  source: TemplateSource;
  appliedAt: string;
  downloader?: string;
}

export async function listTemplateOptions(): Promise<TemplateOption[]> {
  return listTemplateDefinitions();
}

/**
 * 交互式选择模板，支持提供默认模板名。
 */
export async function chooseTemplate(message: string, defaultTemplate?: string): Promise<TemplateOption> {
  const options = await listTemplateOptions();

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
        return {
          title: option.displayName,
          value: option.name,
          description: option.description,
        };
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
 * 读取项目目录中记录的模板信息。
 */
export async function readStoredTemplate(projectDir: string): Promise<StoredTemplateManifest | null> {
  const manifestPath = path.join(projectDir, TEMPLATE_MANIFEST);
  if (!(await fileExists(manifestPath))) {
    return null;
  }

  try {
    return await readJsonFile<StoredTemplateManifest>(manifestPath);
  } catch {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    const legacyName = raw.trim();
    if (!legacyName) {
      return null;
    }

    const definition = await findTemplateDefinition(legacyName);
    if (!definition) {
      throw new Error(`Unknown template "${legacyName}" recorded in legacy manifest.`);
    }

    return {
      name: legacyName,
      commit: 'legacy',
      source: definition.source,
      appliedAt: new Date(0).toISOString(),
    } as StoredTemplateManifest;
  }
}

/**
 * 将当前模板信息写入项目根目录。
 */
export async function writeStoredTemplate(projectDir: string, manifest: StoredTemplateManifest): Promise<void> {
  const manifestPath = path.join(projectDir, TEMPLATE_MANIFEST);
  await writeJsonFile(manifestPath, manifest);
}

export async function findTemplateOrThrow(name: string): Promise<TemplateDefinition> {
  const template = await findTemplateDefinition(name);
  if (!template) {
    throw new Error(`Template "${name}" is not defined in template.json.`);
  }
  return template;
}
