import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FALLBACK_CLI_NAME = "yxp-start";
const FALLBACK_DESCRIPTION = "CLI tool for YXP starter projects";
const FALLBACK_VERSION = "0.0.0";
const FALLBACK_PROJECT_NAME = "my-project";
const pkgJson = require("../../package.json");
const derivedCliName = (() => {
	const bin = pkgJson.bin;
	if (!bin) {
		return undefined;
	}
	if (typeof bin === "string") {
		const packageName = pkgJson.name?.trim();
		return packageName ? packageName.replace(/^@([^/]+)\//, "") : undefined;
	}
	const keys = Object.keys(bin);
	return keys.find((key) => key.trim().length > 0);
})();
const configSection = pkgJson.config ?? {};
const cliConfig = configSection.cli ?? {};
const derivedDefaultProjectName = (() => {
	const value = cliConfig.defaultProjectName;
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
})();
export const CLI_META = {
	name: derivedCliName ?? FALLBACK_CLI_NAME,
	description: pkgJson.description ?? FALLBACK_DESCRIPTION,
	version: pkgJson.version ?? FALLBACK_VERSION,
	defaultProjectName: derivedDefaultProjectName ?? FALLBACK_PROJECT_NAME,
};
