import path from 'node:path';
import { fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import type { GitTemplateSource } from '../utils/template-config';
import { runGitCommand } from './git-runner';
import type { DownloadContext, DownloadResult, TemplateDownloadPlugin } from './types';

/**
 * 使用系统 git 克隆仓库，作为 git-down 失败时的兜底方案。
 */
async function downloadWithGit(context: DownloadContext): Promise<DownloadResult> {
  const { template, tempDir } = context;
  const source = template.source as GitTemplateSource;

  const args = ['clone', '--depth', '1'];
  if (source.ref) {
    args.push('--branch', source.ref);
  }
  args.push(source.url);
  args.push(tempDir);

  logger.note(`Cloning ${source.url}${source.ref ? `#${source.ref}` : ''} via git...`);
  await runGitCommand(args);

  const branch = source.ref ?? 'main';
  const resolvedPath = source.path ? path.join(tempDir, source.path) : tempDir;

  if (!(await fileExists(resolvedPath))) {
    throw new Error(`Template path ${resolvedPath} does not exist in repository ${source.url}.`);
  }

  return { path: resolvedPath, commit: branch };
}

/**
 * 创建基于系统 git 的插件定义，确保在缺少 git-down 支持时仍可下载模板。
 */
export function createGitFallbackPlugin(): TemplateDownloadPlugin {
  return {
    name: 'builtin-git',
    description: 'Use system git to clone repositories.',
    match: ({ template }) => template.source.type === 'git',
    download: downloadWithGit,
  };
}
