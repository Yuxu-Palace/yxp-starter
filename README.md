# yxp-starter

English | [中文](README.zh-CN.md)

## Introduction
yxp-starter is the official scaffolding and update CLI for the yuxu-palace ecosystem. It ships ready-to-use project templates and a diff-aware synchronisation workflow that keeps downstream projects aligned without overwriting local changes.

## Table of Contents
- [Introduction](#introduction)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [Examples](#examples)
- [Contributing](#contributing)
- [Support](#support)
- [FAQ](#faq)
- [Changelog](#changelog)
- [License](#license)

## Features
- Interactive template selection through the `init` command, using the remote catalog declared in `template.json` to download templates before copying only the files that matter while skipping `node_modules`, `.pnpm`, `dist`, and other boilerplate directories.
- Smart placeholder and metadata handling keeps generated READMEs up to date, preserves the configured `package.json` fields (defaults to `name`), and records the chosen template in `.yxp-template`.
- Diff-driven updates compare template and project files, preview colourised diffs (with binary detection), and support unattended runs via `--all` or dry runs via `--skip-all`.
- Gitignore-style exclusions through `.yxpignore` or `yxp.config.js` (with `update.ignore` / `update.include`) plus built-in skip lists prevent local-only files from being touched.
- Utility helpers standardise JSON formatting, file I/O, logging, progress indicators, template catalog loading, and downloader orchestration for consistent behaviour across commands.

## Architecture
- `template.json` enumerates all available templates and their remote Git sources, which are cached under `~/.yxp-starter/templates` once downloaded.
- `src/index.ts` wires the CLI entry point with Commander, registering the `init` and `update` commands.
- `src/commands/init.ts` orchestrates new project creation, including template discovery, interactive selection, file copying, placeholder replacement, and package metadata updates.
- `src/commands/update.ts` drives synchronisation by scanning differences, honouring ignore rules, and delegating to interactive or batch update flows.
- `src/core/update/` contains the diff engine: `scanner.ts` enumerates files, `differ.ts` builds pending updates, `handlers.ts` classifies file actions, and `applier.ts` writes or deletes files with a progress footer from `progress.ts`.
- `src/utils/` provides shared services such as binary-safe file access (`fs.ts`), diff/summary rendering, JSON formatting, template manifests, the template catalog loader, downloader orchestration, ignore parsing, and colourised logging.
- `src/types/` ships ambient type declarations (e.g. `cli-progress-footer`) used by the CLI runtime.

## Installation
1. Install prerequisites:
   - Node.js ≥ 18
   - pnpm (recommended)
2. Clone this repository and install dependencies:

   ```bash
   git clone https://github.com/your-org/yxp-starter.git
   cd yxp-starter
   pnpm install
   ```

To use the CLI without cloning, run `pnpm dlx yxp-start <command>` directly.

## Usage
### `init`

Initialise a new project from a template:

```bash
pnpm dlx yxp-start init my-project
# choose a template non-interactively
pnpm dlx yxp-start init my-project --template yxp-lib-start
```

The command creates the target directory, copies template contents, replaces `{{projectName}}` placeholders, and preserves the template-configured `package.json` fields (at minimum `name`).

### `update`

Synchronise an existing project with its template:

```bash
# interactive diff review
pnpm dlx yxp-start update

# apply every change automatically
pnpm dlx yxp-start update --all

# audit pending changes without writing files
pnpm dlx yxp-start update --skip-all
```

The updater respects `.yxpignore`, skips dynamic files such as `README.md`, and shows a live progress footer while applying batches.

### Template catalog

All templates are defined in `template.json`. Each entry points to a remote Git repository (and optional sub-path/ref) that the CLI downloads through the active downloader plugin (defaults to `@cmtlyt/git-down`). Example:

```json
{
  "templates": [
    {
      "name": "yxp-lib-start",
      "displayName": "YXP Library Starter",
      "source": {
        "type": "git",
        "url": "https://github.com/Yuxu-Palace/yxp-template",
        "ref": "feat/yxp-lib-start",
        "path": "start/yxp-lib-start"
      }
    }
  ]
}
```

Local filesystem sources are no longer supported—the CLI always pulls templates from the declared remote and caches them beneath `~/.yxp-starter/templates` for reuse.

### Ignore configuration

- **Defaults**: `yxp-start update` ignores common build artifacts (`node_modules`, `dist`, `.turbo`, etc.) out of the box so templates stay lean.
- **`.yxpignore`**: add Gitignore-style patterns in the project root to exclude or re-include paths (supports `!pattern` overrides).
- **`yxp.config.js`**: declare structured rules when you prefer JavaScript config. Both `ignore` and `include` accept glob patterns and merge with the defaults and `.yxpignore` content:

```js
// yxp.config.js
export default {
  update: {
    ignore: ['src/**', 'tests/**'],
    include: ['src/config.ts'],
  },
};
```

`include` entries always win—even if the same path is ignored elsewhere—making it simple to copy a single file out of a larger ignored tree.

### JSON preservation

- By default, `yxp-start update` always keeps the `name` field from `package.json`.
- Use `update.jsonFiles` to protect any JSON file by relative path (POSIX-style). Only existing fields in the project file are copied back, so optional data remains untouched unless present.

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

### Complete `yxp.config.js`

Use all knobs together to tailor the updater:

```js
// yxp.config.js
export default {
  update: {
    ignore: ['docs/**', 'scripts/**'],      // extra files to skip
    include: ['scripts/release.js'],        // but still allow this file through
    skipDynamic: ['README.md'],             // optional: extend dynamic skip list
    jsonFiles: {
      'package.json': { preserve: ['name', 'version', 'publishConfig'] },
      'src/config/app.json': { preserve: ['featureFlags'] },
    },
  },
};
```

Any field inside `update` is optional—omit what you don’t need and the CLI will fall back to its built-in defaults.

## Examples
- **Bootstrap a library**: `pnpm dlx yxp-start init my-lib --template yxp-lib-start` to scaffold a Rslib + Vitest powered package with Biome linting ready to go.
- **Review template drift**: run `pnpm dlx yxp-start update --skip-all` from a project root to list upcoming sync actions without modifying your workspace.

## Contributing
- Use `pnpm dev` for watch-mode builds and `pnpm build` to emit the distributable CLI.
- Run `pnpm check` and `pnpm format` before sending patches to keep linting and formatting consistent.
- Please open an issue to discuss significant changes before submitting a pull request.

## Support
If you encounter issues or have feature requests, open an issue in this repository. For private questions, reach out to the maintainers via the contact information in your organisation.

## FAQ
**Q: Do I need pnpm to consume the CLI?**
A: pnpm is recommended, but you can run the CLI through `npm create` or `npx` as long as your environment provides Node.js ≥ 18.

**Q: Will the updater overwrite my customised README?**
A: No. Files like `README.md` and `.yxpignore` are treated as dynamic and skipped during diff application. You can still inspect template changes manually if needed.

## Changelog
- Track notable updates via the Git history (`git log`) or project release notes as they become available.
- Template-specific changes live under `templates/` and inherit the same versioning cadence.

## License
MIT
