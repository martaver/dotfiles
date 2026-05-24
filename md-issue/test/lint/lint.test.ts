import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
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

  test('Dir-form: status edited in dirname → index.md frontmatter updated, dir renamed, contents preserved', async () => {
    // Initial: a Dir item with an index.md and one child file inside.
    const oldDir = join(repo, '[_] YY-9 An Epic');
    await mkdir(oldDir);
    await writeFile(
      join(oldDir, 'index.md'),
      '<!--\nissue-key = YY-9\nstatus = Backlog\n-->\n\n# An Epic\n',
    );
    await writeFile(
      join(oldDir, '[ ] 0. ZZ-1 Child.md'),
      '<!--\nissue-key = ZZ-1\n-->\n\n# Child\n',
    );
    await addPaths(repo, ['[_] YY-9 An Epic']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    // User flips the dirname status from `_` to `x`.
    await rename(oldDir, join(repo, '[x] YY-9 An Epic'));

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.conflicts).toEqual([]);

    // The dir's index.md frontmatter now reflects "Done".
    const newIndex = await readFile(join(repo, '[x] YY-9 An Epic', 'index.md'), 'utf8');
    expect(newIndex).toContain('status = Done');
    expect(newIndex).toContain('# An Epic');

    // Children inside the dir moved with it.
    const childContents = await readFile(
      join(repo, '[x] YY-9 An Epic', '[ ] 0. ZZ-1 Child.md'),
      'utf8',
    );
    expect(childContents).toContain('# Child');

    // Both old and new dir paths are visible to git as staged changes.
    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout).toContain('[x] YY-9 An Epic/');
  });

  test('conflicting status edits in filename + frontmatter → markers injected into frontmatter', async () => {
    // Start with consistent state.
    await writeFile(
      join(repo, '[_] XX-7 Conflicted.md'),
      '<!--\nissue-key = XX-7\nstatus = Backlog\n-->\n\n# Conflicted\n',
    );
    await addPaths(repo, ['[_] XX-7 Conflicted.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    // User edits BOTH sides to different values.
    await rename(join(repo, '[_] XX-7 Conflicted.md'), join(repo, '[x] XX-7 Conflicted.md'));
    await writeFile(
      join(repo, '[x] XX-7 Conflicted.md'),
      '<!--\nissue-key = XX-7\nstatus = In Review\n-->\n\n# Conflicted\n',
    );

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.conflicts).toHaveLength(1);

    // The file (now at [x]) contains git-style markers in the frontmatter.
    const after = await readFile(join(repo, '[x] XX-7 Conflicted.md'), 'utf8');
    expect(after).toMatch(/^<<<<<<< /m);
    expect(after).toMatch(/^=======$/m);
    expect(after).toMatch(/^>>>>>>> /m);
    expect(after).toContain('status = Done'); // filename side
    expect(after).toContain('status = In Review'); // frontmatter side

    // Re-running lint refuses to touch this file (skip until user resolves).
    const second = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    const skipped = second.applied.find((a) => a.skippedReason === 'has-conflict-markers');
    expect(skipped).toBeDefined();
  });

  test('lint is idempotent: a second run after a successful first run is a no-op', async () => {
    const oldPath = join(repo, '[_] XX-5 Idem.md');
    const newPath = join(repo, '[x] XX-5 Idem.md');
    await writeFile(oldPath, '<!--\nissue-key = XX-5\nstatus = Backlog\n-->\n\n# Idem\n');
    await addPaths(repo, ['[_] XX-5 Idem.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    await rename(oldPath, newPath);

    // First run: applies the change.
    const first = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(first.applied.some((a) => a.touched)).toBe(true);

    // Commit so the index reflects the new canonical state.
    await git(['commit', '-q', '-m', 'lint'], { cwd: repo });

    // Second run: nothing has changed, so no item should be touched.
    const second = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(second.applied.every((a) => !a.touched)).toBe(true);
    expect(second.conflicts).toEqual([]);

    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout.trim()).toBe('');
  });

  test('cross-file propagation: editing a File item updates inline references by IssueKey', async () => {
    // index.md references the file both bare and as a markdown link.
    await writeFile(
      join(repo, 'index.md'),
      [
        '# Workspace',
        '',
        '- [ ] FE-50 The original title',
        '- [ ] [FE-50 The original title](./[%20]%20FE-50%20The%20original%20title.md)',
        '',
      ].join('\n'),
    );
    await writeFile(
      join(repo, '[ ] FE-50 The original title.md'),
      '<!--\nissue-key = FE-50\n-->\n\n# The original title\n',
    );
    await addPaths(repo, ['index.md', '[ ] FE-50 The original title.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    // User edits the H1 of the file (title change).
    await writeFile(
      join(repo, '[ ] FE-50 The original title.md'),
      '<!--\nissue-key = FE-50\n-->\n\n# A snappier title\n',
    );

    await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });

    // File got renamed to canonical form.
    const renamedExists = await Bun.file(
      join(repo, '[ ] FE-50 A snappier title.md'),
    ).exists();
    expect(renamedExists).toBe(true);

    // index.md inline references reflect the new title (and link href).
    const index = await readFile(join(repo, 'index.md'), 'utf8');
    expect(index).toContain('- [ ] FE-50 A snappier title');
    expect(index).toContain('[FE-50 A snappier title]');
    expect(index).toContain('./%5B%20%5D%20FE-50%20A%20snappier%20title.md');
  });

  test('>> FILE directive promotes an inline task to its own file', async () => {
    await writeFile(
      join(repo, 'index.md'),
      [
        '# Parent',
        '',
        '- [ ] FE-7 First task',
        '- [ ] FE-8 Promote me >> FILE',
        '  Some description for the promoted item.',
        '',
        '  - [ ] FE-9 Nested child',
        '- [ ] FE-10 Last task',
        '',
      ].join('\n'),
    );
    await addPaths(repo, ['index.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.applied.some((a) => a.newPath === '[ ] FE-8 Promote me.md')).toBe(true);

    // The new file exists with the inline content as body.
    const newFile = await readFile(join(repo, '[ ] FE-8 Promote me.md'), 'utf8');
    expect(newFile).toContain('# Promote me');
    expect(newFile).toContain('issue-key = FE-8');
    expect(newFile).toContain('Some description for the promoted item.');
    expect(newFile).toContain('- [ ] FE-9 Nested child');

    // The parent file no longer carries the promoted line.
    const parent = await readFile(join(repo, 'index.md'), 'utf8');
    expect(parent).not.toContain('Promote me');
    expect(parent).toContain('- [ ] FE-7 First task');
    expect(parent).toContain('- [ ] FE-10 Last task');
  });

  test('>> DIR directive (inline) creates a directory with index.md', async () => {
    await writeFile(
      join(repo, 'index.md'),
      ['# Parent', '', '- [ ] FE-11 Make a dir >> DIR', '  Body content.', ''].join('\n'),
    );
    await addPaths(repo, ['index.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.applied.some((a) => a.newPath === '[ ] FE-11 Make a dir')).toBe(true);

    const idx = await readFile(join(repo, '[ ] FE-11 Make a dir', 'index.md'), 'utf8');
    expect(idx).toContain('# Make a dir');
    expect(idx).toContain('Body content.');
  });

  test('>> DIR directive on a File item converts it into a dir', async () => {
    await writeFile(
      join(repo, '[ ] FE-12 Plain >> DIR.md'),
      '<!--\nissue-key = FE-12\n-->\n\n# Plain\n\nBody.\n',
    );
    await addPaths(repo, ['[ ] FE-12 Plain >> DIR.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    const result = await runLint({ workspaceRoot: repo, statusTable: STATUS_TABLE });
    expect(result.applied.some((a) => a.newPath === '[ ] FE-12 Plain')).toBe(true);

    const idx = await readFile(join(repo, '[ ] FE-12 Plain', 'index.md'), 'utf8');
    expect(idx).toContain('# Plain');
    expect(idx).toContain('Body.');
  });

  test('>> ARCHIVE directive moves the item into the archive dir', async () => {
    const src = join(repo, '[x] XX-8 Old Done >> ARCHIVE.md');
    await writeFile(src, '<!--\nissue-key = XX-8\nstatus = Done\n-->\n\n# Old Done\n');
    await addPaths(repo, ['[x] XX-8 Old Done >> ARCHIVE.md']);
    await git(['commit', '-q', '-m', 'init'], { cwd: repo });

    const result = await runLint({
      workspaceRoot: repo,
      statusTable: STATUS_TABLE,
      archiveDir: 'archive',
    });
    expect(result.conflicts).toEqual([]);
    expect(result.applied).toHaveLength(1);

    // Old path is gone; new path lives under `archive/` with no directive.
    const expectedNew = join(repo, 'archive', '[x] XX-8 Old Done.md');
    const contents = await readFile(expectedNew, 'utf8');
    expect(contents).toContain('# Old Done');

    const status = await git(['status', '--porcelain'], { cwd: repo });
    expect(status.stdout).toContain('archive/[x] XX-8 Old Done.md');
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
