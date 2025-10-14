/**
 * 提供交互式更新流程以及用户提示逻辑。
 */

import chalk from 'chalk';
import prompts from 'prompts';
import { showDiff } from '../../utils/diff.js';
import { formatStats, logger } from '../../utils/logger.js';
import { createProgressTracker } from '../../utils/progress.js';
import { applyBatchUpdate, applyUpdate } from './applier.js';
import type { PendingUpdate, PromptConfig, UpdateActionHandler } from './types.js';

/**
 * prompts 返回的用户动作类型。
 */
type UpdateAction = 'update' | 'skip' | 'update-all' | 'skip-all';

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
 * Interactively prompts the user to handle a list of pending file updates.
 *
 * Processes each pending update in order, displaying progress and executing the user's chosen action.
 * If the user selects a terminal action (e.g., apply-all or skip-all), remaining updates may be applied in batch or skipped and the interactive loop will stop early.
 *
 * @param updates - Pending updates to present to the user
 * @param templatesDir - Filesystem path to the templates directory used when applying updates
 * @param currentDir - Filesystem path to the current working directory where updates will be applied
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
 * Prompt the user to choose an action for a pending file update.
 *
 * Shows a diff preview for text files (skips preview for binary files), presents a menu
 * tailored to the update kind and formatted stats, and returns the user's selection.
 *
 * @param pendingUpdate - The pending update to present to the user
 * @returns `'update' | 'skip' | 'update-all' | 'skip-all'` indicating the chosen action
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

  return action;
}

/**
 * Build the prompt message and choice list for a pending update based on its diff kind and stats.
 *
 * @param pendingUpdate - The pending update to prompt for (includes file path and kind).
 * @param statsLabel - Human-readable stats label to include in the prompt message.
 * @returns An object containing `message` (the prompt text) and `choices` (an array of options with `title` and `value`).
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
