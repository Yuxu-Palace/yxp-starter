import type { TemplateDefinition, TemplateSource } from '../utils/template-config';

export interface DownloadContext {
  template: TemplateDefinition;
  source: TemplateSource;
  tempDir: string;
}

export interface DownloadResult {
  path: string;
  commit: string;
}

export interface TemplateDownloadPlugin {
  /** 插件名称，用于展示与调试 */
  name: string;
  /** 插件描述，在交互式选择时展示 */
  description?: string;
  /** 匹配条件，返回 true 表示可以处理当前模板 */
  match?(context: DownloadContext): boolean | Promise<boolean>;
  /** 执行下载逻辑，返回结果路径与提交信息 */
  download(context: DownloadContext): Promise<DownloadResult>;
}

export type TemplateDownloadPluginFactory = () => TemplateDownloadPlugin;
