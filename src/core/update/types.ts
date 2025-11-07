/** CLI 选项。 */
export interface UpdateOptions {
  all?: boolean;
  skipAll?: boolean;
}

/** 文件更新的基本信息。 */
export interface FileUpdate {
  path: string;
  description: string;
}

/** 文本差异统计。 */
export interface DiffStats {
  added: number;
  removed: number;
}

/** 文本或二进制差异统计。 */
export type DiffSummary = DiffStats | null;

/** 更新类型。 */
export type UpdateKind = 'modify' | 'add' | 'delete';

/** 待处理更新的通用部分。 */
export interface BasePendingUpdate {
  kind: UpdateKind;
  file: FileUpdate;
  stats: DiffSummary;
  isBinary: boolean;
}

/** 二进制文件更新条目。 */
export interface BinaryPendingUpdate extends BasePendingUpdate {
  isBinary: true;
}

/** 文本文件更新条目。 */
export interface TextPendingUpdate extends BasePendingUpdate {
  isBinary: false;
  sourceContent: string;
  targetContent: string;
}

/** 待处理更新的联合类型。 */
export type PendingUpdate = BinaryPendingUpdate | TextPendingUpdate;

/** 忽略规则匹配器。 */
export type IgnoreMatcher = (relativePath: string, isDirectory?: boolean) => boolean;

/** 模板更新处理器在匹配与执行时可用的上下文。 */
export interface TemplateUpdateContext {
  file: FileUpdate;
  templatesDir: string;
  currentDir: string;
  projectFiles: Set<string>;
  shouldIgnore: IgnoreMatcher;
  sourcePath: string;
  targetPath: string;
  jsonPreserveMap: Record<string, string[]>;
}

/** 模板更新处理器接口。 */
export interface TemplateUpdateHandler {
  matches(context: TemplateUpdateContext): Promise<boolean> | boolean;
  handle(context: TemplateUpdateContext): Promise<PendingUpdate[]>;
}

/** 交互提示配置。 */
export interface PromptConfig {
  buildMessage: (fileName: string, statsLabel: string) => string;
  choices: { title: string; value: UpdateAction }[];
}

/** 用户操作。 */
export type UpdateAction = 'update' | 'skip' | 'update-all' | 'skip-all';

export interface ApplyUpdateOptions {
  jsonPreserveMap: Record<string, string[]>;
}

/** 用户操作处理器的上下文。 */
export interface UpdateActionContext {
  pending: PendingUpdate;
  remaining: PendingUpdate[];
  templatesDir: string;
  currentDir: string;
  applyOptions: ApplyUpdateOptions;
}

/** 交互动作处理器。 */
export type UpdateActionHandler = (context: UpdateActionContext) => Promise<'continue' | 'break'>;
