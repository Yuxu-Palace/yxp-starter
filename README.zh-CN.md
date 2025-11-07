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
- 交互式 `init` 命令允许在 `templates/yxp-lib-start`、`templates/yxp-app-start` 等模板间切换，只复制必要文件并自动跳过 `node_modules`、`.pnpm`、`dist` 等目录。
- 智能占位符与元数据处理会更新 README 中的 `{{projectName}}`，保留 `package.json` 的 `name` 字段，并在项目根记录 `.yxp-template`。
- `update` 命令根据模板与项目差异生成彩色 diff（含二进制检测）、支持 `--all` 全量更新与 `--skip-all` 干跑模式。
- 通过 `.yxpignore` 或 `yxp.config.js`（`update.ignore` / `update.include`）提供 Gitignore 风格的排除/包含规则，并与内置忽略列表合并，避免误改本地文件。
- 工具函数统一了 JSON 写入、文件读写、日志输出、进度展示和模板记录的行为，确保命令执行一致。

## 架构说明
- `src/index.ts` 使用 Commander 注册 CLI 入口，并暴露 `init`、`update` 两个命令。
- `src/commands/init.ts` 负责项目初始化：模板发现、交互式选择、文件复制、占位符替换以及 `package.json` 增量更新。
- `src/commands/update.ts` 主导同步流程：读取 `.yxp-template`、解析忽略规则、扫描差异并支持交互式或批量更新模式。
- `src/core/update/` 提供差异引擎：`scanner.ts` 枚举文件、`differ.ts` 生成待处理项目、`handlers.ts` 判定增删改策略、`applier.ts` 写入文件并结合 `progress.ts` 展示进度。
- `src/utils/` 封装常用能力，包括二进制安全文件读取（`fs.ts`）、差异展示与摘要、JSON 格式化、模板记录、忽略解析以及彩色日志。
- `src/types/` 提供第三方依赖的类型声明（如 `cli-progress-footer`），提升 TypeScript 开发体验。

## 安装
1. 环境要求：
   - Node.js ≥ 18
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

更新流程会遵循 `.yxpignore`、自动跳过 `README.md` 等动态文件，并在批量操作时展示实时进度。

### 忽略规则配置

- **默认行为**：`yxp-start update` 会自动忽略 `node_modules`、`dist`、`.turbo` 等常见构建产物，保持模板同步的纯净性。
- **`.yxpignore`**：在项目根新增 Gitignore 风格的规则即可扩展或用 `!pattern` 重新包含路径。
- **`yxp.config.js`**：若更偏好显式配置，可在项目根创建 JS 配置文件。`ignore` / `include` 都支持 glob，并会与默认规则及 `.yxpignore` 合并：

```js
// yxp.config.js
export default {
  update: {
    ignore: ['src/**', 'tests/**'],
    include: ['src/config.ts'],
  },
};
```

`include` 中的条目具有最高优先级，可确保即便父目录被忽略，仍能同步特定文件。

### JSON 字段保留

- 默认情况下，`yxp-start update` 会保留 `package.json` 的 `name` 字段。
- 通过 `update.jsonFiles` 可对任意 JSON 文件（使用项目根的相对路径、POSIX 风格 `/`）声明要保留的字段。只有当目标文件中存在这些字段时才会写回，避免意外覆盖。

```js
// yxp.config.js
export default {
  update: {
    jsonFiles: {
      'package.json': { preserve: ['name', 'version', 'publishConfig'] },
      'src/config/app.json': { preserve: ['featureFlags', 'releaseChannel'] },
    },
  },
};
```

### 完整的 `yxp.config.js` 示例

以下示例展示了所有可用选项的组合，可按需删减：

```js
// yxp.config.js
export default {
  update: {
    ignore: ['docs/**', 'scripts/**'],      // 额外需要跳过的路径
    include: ['scripts/release.js'],        // 即便被忽略也强制包含
    skipDynamic: ['README.md'],             // 扩展动态文件跳过列表（可选）
    jsonFiles: {
      'package.json': { preserve: ['name', 'version', 'publishConfig'] },
      'src/config/app.json': { preserve: ['featureFlags'] },
    },
  },
};
```

`update` 内所有字段都是可选项，省略后会回退到 CLI 的内置默认行为。

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
- 模板位于 `templates/` 目录，随仓库版本一并演进。

## 许可证
MIT
