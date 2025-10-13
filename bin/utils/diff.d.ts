export declare function showDiff(
	oldContent: string,
	newContent: string,
	fileName: string,
): void;
export declare function getDiffStats(
	oldContent: string,
	newContent: string,
): {
	added: number;
	removed: number;
};
