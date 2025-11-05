import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 执行 git 命令并返回标准输出，失败时抛出带上下文的信息。
 */
export async function runGitCommand(args: string[], cwd?: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return stdout.toString();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to execute git ${args.join(' ')}: ${message}`);
  }
}
