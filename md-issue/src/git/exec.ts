export type GitResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export class GitError extends Error {
  constructor(
    public readonly args: readonly string[],
    public readonly exitCode: number,
    public readonly stderr: string,
  ) {
    super(`git ${args.join(' ')} failed (exit ${exitCode}): ${stderr.trim()}`);
    this.name = 'GitError';
  }
}

export type GitOptions = {
  cwd: string;
  /** When true, do not throw on non-zero exit; return the result instead. */
  allowFailure?: boolean;
};

/**
 * Run `git` with the given args via `Bun.spawn` — bypasses the shell so that
 * pathspec-glob characters (`[`, `*`, `?`) in filenames are not expanded.
 */
export async function git(args: string[], opts: GitOptions): Promise<GitResult> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: opts.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  if (exitCode !== 0 && !opts.allowFailure) {
    throw new GitError(args, exitCode, stderr);
  }
  return { stdout, stderr, exitCode };
}
