/**
 * update 命令的常量配置
 * 集中管理所有魔法数字和配置值
 */

import type { UpdateKind } from './types.js';

/** package.json 格式化配置 */
export const JSON_INDENT_SPACES = 2;
export const JSON_TRAILING_NEWLINE = '\n';

/** 模板扫描时需要跳过的目录 */
export const IGNORED_TEMPLATE_ENTRIES = new Set(['node_modules', '.pnpm', '.git', 'dist']);

/** 项目扫描时需要跳过的目录 */
export const IGNORED_PROJECT_ENTRIES = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage']);

/** 包含动态内容的文件，更新时默认跳过 */
export const SKIPPED_DYNAMIC_FILES = new Set(['README.md', 'readme.md', '.yxpignore']);

/**
 * 更新类型的优先级顺序
 *
 * 设计考虑：
 * - modify 优先：先更新现有文件，避免中途失败时产生不一致状态
 * - add 其次：在修改后添加新文件
 * - delete 最后：最后删除文件最安全，出错时用户还有机会恢复
 */
export const UPDATE_KIND_PRIORITY: Record<UpdateKind, number> = {
  modify: 0,
  add: 1,
  delete: 2,
};
