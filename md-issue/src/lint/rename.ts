import { stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { getRenames, listIndexedPaths } from '../git/operations.ts';
import { parseFilename } from '../model/filename.ts';

/** Result of resolving renames — covers both file moves and dir moves. */
export type RenameMaps = {
  /** newPath → oldPath for `.md` file renames. */
  fileRenames: Map<string, string>;
  /** newDirPath → oldDirPath for directory (Dir-form item) renames. */
  dirRenames: Map<string, string>;
};

/**
 * Resolve renames between the index and the working tree. Combines git's
 * similarity-based rename detection (`git diff -M`) with an Issue-Key-based
 * fallback so renames involving untracked files (`mv` → new path) still pair.
 * Detects both File-form (`.md` file) and Dir-form (directory holding
 * `index.md`) renames.
 */
export async function resolveRenames(repoRoot: string): Promise<RenameMaps> {
  // 1. Git's built-in rename detection for tracked files.
  const fileRenames = await getRenames(repoRoot);
  const dirRenames = new Map<string, string>();

  // 2. Issue-Key fallback for both forms. Indexed `.md` files that are no
  //    longer on disk are candidates: a missing `index.md` whose parent dir is
  //    also gone signals a Dir rename; otherwise it's a File rename.
  const indexed = await listIndexedPaths(repoRoot);
  const deletedFiles: { path: string; key: string }[] = [];
  const deletedDirs: { path: string; key: string }[] = [];
  for (const p of indexed) {
    if (!p.endsWith('.md')) continue;
    const abs = join(repoRoot, p);
    if (await pathExists(abs)) continue;

    if (p.endsWith('/index.md')) {
      const dirPath = p.slice(0, -'/index.md'.length);
      const dirAbs = join(repoRoot, dirPath);
      // If the parent dir is also missing, this is a Dir-form rename.
      if (!(await pathExists(dirAbs))) {
        const key = issueKeyFromPath(dirPath);
        if (key) deletedDirs.push({ path: dirPath, key });
        continue;
      }
    }
    const key = issueKeyFromPath(p);
    if (key) deletedFiles.push({ path: p, key });
  }

  const indexedSet = new Set(indexed);

  if (deletedFiles.length > 0) {
    const onDisk = await listMdFilesOnDisk(repoRoot);
    for (const newPath of onDisk) {
      if (fileRenames.has(newPath)) continue;
      if (indexedSet.has(newPath)) continue;
      const newKey = issueKeyFromPath(newPath);
      if (!newKey) continue;
      const match = deletedFiles.find((d) => d.key === newKey);
      if (match) fileRenames.set(newPath, match.path);
    }
  }

  if (deletedDirs.length > 0) {
    const onDiskDirs = await listIndexedDirCandidates(repoRoot);
    for (const newPath of onDiskDirs) {
      const newKey = issueKeyFromPath(newPath);
      if (!newKey) continue;
      const match = deletedDirs.find((d) => d.key === newKey);
      if (match) dirRenames.set(newPath, match.path);
    }
  }

  return { fileRenames, dirRenames };
}

function issueKeyFromPath(p: string): string | null {
  const name = p.split('/').pop() ?? p;
  const parsed = parseFilename(name);
  return parsed?.fields.issueKey ?? null;
}

async function pathExists(absPath: string): Promise<boolean> {
  try {
    await stat(absPath);
    return true;
  } catch {
    return false;
  }
}

async function listMdFilesOnDisk(repoRoot: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const out: string[] = [];
  const SKIP = new Set(['.md-issue', '.git', 'node_modules', 'dist']);
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), sub);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(sub);
      }
    }
  };
  await walk(repoRoot, '');
  return out;
}

/** List candidate directories that contain an `index.md` (Dir-form items). */
async function listIndexedDirCandidates(repoRoot: string): Promise<string[]> {
  const { readdir } = await import('node:fs/promises');
  const out: string[] = [];
  const SKIP = new Set(['.md-issue', '.git', 'node_modules', 'dist']);
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP.has(entry.name)) continue;
      if (!entry.isDirectory()) continue;
      const sub = prefix ? `${prefix}/${entry.name}` : entry.name;
      const abs = join(dir, entry.name);
      if (await pathExists(join(abs, 'index.md'))) out.push(sub);
      await walk(abs, sub);
    }
  };
  await walk(repoRoot, '');
  return out;
}

// suppress unused warning for `dirname` import — needed if rename.ts evolves
void dirname;
