/**
 * 更新流程使用到的常量。
 */

import type { UpdateKind } from './types.js';

/** `JSON.stringify` 使用的缩进宽度。 */
export const JSON_INDENT_SPACES = 2;
export const JSON_TRAILING_NEWLINE = '\n';

/** 忽略文件名称 */
export const IGNORED_FILE_NAME = '.yxpignore';

/** 模板目录中无需同步的路径。 */
export const IGNORED_TEMPLATE_ENTRIES = new Set(['node_modules', '.pnpm', '.git', 'dist']);

/** 项目中无需扫描的目录。 */
export const IGNORED_PROJECT_ENTRIES = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage']);

/** 在比较时跳过的动态文件。 */
export const SKIPPED_DYNAMIC_FILES = new Set(['README.md', 'readme.md', IGNORED_FILE_NAME]);

/**
 * 更新类型优先级，避免在删除文件前中断流程。
 */
export const UPDATE_KIND_PRIORITY: Record<UpdateKind, number> = {
  modify: 0,
  add: 1,
  delete: 2,
};
