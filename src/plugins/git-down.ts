import path from 'node:path';
import gitDown from '@cmtlyt/git-down';
import { fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import type { DownloadContext, DownloadResult, TemplateDownloadPlugin } from './types';

/**
 * 使用 git-down 将远程仓库的模板下载到给定临时目录。
 */
async function downloadWithGitDown(context: DownloadContext): Promise<DownloadResult> {
  const { template, tempDir } = context;
  if (template.source.type !== 'git') {
    throw new Error('git-down plugin can only handle git sources.');
  }

  const { url, ref, path: subPath } = template.source;
  const branch = ref ?? 'main';

  // git-down 需要 tree 入口；若用户仅提供仓库地址，则补全到默认分支。
  const sanitizedUrl = url.replace(/\/+$/, '');
  const templateUrl = sanitizedUrl.includes('/tree/') ? sanitizedUrl : `${sanitizedUrl}/tree/${branch}`;

  logger.note(`Downloading template ${template.name} via git-down...`);
  await gitDown(templateUrl, { output: tempDir, branch });

  const finalPath = subPath ? path.join(tempDir, path.basename(subPath)) : tempDir;

  if (!(await fileExists(finalPath))) {
    throw new Error(`git-down did not create expected path: ${finalPath}`);
  }

  return { path: finalPath, commit: branch };
}

/**
 * 创建 git-down 插件定义，用于在插件体系中注册。
 */
export function createGitDownPlugin(): TemplateDownloadPlugin {
  return {
    name: '@cmtlyt/git-down',
    description: 'Use git-down to download GitHub repositories.',
    match: ({ template }) => template.source.type === 'git',
    download: downloadWithGitDown,
  };
}
