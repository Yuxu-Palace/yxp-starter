import { createGitFallbackPlugin } from './fallback-git';
import { createGitDownPlugin } from './git-down';
import { listDownloadPlugins, registerDownloadPlugins } from './registry';

let defaultsRegistered = false;

/**
 * 确保内置下载插件只注册一次，避免重复注册导致的状态不一致。
 */
export function ensureDefaultDownloadPluginsRegistered(): void {
  if (defaultsRegistered || listDownloadPlugins().length > 0) {
    defaultsRegistered = true;
    return;
  }

  // 注册 git-down 与系统 git 两类兜底插件，覆盖线上远程与本地环境。
  registerDownloadPlugins([createGitDownPlugin, createGitFallbackPlugin]);
  defaultsRegistered = true;
}
