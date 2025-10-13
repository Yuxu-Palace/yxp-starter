# yxp-starter

A powerful starter kit for TypeScript library projects with inheritable configurations and CLI tools.

## ✨ Features

- 🎯 **Inheritable Configurations** - Share common configs across projects via `extends`
- 🚀 **CLI Tools** - Initialize and update projects with simple commands
- 📦 **Ready-to-use Templates** - Pre-configured build, test, and lint setup
- 🔄 **Smart Updates** - View diffs and selectively update files
- 💪 **Full TypeScript Support** - Type-safe from the start
- ⚡ **Modern Tooling** - Rslib, Vitest, Biome

## 🚀 Quick Start

### Initialize a new project

```bash
npx yxp-start init my-project
cd my-project
pnpm install
pnpm dev
```

### Update existing project

```bash
# Interactive update with diff preview
npx yxp-start update

# Update all files without prompts
npx yxp-start update --all
```

## 📚 Documentation

See [USAGE.md](./USAGE.md) for detailed usage guide and examples.

## 📦 What's Included

- **Configs** (inheritable):
  - `biome.json` - Code formatting and linting
  - `tsconfig.json` - TypeScript configuration
  - `commitlint.config.js` - Commit message linting
  - `lint-staged.config.js` - Pre-commit hooks

- **Templates**:
  - `src/` - Source code directory
  - `tests/` - Test files with Vitest
  - `rslib.config.ts` - Build configuration
  - `vitest.config.ts` - Test configuration

## 🔧 Commands

```bash
# Initialize new project
yxp-start init [project-name]

# Update project configurations
yxp-start update [options]
  -a, --all       Update all files without prompt
  -s, --skip-all  Skip all updates (dry run)
```

## 💡 How It Works

1. **Configurations are inherited** via `extends` in config files
2. **Update configs** by simply updating the `yxp-starter` package version
3. **Selectively update templates** using the CLI with diff preview

See [USAGE.md](./USAGE.md) for comparison with traditional approaches.

## 📄 License

MIT