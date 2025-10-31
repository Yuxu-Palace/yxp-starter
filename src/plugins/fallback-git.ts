import path from 'node:path';
import { fileExists } from '../utils/fs';
import { logger } from '../utils/logger';
import type { GitTemplateSource } from '../utils/template-config';
import { runGitCommand } from './git-runner';
import type { DownloadContext, DownloadResult, TemplateDownloadPlugin } from './types';

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

export function createGitFallbackPlugin(): TemplateDownloadPlugin {
  return {
    name: 'builtin-git',
    description: 'Use system git to clone repositories.',
    match: ({ template }) => template.source.type === 'git',
    download: downloadWithGit,
  };
}
