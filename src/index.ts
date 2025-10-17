#!/usr/bin/env node

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { init } from './commands/init';
import { update } from './commands/update';

const require = createRequire(import.meta.url);
const pkgInfo = require('../package.json') as {
  name: string;
  description?: string;
  version: string;
};

const program = new Command();
const { name: pkgName, version: pkgVersion, description: pkgDescription = '' } = pkgInfo;

program.name(pkgName).description(pkgDescription).version(pkgVersion);

program
  .command('init')
  .description('Initialize a new project from template')
  .argument('[project-name]', 'Project name', 'my-project')
  .option('-t, --template <templateName>', 'Template name to use directly')
  .action(init);

program
  .command('update')
  .description('Update project configurations from starter')
  .option('-a, --all', 'Update all files without prompt')
  .option('-s, --skip-all', 'Skip all updates (dry run)')
  .action(update);

program.parse();
