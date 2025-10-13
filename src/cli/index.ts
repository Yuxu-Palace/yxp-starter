#!/usr/bin/env node

import { Command } from "commander";
import { init } from "./commands/init.js";
import { update } from "./commands/update.js";

const program = new Command();

program
	.name("yxp-start")
	.description("CLI tool for YXP starter projects")
	.version("0.0.0");

program
	.command("init")
	.description("Initialize a new YXP project")
	.argument("[project-name]", "Project name", "my-project")
	.action(init);

program
	.command("update")
	.description("Update project configurations from starter")
	.option("-a, --all", "Update all files without prompt")
	.option("-s, --skip-all", "Skip all updates (dry run)")
	.action(update);

program.parse();
