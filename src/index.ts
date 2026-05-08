#!/usr/bin/env node

import { Command } from 'commander';
import pkgInfo from '../package.json';
import { init } from './commands/init';
import { update } from './commands/update';
import { ensureDefaultDownloadPluginsRegistered } from './plugins/defaults';

const program = new Command();
const { name: pkgName, version: pkgVersion, description: pkgDescription = '' } = pkgInfo;

ensureDefaultDownloadPluginsRegistered();

program.name(pkgName).description(pkgDescription).version(pkgVersion);

program
  .command('init')
  .description('Initialize a new project from template')
  .argument('[project-name]', 'Project name')
  .option('-t, --template <templateName>', 'Template name to use directly')
  .action(init);

program
  .command('update')
  .description('Update project configurations from starter')
  .option('-a, --all', 'Update all files without prompt')
  .option('-s, --skip-all', 'Skip all updates (dry run)')
  .action(update);

program.parse();
