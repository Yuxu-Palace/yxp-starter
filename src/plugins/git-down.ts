import path from 'node:path';
import gitDown from '@cmtlyt/git-down';
import { fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import type { TemplateDefinition } from '../utils/template-config';
import type { DownloadContext, DownloadResult, TemplateDownloadPlugin } from './types';

function resolveGitDownUrl(template: TemplateDefinition): string {
  if (template.source.type !== 'git') {
    throw new Error('git-down plugin can only handle git sources.');
  }

  const { url, ref, path: subPath } = template.source;
  const cleaned = url.replace(/\.git$/, '');
  const branch = ref ?? 'main';

  if (subPath && subPath.length > 0) {
    return `${cleaned}/tree/${branch}/${subPath}`;
  }
  return `${cleaned}/tree/${branch}`;
}

async function downloadWithGitDown(context: DownloadContext): Promise<DownloadResult> {
  const { template, tempDir } = context;
  if (template.source.type !== 'git') {
    throw new Error('git-down plugin can only handle git sources.');
  }

  const branch = template.source.ref ?? 'main';
  const url = resolveGitDownUrl(template);

  logger.note(`Downloading template ${template.name} via git-down...`);
  await gitDown(url, { output: tempDir, branch });

  const finalPath = template.source.path ? path.join(tempDir, path.basename(template.source.path)) : tempDir;

  if (!(await fileExists(finalPath))) {
    throw new Error(`git-down did not create expected path: ${finalPath}`);
  }

  return { path: finalPath, commit: branch };
}

export function createGitDownPlugin(): TemplateDownloadPlugin {
  return {
    name: '@cmtlyt/git-down',
    description: 'Use git-down to download GitHub repositories.',
    match: ({ template }) => template.source.type === 'git',
    download: downloadWithGitDown,
  };
}
