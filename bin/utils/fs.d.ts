export type FileReadResult =
	| {
			raw: Buffer;
			content: string;
			isBinary: false;
	  }
	| {
			raw: Buffer;
			content: Buffer;
			isBinary: true;
	  };
export declare function readFileContent(
	filePath: string,
): Promise<FileReadResult>;
export declare function copyDirectory(src: string, dest: string): Promise<void>;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function readJsonFile<T = unknown>(filePath: string): Promise<T>;
export declare function writeJsonFile(
	filePath: string,
	data: unknown,
): Promise<void>;
