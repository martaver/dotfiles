import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { getRenames, listIndexedPaths } from '../git/operations.ts';
import { parseFilename } from '../model/filename.ts';

/**
 * Resolve renames between the index and the working tree. Combines git's
 * similarity-based rename detection (`git diff -M`) with an Issue-Key-based
 * fallback so renames involving untracked files (`mv` → new path) still pair.
 */
export async function resolveRenames(repoRoot: string): Promise<Map<string, string>> {
  // 1. Git's built-in (only pairs renames between tracked files).
  const renames = await getRenames(repoRoot);

  // 2. Issue-Key fallback. Build:
  //    - deletedFromIndex: indexed `.md` files that are no longer on disk.
  //    - newOnDisk: `.md` paths on disk not yet in `renames` mapped from.
  const indexed = await listIndexedPaths(repoRoot);
  const deletedFromIndex: { path: string; key: string }[] = [];
  for (const p of indexed) {
    if (!p.endsWith('.md')) continue;
    const exists = await pathExists(join(repoRoot, p));
    if (exists) continue;
    const key = issueKeyFromPath(p);
    if (key) deletedFromIndex.push({ path: p, key });
  }
  if (deletedFromIndex.length === 0) return renames;

  // Candidates for the "new path": any md file on disk that isn't already in
  // `renames` as a source.
  const onDisk = await listMdFilesOnDisk(repoRoot);
  const indexedSet = new Set(indexed);
  for (const newPath of onDisk) {
    if (renames.has(newPath)) continue;
    if (indexedSet.has(newPath)) continue; // already tracked → not a rename
    const newKey = issueKeyFromPath(newPath);
    if (!newKey) continue;
    const match = deletedFromIndex.find((d) => d.key === newKey);
    if (match) renames.set(newPath, match.path);
  }
  return renames;
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
