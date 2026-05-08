import type { UpdateKind } from './types';

/** `JSON.stringify` 使用的缩进宽度。 */
export const JSON_INDENT_SPACES = 2;
export const JSON_TRAILING_NEWLINE = '\n';

/** 忽略文件名称 */
export const IGNORED_FILE_NAME = '.yxpignore';

/** 复制模板时跳过这些目录 */
export const TEMPLATE_IGNORE_ENTRIES = new Set(['node_modules', '.pnpm', 'dist']);

/** 默认的更新忽略规则（可被配置覆盖）。 */
const DEFAULT_IGNORED_DIRECTORIES = ['node_modules', '.pnpm', '.git', 'dist', 'build', 'coverage'];
export const DEFAULT_UPDATE_IGNORE_PATTERNS = DEFAULT_IGNORED_DIRECTORIES.flatMap((entry) => [
  entry,
  `${entry}/`,
  `${entry}/**`,
]);

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
