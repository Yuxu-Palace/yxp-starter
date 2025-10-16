/**
 * 提供交互式更新流程以及用户提示逻辑。
 */

import process from 'node:process';
import chalk from 'chalk';
import prompts from 'prompts';
import { showDiff } from '../../utils/diff.ts';
import { formatStats, logger } from '../../utils/logger.ts';
import { createProgressTracker } from '../../utils/progress.ts';
import { applyBatchUpdate, applyUpdate } from './applier.ts';
import type { PendingUpdate, PromptConfig, UpdateAction, UpdateActionHandler } from './types.ts';

/**
 * 依据更新类型生成提示内容。
 */
const PROMPT_CONFIGS: Record<string, PromptConfig> = {
  add: {
    buildMessage: (fileName, statsLabel) => `Add new file ${fileName}? ${statsLabel}`,
    choices: [
      { title: 'Add (copy from template)', value: 'update' },
      { title: 'Skip (do not add)', value: 'skip' },
      { title: 'Add all remaining files', value: 'update-all' },
      { title: 'Skip all remaining files', value: 'skip-all' },
    ],
  },
  delete: {
    buildMessage: (fileName, statsLabel) => `Delete ${fileName}? ${statsLabel}`,
    choices: [
      { title: 'Delete (remove file)', value: 'update' },
      { title: 'Skip (do not delete)', value: 'skip' },
      { title: 'Delete all remaining files', value: 'update-all' },
      { title: 'Skip all remaining files', value: 'skip-all' },
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
 * 用户动作对应的处理方法。
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
 * 逐个提示用户处理待更新文件。
 */
export async function runInteractiveUpdate(
  updates: PendingUpdate[],
  templatesDir: string,
  currentDir: string,
): Promise<void> {
  const progress = createProgressTracker(updates.length);

  for (let index = 0; index < updates.length; index += 1) {
    const pending = updates[index];

    if (index === 0) {
      await progress.start(pending.file.path);
    } else {
      await progress.next(pending.file.path);
    }

    const action = await promptUpdateAction(pending, progress);
    const remaining = updates.slice(index + 1);
    const handler = ACTION_HANDLERS[action];
    const outcome = await handler({ pending, remaining, templatesDir, currentDir });

    if (outcome === 'break') {
      break;
    }
  }
  progress.finish();
}

/**
 * 提示用户为当前差异选择操作。
 */
async function promptUpdateAction(
  pendingUpdate: PendingUpdate,
  _progress?: ReturnType<typeof createProgressTracker>,
): Promise<UpdateAction> {
  // cli-progress-footer 会自动把新输出显示在进度条上方。

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

  if (!action) {
    logger.error('❌ No action selected. Exiting.');
    process.exit(0);
  }

  return action;
}

/**
 * 根据差异类型构造 prompts 的菜单配置。
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
