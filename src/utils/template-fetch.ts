import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import prompts from 'prompts';
import { ensureDefaultDownloadPluginsRegistered } from '../plugins/defaults';
import { getDownloadPlugin, getFirstDownloadPlugin, listDownloadPlugins } from '../plugins/registry';
import type { DownloadContext, TemplateDownloadPlugin } from '../plugins/types';
import { copyDirectory, fileExists } from './fs';
import { logger } from './logger';
import { getTemplateCacheRoot } from './path';
import type { GitTemplateSource, TemplateDefinition } from './template-config';

interface FetchResult {
  path: string;
  downloader: string;
}

ensureDefaultDownloadPluginsRegistered();

/**
 * 选择合适的模板下载器，当用户未显式指定或指定无效时提供交互式选择。
 */
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

/**
 * 确保模板在本地已准备就绪，目前仅支持 git 模板的缓存逻辑。
 */
export async function ensureTemplateReady(template: TemplateDefinition, downloaderName?: string): Promise<FetchResult> {
  return fetchGitTemplate(template, template.source, downloaderName);
}

/**
 * 下载远程 git 模板并写入缓存，返回可复用的缓存路径。
 */
async function fetchGitTemplate(
  template: TemplateDefinition,
  source: GitTemplateSource,
  downloaderName?: string,
): Promise<FetchResult> {
  /**
   * 缓存根目录：按模板名划分子目录，便于按提交缓存。
   */
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

  return { path: cachePath, downloader: plugin.name };
}

/**
 * 确保缓存根目录存在，返回绝对路径。
 */
async function ensureCacheRoot(): Promise<string> {
  const cacheRoot = getTemplateCacheRoot();
  await fs.mkdir(cacheRoot, { recursive: true });
  return cacheRoot;
}

/**
 * 根据用户偏好或默认策略选择下载插件，必要时触发交互式选择。
 */
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
    const plugin = getFirstDownloadPlugin();
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

/**
 * 下载完成后清理临时目录，忽略潜在删除错误。
 */
async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
