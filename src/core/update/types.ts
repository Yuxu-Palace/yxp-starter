/**
 * update 命令的类型定义
 * 集中管理所有与更新相关的接口和类型，便于维护和扩展
 */

/** CLI 选项：控制更新行为 */
export interface UpdateOptions {
  all?: boolean;
  skipAll?: boolean;
}

/** 文件更新信息：描述需要处理的文件 */
export interface FileUpdate {
  path: string;
  description: string;
}

/** 文本差异统计 */
export interface DiffStats {
  added: number;
  removed: number;
}

/** 差异统计（文本或二进制） */
export type DiffSummary = DiffStats | null;

/** 更新类型：添加、修改或删除 */
export type UpdateKind = 'modify' | 'add' | 'delete';

/** 待处理更新的基础信息 */
export interface BasePendingUpdate {
  kind: UpdateKind;
  file: FileUpdate;
  stats: DiffSummary;
  isBinary: boolean;
}

/** 二进制文件更新 */
export interface BinaryPendingUpdate extends BasePendingUpdate {
  isBinary: true;
}

/** 文本文件更新 */
export interface TextPendingUpdate extends BasePendingUpdate {
  isBinary: false;
  sourceContent: string;
  targetContent: string;
}

/** 待处理更新（联合类型） */
export type PendingUpdate = BinaryPendingUpdate | TextPendingUpdate;

/** 忽略规则匹配器 */
export type IgnoreMatcher = (relativePath: string, isDirectory?: boolean) => boolean;

/** 模板更新上下文：处理单个模板文件时的环境 */
export interface TemplateUpdateContext {
  file: FileUpdate;
  templatesDir: string;
  currentDir: string;
  projectFiles: Set<string>;
  shouldIgnore: IgnoreMatcher;
  sourcePath: string;
  targetPath: string;
}

/** 模板更新处理器：责任链模式 */
export interface TemplateUpdateHandler {
  matches(context: TemplateUpdateContext): Promise<boolean> | boolean;
  handle(context: TemplateUpdateContext): Promise<PendingUpdate[]>;
}

/** Prompt 配置：用于交互式更新 */
export interface PromptConfig {
  buildMessage: (fileName: string, statsLabel: string) => string;
  choices: { title: string; value: UpdateAction }[];
}

/** 用户操作类型 */
export type UpdateAction = 'update' | 'skip' | 'update-all' | 'skip-all';

/** 更新操作上下文 */
export interface UpdateActionContext {
  pending: PendingUpdate;
  remaining: PendingUpdate[];
  templatesDir: string;
  currentDir: string;
}

/** 操作处理器 */
export type UpdateActionHandler = (context: UpdateActionContext) => Promise<'continue' | 'break'>;
