import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git } from '../../src/git/exec.ts';
import { addPaths } from '../../src/git/operations.ts';
import { runLint } from '../../src/lint/lint.ts';

const STATUS_TABLE = { ' ': '<default>', _: 'Backlog', x: 'Done', r: 'In Review' };

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'md-issue-lint-'));
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

describe('runLint — validation point', () => {
  test('user edits status in filename → frontmatter and H1 stay in sync, change is staged', async () => {
    const oldPath = join(repo, '[_] XX-1 My Issue.md');
    const newPath = join(repo, '[x] XX-1 My Issue.md');
    await writeFile(oldPath, '<!--\nissue-key = XX-1\nstatus = Backlog\n-->\n\n# My Issue\n');
    await addPaths(repo, ['[_] XX-1 My Issue.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    // User renames the file to flip status from `_` to `x`.
    await rename(oldPath, newPath);

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.conflicts).toEqual([]);
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]?.touched).toBe(true);

    // Frontmatter status updated to map to `x` → "Done".
    const final = await readFile(newPath, 'utf8');
    expect(final).toContain('status = Done');
    expect(final).toContain('# My Issue');

    // Old path is gone from disk and staged for deletion; new path is staged.
    const status = await git(['status', '--porcelain'], { cwd: repo });
    const lines = status.stdout.split('\n').filter((l) => l.length > 0);
    const staged = lines.filter((l) => l[0] !== '?' && l[0] !== ' ');
    expect(staged.length).toBeGreaterThanOrEqual(1);
    // The new path should appear in the staged set (as A or R).
    expect(staged.some((l) => l.includes('[x] XX-1 My Issue.md'))).toBe(true);
  });

  test('untouched files are no-op (idempotent in the simple case)', async () => {
    const path = join(repo, '[x] XX-2 Done Issue.md');
    await writeFile(path, '<!--\nissue-key = XX-2\nstatus = Done\n-->\n\n# Done Issue\n');
    await addPaths(repo, ['[x] XX-2 Done Issue.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.applied.every((a) => !a.touched)).toBe(true);
    expect(result.conflicts).toEqual([]);

    // No new modifications.
    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout.trim()).toBe('');
  });

  test('new untracked file gets canonicalised + staged', async () => {
    // User adds frontmatter but the filename has no `[ ]` brackets yet.
    await writeFile(
      join(repo, 'Brand New.md'),
      '<!--\nissue-key = NEW-1\n-->\n\n# Brand New\n',
    );
    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.conflicts).toEqual([]);
    // The new file gets renamed to canonical form `[ ] NEW-1 Brand New.md`.
    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout).toContain('[ ] NEW-1 Brand New.md');
  });

  test('title edited in H1 propagates back to filename (rename)', async () => {
    await writeFile(
      join(repo, '[x] XX-3 Old Title.md'),
      '<!--\nissue-key = XX-3\nstatus = Done\n-->\n\n# Old Title\n',
    );
    await addPaths(repo, ['[x] XX-3 Old Title.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    // User edits the H1 only.
    await writeFile(
      join(repo, '[x] XX-3 Old Title.md'),
      '<!--\nissue-key = XX-3\nstatus = Done\n-->\n\n# Brand New Title\n',
    );

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.conflicts).toEqual([]);

    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout).toContain('[x] XX-3 Brand New Title.md');
  });
});
