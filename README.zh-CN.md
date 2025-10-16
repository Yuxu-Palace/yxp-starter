# yxp-starter

中文 | [English](README.md)

## 简介
yxp-starter 是 yuxu-palace 官方提供的脚手架与更新 CLI，内置多种模板和差异感知的同步流程，帮助团队快速搭建项目并随时对齐最新的模板演进。

## 目录
- [简介](#简介)
- [功能亮点](#功能亮点)
- [架构说明](#架构说明)
- [安装](#安装)
- [使用](#使用)
- [示例](#示例)
- [贡献指南](#贡献指南)
- [支持](#支持)
- [常见问题](#常见问题)
- [更新日志](#更新日志)
- [许可证](#许可证)

## 功能亮点
- `template.json` 维护可用模板清单，每个模板指向远程 Git 仓库（可选子目录）；CLI 会按需拉取并缓存到本地 `~/.yxp-starter/templates`。
- 交互式 `init` 命令仅复制核心文件，自动跳过 `node_modules`、`.pnpm`、`dist`、`.git` 等目录。
- 智能占位符与元数据处理会更新 README 中的 `{{projectName}}`，保留 `package.json` 的 `name` 字段，并把所用模板及 git commit 记录到 JSON 版 `.yxp-template`。
- `update` 命令根据模板与项目差异生成彩色 diff（含二进制检测）、支持 `--all` 全量更新与 `--skip-all` 干跑模式。
- 通过 `.yxpignore` 提供 Gitignore 风格的排除规则，同时内置忽略列表保证本地文件不会被覆盖。
- 工具函数统一了 JSON 写入、远程模板下载与缓存、文件读写、日志输出、进度展示等行为，确保命令执行一致。

## 架构说明
- `template.json` 定义模板列表、仓库地址、分支/commit 以及可选子目录。
- `src/index.ts` 使用 Commander 注册 CLI 入口，并暴露 `init`、`update` 两个命令。
- `src/commands/init.ts` 负责项目初始化：远程拉取/缓存模板、交互式选择、复制文件、占位符替换以及 `.yxp-template` 记录。
- `src/commands/update.ts` 主导同步流程：获取模板最新内容、扫描差异、解析忽略规则，并支持交互式或批量更新模式。
- `src/core/update/` 提供差异引擎：`scanner.ts` 枚举文件、`differ.ts` 生成待处理项目、`handlers.ts` 判定增删改策略、`applier.ts` 写入文件并结合 `progress.ts` 展示进度。
- `src/utils/` 封装常用能力，包括二进制安全文件读取（`fs.ts`）、差异展示与摘要、JSON 格式化、模板配置读取（`template-config.ts`）、远程下载缓存（`template-fetch.ts`）、模板记录（`templates.ts`）、忽略解析以及彩色日志。
- `src/types/` 提供第三方依赖的类型声明（如 `cli-progress-footer`），提升 TypeScript 开发体验。

## 安装
1. 环境要求：
   - Node.js ≥ 18
   - Git（用于拉取模板）
   - 建议使用 pnpm
2. 克隆仓库并安装依赖：

   ```bash
   git clone https://github.com/your-org/yxp-starter.git
   cd yxp-starter
   pnpm install
   ```

若仅需运行 CLI，可通过 `pnpm dlx yxp-start <command>` 直接调用，无需手动克隆。

## 使用
### `init`

从模板初始化新项目：

```bash
pnpm dlx yxp-start init my-project
# 非交互式指定模板
pnpm dlx yxp-start init my-project --template yxp-lib-start
```

该命令会创建目标目录、复制模板文件、替换 `{{projectName}}` 占位符，并保留 `package.json` 中已有的包名。
可用模板由 `template.json` 定义，每个模板会在执行时通过 Git 克隆到本地缓存 `~/.yxp-starter/templates`，后续运行会复用缓存。

### `update`

与模板同步现有项目：

```bash
# 交互式查看差异
pnpm dlx yxp-start update

# 无提示批量应用所有变更
pnpm dlx yxp-start update --all

# 仅查看即将应用的更新
pnpm dlx yxp-start update --skip-all
```

每次执行都会从 Git 源刷新模板（若缓存命中则直接复用），再进行差异比对。更新流程会遵循 `.yxpignore`、自动跳过 `README.md` 等动态文件，并在批量操作时展示实时进度。

## 示例
- **构建库脚手架**：使用 `pnpm dlx yxp-start init my-lib --template yxp-lib-start` 快速生成包含 Rslib、Vitest、Biome 的库项目。
- **提前审阅模板变动**：在项目根执行 `pnpm dlx yxp-start update --skip-all`，即可获得完整的同步计划清单而不改动任何文件。

## 贡献指南
- 使用 `pnpm dev` 进入 rslib 监听构建，`pnpm build` 生成可发布的 CLI。
- 提交前请运行 `pnpm check` 与 `pnpm format`，确保风格与质量一致。
- 若需进行重大改动，请先通过 Issue 与维护者沟通方案。

## 支持
如遇到问题或希望新增功能，请在仓库中提交 Issue。若需私下沟通，可通过团队既有渠道联系维护者。

## 常见问题
**问：必须使用 pnpm 才能运行 CLI 吗？**
答：推荐使用 pnpm，但只要环境满足 Node.js ≥ 18，也可以通过 `npm create` 或 `npx` 来调用。

**问：更新时会覆盖我手动编写的 README 吗？**
答：不会。`README.md`、`.yxpignore` 等动态文件默认跳过，需要时可手动比对模板差异。

## 更新日志
- 可通过 `git log` 查看关键改动，后续也会在发布时同步模板更新说明。
- 模板源码位于 `template.json` 指向的 Git 仓库，更新模板只需在对应仓库提交并更新引用。

## 许可证
MIT
