import path from 'node:path';
import { assertNever } from './assert-never';
import { readJsonFile } from './json';
import { getPackageRoot } from './path';

const TEMPLATE_CONFIG_FILE = 'template.json';

export interface BaseTemplateSource {
  type: string;
}

export interface GitTemplateSource extends BaseTemplateSource {
  type: 'git';
  url: string;
  ref?: string;
  path?: string;
  depth?: number;
}

export interface LocalTemplateSource extends BaseTemplateSource {
  type: 'local';
  path: string;
}

export type TemplateSource = GitTemplateSource | LocalTemplateSource;

export interface TemplateDefinition {
  name: string;
  displayName: string;
  description?: string;
  tags?: string[];
  source: TemplateSource;
}

export interface TemplateCatalog {
  version?: number;
  templates: TemplateDefinition[];
}

let cachedCatalog: TemplateCatalog | null = null;

/**
 * 读取模板配置文件并缓存结果，避免重复 IO。
 */
export async function loadTemplateCatalog(): Promise<TemplateCatalog> {
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const configPath = path.join(getPackageRoot(), TEMPLATE_CONFIG_FILE);
  const catalog = await readJsonFile<TemplateCatalog>(configPath);

  validateCatalog(catalog, configPath);
  cachedCatalog = catalog;
  return catalog;
}

/**
 * 返回模板配置中的所有模板定义列表。
 */
export async function listTemplateDefinitions(): Promise<TemplateDefinition[]> {
  const catalog = await loadTemplateCatalog();
  return catalog.templates;
}

/**
 * 按名称查找模板定义，找不到时返回 undefined。
 */
export async function findTemplateDefinition(name: string): Promise<TemplateDefinition | undefined> {
  const templates = await listTemplateDefinitions();
  return templates.find((template) => template.name === name);
}

/**
 * 校验模板配置结构与字段有效性。
 */
function validateCatalog(catalog: TemplateCatalog, configPath: string): void {
  if (!(catalog && Array.isArray(catalog.templates))) {
    throw new Error(`Invalid template catalog in ${configPath}: missing "templates" array.`);
  }

  for (let index = 0; index < catalog.templates.length; ++index) {
    const template = catalog.templates[index];
    if (!template || typeof template !== 'object') {
      throw new Error(`Invalid template definition at index ${index} in ${configPath}.`);
    }
    if (!template.name || typeof template.name !== 'string') {
      throw new Error(`Template at index ${index} is missing a valid "name" field.`);
    }
    if (!template.displayName || typeof template.displayName !== 'string') {
      throw new Error(`Template "${template.name}" is missing a valid "displayName" field.`);
    }
    if (!template.source || typeof template.source !== 'object') {
      throw new Error(`Template "${template.name}" is missing a "source" configuration.`);
    }
    validateSource(template.name, template.source as TemplateSource);
  }
}

/**
 * 针对不同来源类型校验必要字段。
 */
function validateSource(templateName: string, source: TemplateSource): void {
  const sourceType = source.type;

  switch (sourceType) {
    case 'git':
      if (!('url' in source) || typeof source.url !== 'string') {
        throw new Error(`Template "${templateName}" must specify a git "url".`);
      }
      break;
    case 'local':
      if (!('path' in source) || typeof source.path !== 'string') {
        throw new Error(`Template "${templateName}" must specify a local "path".`);
      }
      break;
    default:
      assertNever(source, `Template "${templateName}" has unsupported source type "${String(sourceType)}".`);
  }
}
