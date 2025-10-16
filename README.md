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
- Template metadata lives in `template.json`; each entry points to a remote Git repository (or optional local path) that is cloned on demand and cached under `~/.yxp-starter/templates`.
- Interactive template selection through the `init` command, copying only the files that matter while skipping `node_modules`, `.pnpm`, `dist`, `.git`, and other boilerplate directories.
- Smart placeholder and metadata handling keeps generated READMEs up to date, preserves the project `package.json` name, and records the chosen template (including git commit) in a JSON `.yxp-template` manifest.
- Diff-driven updates compare template and project files, preview colourised diffs (with binary detection), and support unattended runs via `--all` or dry runs via `--skip-all`.
- Gitignore-style exclusions through `.yxpignore` plus built-in skip lists prevent local-only files from being touched.
- Utility helpers standardise JSON formatting, file I/O, logging, progress indicators, remote template fetching, and template selection for consistent behaviour across commands.

## Architecture
- `template.json` enumerates the available templates, their Git source, branch/tag, and optional subdirectory.
- `src/index.ts` wires the CLI entry point with Commander, registering the `init` and `update` commands.
- `src/commands/init.ts` orchestrates new project creation, downloads the selected template (if not cached), performs placeholder replacement, and writes the `.yxp-template` manifest.
- `src/commands/update.ts` drives synchronisation by fetching templates, scanning differences, honouring ignore rules, and delegating to interactive or batch update flows.
- `src/core/update/` contains the diff engine: `scanner.ts` enumerates files, `differ.ts` builds pending updates, `handlers.ts` classifies file actions, and `applier.ts` writes or deletes files with a progress footer from `progress.ts`.
- `src/utils/` houses shared services: file helpers (`fs.ts`), diff/summary rendering, JSON formatting, template configuration (`template-config.ts`), remote fetching & caching (`template-fetch.ts`), manifest management (`templates.ts`), ignore parsing, and colourised logging.
- `src/types/` ships ambient type declarations (e.g. `cli-progress-footer`) used by the CLI runtime.

## Installation
1. Install prerequisites:
   - Node.js ≥ 18
   - Git (for fetching templates)
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

The command creates the target directory, copies template contents, replaces `{{projectName}}` placeholders, and preserves the package name field.
The available templates come from `template.json`. Each entry points to a Git repository (and optional subdirectory); the CLI clones the repository on demand, caches it in `~/.yxp-starter/templates`, and reuses the cache for subsequent runs.

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

Each run refreshes the template from its Git source (unless already cached) before computing diffs. The updater respects `.yxpignore`, skips dynamic files such as `README.md`, and shows a live progress footer while applying batches.

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
- Template-specific changes live in the Git repositories referenced by `template.json`; update their commits there to propagate new scaffolding.

## License
MIT
