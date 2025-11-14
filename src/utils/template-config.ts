import path from 'node:path';
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

export type TemplateSource = GitTemplateSource;

export interface TemplateDefinition {
  name: string;
  displayName: string;
  description?: string;
  tags?: string[];
  source: TemplateSource;
  packageFieldsToPreserve?: string[];
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
function normalizePreserveFieldList(templateName: string, value: unknown): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`Template "${templateName}" must declare "packageFieldsToPreserve" as an array of strings.`);
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < value.length; ++index) {
    const entry = value[index];
    if (typeof entry !== 'string') {
      throw new Error(`Template "${templateName}" has a non-string entry at packageFieldsToPreserve[${index}].`);
    }

    const trimmed = entry.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }

    normalized.push(trimmed);
    seen.add(trimmed);
  }

  return normalized;
}

function validateCatalog(catalog: TemplateCatalog, configPath: string): void {
  const templates = ensureTemplateArray(catalog, configPath);
  templates.forEach((template, index) => {
    validateTemplateEntry(template, index, configPath);
  });
}

function ensureTemplateArray(catalog: TemplateCatalog, configPath: string): TemplateDefinition[] {
  if (!(catalog && Array.isArray(catalog.templates))) {
    throw new Error(`Invalid template catalog in ${configPath}: missing "templates" array.`);
  }

  return catalog.templates;
}

function validateTemplateEntry(template: TemplateDefinition | undefined, index: number, configPath: string): void {
  assertTemplateObject(template, index, configPath);

  const name = ensureStringField(template.name, `Template at index ${index} is missing a valid "name" field.`);
  ensureStringField(template.displayName, `Template "${name}" is missing a valid "displayName" field.`);
  const source = ensureSourceDefinition(template.source, name);

  validateSource(name, source);
  applyPreserveFieldNormalization(template, name);
}

function assertTemplateObject(
  template: TemplateDefinition | undefined,
  index: number,
  configPath: string,
): asserts template is TemplateDefinition {
  if (!(template && typeof template === 'object')) {
    throw new Error(`Invalid template definition at index ${index} in ${configPath}.`);
  }
}

function ensureStringField(value: unknown, errorMessage: string): string {
  if (!value || typeof value !== 'string') {
    throw new Error(errorMessage);
  }

  return value;
}

function ensureSourceDefinition(source: TemplateSource | undefined, templateName: string): TemplateSource {
  if (!source || typeof source !== 'object') {
    throw new Error(`Template "${templateName}" is missing a "source" configuration.`);
  }

  return source;
}

function applyPreserveFieldNormalization(template: TemplateDefinition, templateName: string): void {
  const preserveFields = normalizePreserveFieldList(templateName, template.packageFieldsToPreserve);
  template.packageFieldsToPreserve = preserveFields.length > 0 ? preserveFields : undefined;
}

/**
 * 针对不同来源类型校验必要字段。
 */
function validateSource(templateName: string, source: TemplateSource): void {
  if (!('url' in source) || typeof source.url !== 'string') {
    throw new Error(`Template "${templateName}" must specify a git "url".`);
  }
}
