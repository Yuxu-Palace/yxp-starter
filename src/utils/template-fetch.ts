import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { createGitFallbackPlugin } from '../plugins/fallback-git';
import { createGitDownPlugin } from '../plugins/git-down';
import {
  getDefaultDownloadPlugin,
  getDownloadPlugin,
  listDownloadPlugins,
  registerDownloadPlugins,
} from '../plugins/registry';
import type { DownloadContext, TemplateDownloadPlugin } from '../plugins/types';
import { copyDirectory, fileExists } from './fs';
import { logger } from './logger';
import { getPackageRoot, getTemplateCacheRoot } from './path';
import type { GitTemplateSource, LocalTemplateSource, TemplateDefinition } from './template-config';

interface FetchResult {
  path: string;
  commit: string;
  downloader: string;
}

registerDownloadPlugins([createGitDownPlugin, createGitFallbackPlugin]);

export async function selectDownloader(preferred?: string): Promise<string | undefined> {
  if (preferred) {
    const existing = getDownloadPlugin(preferred);
    if (existing) {
      return preferred;
    }
    logger.warn(`Downloader "${preferred}" is not registered. Please choose another.`);
  }

  const plugins = listDownloadPlugins();
  if (plugins.length === 0) {
    throw new Error('No download plugins available.');
  }

  if (plugins.length === 1) {
    return plugins[0].name;
  }

  const { downloader } = await prompts({
    type: 'select',
    name: 'downloader',
    message: 'Select a downloader for templates',
    choices: plugins.map((plugin) => {
      return {
        title: plugin.name,
        value: plugin.name,
        description: plugin.description,
      };
    }),
  });

  if (!downloader) {
    throw new Error('Downloader selection cancelled.');
  }

  return downloader;
}

export async function ensureTemplateReady(template: TemplateDefinition, downloaderName?: string): Promise<FetchResult> {
  switch (template.source.type) {
    case 'git':
      return fetchGitTemplate(template, template.source, downloaderName);
    case 'local':
      return resolveLocalTemplate(template.source);
    default:
      throw new Error(`Unsupported template source type: ${String(template.source.type)}`);
  }
}

async function fetchGitTemplate(
  template: TemplateDefinition,
  source: GitTemplateSource,
  downloaderName?: string,
): Promise<FetchResult> {
  const cacheRoot = await ensureCacheRoot();
  const templateCacheDir = path.join(cacheRoot, template.name);
  await fs.mkdir(templateCacheDir, { recursive: true });

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yxp-template-'));
  const plugin = await resolveDownloadPlugin(downloaderName);

  const context: DownloadContext = {
    template,
    source,
    tempDir: tempRoot,
  };

  logger.note(`Using downloader ${plugin.name}...`);
  const result = await plugin.download(context);

  const cachePath = path.join(templateCacheDir, result.commit);

  if (!(await fileExists(cachePath))) {
    await fs.mkdir(cachePath, { recursive: true });
    await copyDirectory(result.path, cachePath);
  }

  await cleanupTemp(tempRoot);

  return { path: cachePath, commit: result.commit, downloader: plugin.name };
}

async function resolveLocalTemplate(source: LocalTemplateSource): Promise<FetchResult> {
  const baseDir = getPackageRoot();
  const resolved = path.isAbsolute(source.path) ? source.path : path.join(baseDir, source.path);
  const exists = await fileExists(resolved);
  if (!exists) {
    throw new Error(`Local template path ${resolved} does not exist.`);
  }

  return { path: resolved, commit: 'local', downloader: 'local' };
}

async function ensureCacheRoot(): Promise<string> {
  const cacheRoot = getTemplateCacheRoot();
  await fs.mkdir(cacheRoot, { recursive: true });
  return cacheRoot;
}

async function resolveDownloadPlugin(downloaderName?: string): Promise<TemplateDownloadPlugin> {
  const plugins = listDownloadPlugins();
  if (plugins.length === 0) {
    throw new Error('No download plugins available.');
  }

  if (downloaderName) {
    const plugin = getDownloadPlugin(downloaderName);
    if (!plugin) {
      throw new Error(`Download plugin "${downloaderName}" is not registered.`);
    }
    return plugin;
  }

  if (plugins.length === 1) {
    return plugins[0];
  }

  const selection = await selectDownloader();
  if (!selection) {
    const plugin = getDefaultDownloadPlugin();
    if (!plugin) {
      throw new Error('No download plugins available.');
    }
    return plugin;
  }
  const plugin = getDownloadPlugin(selection);
  if (!plugin) {
    throw new Error(`Download plugin "${selection}" is not registered.`);
  }
  return plugin;
}

async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
