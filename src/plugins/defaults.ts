import { cacheFn } from '@yuxu-palace/kun-mythos';
import { createGitDownPlugin } from './git-down';
import { registerDownloadPlugins } from './registry';

const registerDefaultsOnce = cacheFn(() => {
  registerDownloadPlugins([createGitDownPlugin]);
});

/**
 * 确保内置下载插件只注册一次，避免重复注册导致的状态不一致。
 */
export function ensureDefaultDownloadPluginsRegistered(): void {
  // 注册 git-down 作为默认下载插件（仅执行一次）。
  registerDefaultsOnce();
}
