import { promises as fs } from "node:fs";
import path from "node:path";

export async function copyDirectory(src: string, dest: string): Promise<void> {
	await fs.mkdir(dest, { recursive: true });
	const entries = await fs.readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			await copyDirectory(srcPath, destPath);
		} else {
			await fs.copyFile(srcPath, destPath);
		}
	}
}

export async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function readJsonFile<T = unknown>(filePath: string): Promise<T> {
	const content = await fs.readFile(filePath, "utf-8");
	return JSON.parse(content) as T;
}

export async function writeJsonFile(
	filePath: string,
	data: unknown,
): Promise<void> {
	await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
