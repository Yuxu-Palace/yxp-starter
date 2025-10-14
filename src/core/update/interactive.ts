/**
 * 交互式更新 UI 模块
 * 负责处理用户交互，包括提示、选择和更新应用
 */

import chalk from 'chalk';
import prompts from 'prompts';
import { showDiff } from '../../utils/diff.js';
import { formatStats, logger } from '../../utils/logger.js';
import { applyBatchUpdate, applyUpdate } from './applier.js';
import type { PendingUpdate, PromptConfig, UpdateActionHandler } from './types.js';

/**
 * prompts 交互返回的动作类型集合
 */
type UpdateAction = 'update' | 'skip' | 'update-all' | 'skip-all';

/**
 * 不同更新类型的提示配置
 */
const PROMPT_CONFIGS: Record<string, PromptConfig> = {
  add: {
    buildMessage: (fileName, statsLabel) => `Add new file ${fileName}? ${statsLabel}`,
    choices: [
      { title: 'Add (copy from template)', value: 'update' },
      { title: 'Skip (keep missing)', value: 'skip' },
      { title: 'Add all remaining files', value: 'update-all' },
      { title: 'Skip all remaining files', value: 'skip-all' },
    ],
  },
  delete: {
    buildMessage: (fileName, statsLabel) => `Delete ${fileName}? ${statsLabel}`,
    choices: [
      { title: 'Delete (remove file)', value: 'update' },
      { title: 'Keep (do not delete)', value: 'skip' },
      { title: 'Delete all remaining files', value: 'update-all' },
      { title: 'Keep all remaining files', value: 'skip-all' },
    ],
  },
  modify: {
    buildMessage: (fileName, statsLabel) => `Update ${fileName}? ${statsLabel}`,
    choices: [
      { title: 'Update (use new version)', value: 'update' },
      { title: 'Skip (keep current version)', value: 'skip' },
      { title: 'Update all remaining files', value: 'update-all' },
      { title: 'Skip all remaining files', value: 'skip-all' },
    ],
  },
};

/**
 * 用户动作处理器映射
 */
const ACTION_HANDLERS: Record<UpdateAction, UpdateActionHandler> = {
  update: async ({ pending, templatesDir, currentDir }) => {
    await applyUpdate(pending, templatesDir, currentDir);
    logger.plain();
    return 'continue';
  },
  skip: async ({ pending }) => {
    logger.warn(`✗ Skipped ${pending.file.path}`);
    logger.plain();
    return 'continue';
  },
  'update-all': async ({ pending, remaining, templatesDir, currentDir }) => {
    await applyUpdate(pending, templatesDir, currentDir);
    logger.plain();
    await applyBatchUpdate(remaining, templatesDir, currentDir);
    return 'break';
  },
  'skip-all': async ({ pending }) => {
    logger.warn(`✗ Skipped ${pending.file.path}`);
    logger.note('Skipping all remaining files...');
    logger.plain();
    return 'break';
  },
};

/**
 * 默认模式：逐条提示用户处理所有待更新文件
 *
 * @param updates - 更新列表
 * @param templatesDir - 模板目录路径
 * @param currentDir - 当前项目目录
 */
export async function runInteractiveUpdate(
  updates: PendingUpdate[],
  templatesDir: string,
  currentDir: string,
): Promise<void> {
  for (let index = 0; index < updates.length; index += 1) {
    const pending = updates[index];
    const action = await promptUpdateAction(pending);
    const remaining = updates.slice(index + 1);
    const handler = ACTION_HANDLERS[action];
    const outcome = await handler({ pending, remaining, templatesDir, currentDir });

    if (outcome === 'break') {
      break;
    }
  }
}

/**
 * 交互式提示用户对当前差异采取的操作
 *
 * @param pendingUpdate - 待处理的更新
 * @returns 用户选择的动作
 */
async function promptUpdateAction(pendingUpdate: PendingUpdate): Promise<UpdateAction> {
  if (pendingUpdate.isBinary) {
    logger.note(`
🧮 ${pendingUpdate.file.path} is a binary file; diff preview skipped.`);
  } else {
    showDiff(pendingUpdate.targetContent, pendingUpdate.sourceContent, pendingUpdate.file.path);
  }

  const statsLabel = formatStats(pendingUpdate.stats);
  const { message, choices } = buildPromptConfig(pendingUpdate, statsLabel);

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message,
    choices,
    initial: 0,
  });

  return action;
}

/**
 * 根据差异类型构造 prompts 的菜单配置
 *
 * @param pendingUpdate - 待处理的更新
 * @param statsLabel - 格式化后的统计标签
 * @returns 提示配置
 */
function buildPromptConfig(
  pendingUpdate: PendingUpdate,
  statsLabel: string,
): { message: string; choices: { title: string; value: UpdateAction }[] } {
  const fileName = chalk.cyan(pendingUpdate.file.path);
  const config = PROMPT_CONFIGS[pendingUpdate.kind];
  return {
    message: config.buildMessage(fileName, statsLabel),
    choices: config.choices,
  };
}
