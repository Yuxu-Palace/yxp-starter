import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { copyDirectory, fileExists } from './fs.ts';
import { logger } from './logger.ts';
import { getPackageRoot, getTemplateCacheRoot } from './path.ts';
import type { GitTemplateSource, LocalTemplateSource, TemplateDefinition } from './template-config.ts';

const execFileAsync = promisify(execFile);

interface FetchResult {
  path: string;
  commit: string;
}

export async function ensureTemplateReady(template: TemplateDefinition): Promise<FetchResult> {
  switch (template.source.type) {
    case 'git':
      return fetchGitTemplate(template, template.source);
    case 'local':
      return resolveLocalTemplate(template.source);
    default:
      throw new Error(`Unsupported template source type: ${String(template.source.type)}`);
  }
}

async function fetchGitTemplate(template: TemplateDefinition, source: GitTemplateSource): Promise<FetchResult> {
  const cacheRoot = await ensureCacheRoot();
  const templateCacheDir = path.join(cacheRoot, template.name);
  await fs.mkdir(templateCacheDir, { recursive: true });

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'yxp-template-'));
  const cloneDir = path.join(tempRoot, 'repo');

  const args = ['clone', '--depth', String(source.depth ?? 1), '--single-branch'];
  if (source.ref) {
    args.push('--branch', source.ref);
  }
  args.push(source.url, cloneDir);

  logger.note(`Cloning template "${template.name}" from ${source.url}${source.ref ? `#${source.ref}` : ''}...`);
  await runGit(args);

  const commit = (await runGit(['rev-parse', 'HEAD'], cloneDir)).trim();
  const cachePath = path.join(templateCacheDir, commit);

  if (!(await fileExists(cachePath))) {
    const sourcePath = source.path ? path.join(cloneDir, source.path) : cloneDir;
    const exists = await fileExists(sourcePath);
    if (!exists) {
      await cleanupTemp(tempRoot);
      throw new Error(`Template path ${sourcePath} does not exist in repository ${source.url}.`);
    }

    await fs.mkdir(cachePath, { recursive: true });
    await copyDirectory(sourcePath, cachePath);
  }

  await cleanupTemp(tempRoot);

  return { path: cachePath, commit };
}

async function resolveLocalTemplate(source: LocalTemplateSource): Promise<FetchResult> {
  const baseDir = getPackageRoot();
  const resolved = path.isAbsolute(source.path) ? source.path : path.join(baseDir, source.path);
  const exists = await fileExists(resolved);
  if (!exists) {
    throw new Error(`Local template path ${resolved} does not exist.`);
  }

  return { path: resolved, commit: 'local' };
}

async function ensureCacheRoot(): Promise<string> {
  const cacheRoot = getTemplateCacheRoot();
  await fs.mkdir(cacheRoot, { recursive: true });
  return cacheRoot;
}

async function runGit(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute git ${args.join(' ')}: ${message}`);
  }
}

async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}
