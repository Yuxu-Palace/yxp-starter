import type { DownloadContext, DownloadResult, TemplateDownloadPlugin, TemplateDownloadPluginFactory } from './types';

let pluginList: TemplateDownloadPlugin[] = [];
const pluginMap = new Map<string, TemplateDownloadPlugin>();

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

export function listDownloadPlugins(): TemplateDownloadPlugin[] {
  return pluginList;
}

export function getDownloadPlugin(name: string): TemplateDownloadPlugin | undefined {
  return pluginMap.get(name);
}

export function getDefaultDownloadPlugin(): TemplateDownloadPlugin | undefined {
  return pluginList[0];
}

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
