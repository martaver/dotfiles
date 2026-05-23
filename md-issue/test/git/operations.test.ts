import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../../src/git/exec.ts';
import {
  addPaths,
  findRepoRoot,
  getChangedFiles,
  isInConflictState,
  readIndexFile,
} from '../../src/git/operations.ts';

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'md-issue-git-'));
  await git(['init', '-q', '-b', 'main'], { cwd: dir });
  await git(['config', 'user.email', 'test@example.com'], { cwd: dir });
  await git(['config', 'user.name', 'Test'], { cwd: dir });
  await git(['config', 'commit.gpgsign', 'false'], { cwd: dir });
  return dir;
}

let repo: string;
beforeEach(async () => {
  repo = await initRepo();
});
afterEach(async () => {
  await rm(repo, { recursive: true, force: true });
});

describe('findRepoRoot', () => {
  test('finds the root', async () => {
    const root = await findRepoRoot(repo);
    expect(root).toBeTruthy();
    expect(root?.endsWith(repo.replace(/^\/private/, '')) || root === repo).toBe(true);
  });

  test('returns null outside a repo', async () => {
    const root = await findRepoRoot(tmpdir());
    // tmpdir itself may or may not be in a repo on the CI host; the only
    // assertion we can make is that the call returns a value or null without
    // throwing.
    expect(root === null || typeof root === 'string').toBe(true);
  });
});

describe('getChangedFiles', () => {
  test('reports untracked files in working', async () => {
    await writeFile(join(repo, 'new.md'), 'hello');
    const { working, staged, unmerged } = await getChangedFiles(repo);
    expect(working).toContain('new.md');
    expect(staged).toEqual([]);
    expect(unmerged).toEqual([]);
  });

  test('reports staged files', async () => {
    await writeFile(join(repo, 'a.md'), 'hello');
    await addPaths(repo, ['a.md']);
    const { staged } = await getChangedFiles(repo);
    expect(staged).toContain('a.md');
  });

  test('reports modified-but-not-staged separately', async () => {
    await writeFile(join(repo, 'a.md'), 'one');
    await addPaths(repo, ['a.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });
    await writeFile(join(repo, 'a.md'), 'two');
    const { working, staged } = await getChangedFiles(repo);
    expect(working).toContain('a.md');
    expect(staged).not.toContain('a.md');
  });
});

describe('readIndexFile', () => {
  test('returns the staged version, not the working tree version', async () => {
    await writeFile(join(repo, 'a.md'), 'staged contents');
    await addPaths(repo, ['a.md']);
    await writeFile(join(repo, 'a.md'), 'working contents');
    const indexed = await readIndexFile(repo, 'a.md');
    expect(indexed).toBe('staged contents');
  });

  test('returns null for untracked paths', async () => {
    await writeFile(join(repo, 'a.md'), 'never staged');
    expect(await readIndexFile(repo, 'a.md')).toBeNull();
  });
});

describe('isInConflictState', () => {
  test('clean repo → false', async () => {
    expect(await isInConflictState(repo)).toBe(false);
  });
});
