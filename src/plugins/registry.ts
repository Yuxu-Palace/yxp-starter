import type { DownloadContext, DownloadResult, TemplateDownloadPlugin, TemplateDownloadPluginFactory } from './types';

let pluginList: TemplateDownloadPlugin[] = [];
const pluginMap = new Map<string, TemplateDownloadPlugin>();

/**
 * 注册下载插件工厂列表，仅在首次调用时生效。
 */
export function registerDownloadPlugins(factories: TemplateDownloadPluginFactory[]): void {
  if (pluginList.length > 0) {
    return;
  }

  pluginList = factories.map((factory) => {
    const plugin = factory();
    pluginMap.set(plugin.name, plugin);
    return plugin;
  });
}

/**
 * 获取当前已注册的插件列表。
 */
export function listDownloadPlugins(): TemplateDownloadPlugin[] {
  return pluginList;
}

/**
 * 根据插件名称查找注册的插件实例。
 */
export function getDownloadPlugin(name: string): TemplateDownloadPlugin | undefined {
  return pluginMap.get(name);
}

/**
 * 获取默认插件（即注册顺序中的第一个）。
 */
export function getDefaultDownloadPlugin(): TemplateDownloadPlugin | undefined {
  return pluginList[0];
}

/**
 * 使用指定插件下载模板，同时执行匹配检查。
 */
export async function downloadWithPlugin(name: string, context: DownloadContext): Promise<DownloadResult> {
  const plugin = getDownloadPlugin(name);
  if (!plugin) {
    throw new Error(`Download plugin "${name}" is not registered.`);
  }

  if (plugin.match && !(await plugin.match(context))) {
    throw new Error(`Download plugin "${name}" cannot handle template ${context.template.name}.`);
  }

  return plugin.download(context);
}
