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

  // 注册 git-down 作为默认下载插件。
  registerDownloadPlugins([createGitDownPlugin]);
  defaultsRegistered = true;
}
