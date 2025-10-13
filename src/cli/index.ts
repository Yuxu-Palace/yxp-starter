#!/usr/bin/env node

import { createRequire } from "node:module";
import { Command } from "commander";
import { init } from "./commands/init.js";
import { update } from "./commands/update.js";

// 在 ESM 环境下通过 createRequire 获取 require 能力，用于读取 JSON。
const require = createRequire(import.meta.url);
// 从 package.json 解析版本号，让 CLI 输出与包版本保持一致。
const { version: packageVersion } = require("../package.json") as {
	version?: string;
};

const program = new Command();

// Commander 需要字符串格式的版本号，缺失时回退到默认值。
const cliVersion =
	typeof packageVersion === "string" ? packageVersion : "0.0.0";

program
	.name("yxp-start")
	.description("CLI tool for YXP starter projects")
	.version(cliVersion);

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
