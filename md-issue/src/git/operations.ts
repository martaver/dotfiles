import { git } from './exec.ts';

export type ChangedFiles = {
  /** Modified or untracked paths in the working tree (relative to repo root). */
  working: string[];
  /** Paths staged but not yet committed. */
  staged: string[];
  /** Paths in a merge-conflict state. */
  unmerged: string[];
};

/**
 * Return the set of paths that differ between (working tree, index, HEAD). All
 * paths are repo-root-relative.
 */
export async function getChangedFiles(cwd: string): Promise<ChangedFiles> {
  // `git status --porcelain=v1 -z`: NUL-separated entries, two-char status + space + path.
  const result = await git(['status', '--porcelain=v1', '-z'], { cwd });
  const working: string[] = [];
  const staged: string[] = [];
  const unmerged: string[] = [];

  // -z produces records separated by NUL; for renames the format is `R  new\0old`.
  const records = result.stdout.split('\0').filter((r) => r.length > 0);
  for (let i = 0; i < records.length; i++) {
    const rec = records[i] ?? '';
    if (rec.length < 3) continue;
    const x = rec[0];
    const y = rec[1];
    const path = rec.slice(3);

    // Rename: consume the next record as the old path (currently unused).
    if (x === 'R' || x === 'C') i += 1;

    // Unmerged: any combination involving 'U', or both 'D'/'A' on both sides.
    const isUnmerged =
      x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D');
    if (isUnmerged) {
      unmerged.push(path);
      continue;
    }
    if (x !== ' ' && x !== '?') staged.push(path);
    if (y !== ' ' || x === '?') working.push(path);
  }
  return { working, staged, unmerged };
}

/**
 * Read the index version of `path`. Returns null if the path is not tracked.
 *
 * Implementation note: we resolve the path → blob SHA via `ls-files -s`
 * (`--literal-pathspecs`) and then `cat-file blob`. Going through `git show :path`
 * subjects the path to pathspec-glob interpretation, which mangles filenames
 * containing `[`, `*`, or `?` (e.g. `[x] My Issue.md`).
 */
export async function readIndexFile(cwd: string, path: string): Promise<string | null> {
  const lsFiles = await git(
    ['--literal-pathspecs', 'ls-files', '-s', '--', path],
    { cwd, allowFailure: true },
  );
  if (lsFiles.exitCode !== 0 || lsFiles.stdout.trim() === '') return null;
  // Format: `<mode> <sha> <stage>\t<path>\n`
  const firstLine = lsFiles.stdout.split('\n')[0] ?? '';
  const match = firstLine.match(/^\d+\s+([0-9a-f]+)\s+\d+\t/);
  if (!match) return null;
  const sha = match[1];
  if (!sha) return null;
  const blob = await git(['cat-file', 'blob', sha], { cwd, allowFailure: true });
  if (blob.exitCode !== 0) return null;
  return blob.stdout;
}

/** Stage one or more paths. Uses `--literal-pathspecs` so `[` / `*` in filenames are not interpreted as glob characters. */
export async function addPaths(cwd: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await git(['--literal-pathspecs', 'add', '--', ...paths], { cwd });
}

/**
 * True iff the repo currently has any unmerged paths (i.e. a merge or rebase
 * with conflicts is in progress).
 */
export async function isInConflictState(cwd: string): Promise<boolean> {
  const { unmerged } = await getChangedFiles(cwd);
  return unmerged.length > 0;
}

/**
 * Return the absolute path to the repo root, or null if cwd is not in a git
 * working tree.
 */
export async function findRepoRoot(cwd: string): Promise<string | null> {
  const result = await git(['rev-parse', '--show-toplevel'], { cwd, allowFailure: true });
  if (result.exitCode !== 0) return null;
  return result.stdout.trim();
}

/**
 * Detect renames between the index and the working tree (`git diff -M`). Returns
 * a map of `newPath -> oldPath` for every rename above the similarity threshold.
 *
 * `git diff -M` only pairs renames between TRACKED files. Untracked working-tree
 * files (the typical case after a user `mv`s a file) won't be paired. Lint
 * augments this with key-based matching via `getRenamesByIssueKey`.
 */
export async function getRenames(cwd: string): Promise<Map<string, string>> {
  const result = await git(['diff', '--name-status', '-M', '-z'], { cwd });
  const renames = new Map<string, string>();
  const tokens = result.stdout.split('\0').filter((t) => t.length > 0);
  let i = 0;
  while (i < tokens.length) {
    const status = tokens[i] ?? '';
    if (status.startsWith('R') || status.startsWith('C')) {
      const oldPath = tokens[i + 1];
      const newPath = tokens[i + 2];
      if (oldPath && newPath) renames.set(newPath, oldPath);
      i += 3;
    } else {
      i += 2;
    }
  }
  return renames;
}

/** List all paths currently tracked in the index. */
export async function listIndexedPaths(cwd: string): Promise<string[]> {
  const result = await git(['--literal-pathspecs', 'ls-files', '-z'], { cwd });
  return result.stdout.split('\0').filter((p) => p.length > 0);
}
