import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  canonicalFileItemPath,
  renameItemFile,
  replaceInlineLine,
  serializeFileBody,
  writeFileItemBody,
} from '../../src/model/writers.ts';

describe('serializeFileBody', () => {
  test('frontmatter + H1 + description', () => {
    const out = serializeFileBody({
      frontmatter: { 'issue-key': 'XX-1', status: 'backlog' },
      h1: 'My Issue',
      description: 'Body text\nwith two lines\n',
    });
    expect(out).toBe(
      '<!--\nissue-key = XX-1\nstatus = backlog\n-->\n\n# My Issue\n\nBody text\nwith two lines\n',
    );
  });

  test('no frontmatter', () => {
    expect(
      serializeFileBody({ frontmatter: {}, h1: 'Plain', description: 'Just body.\n' }),
    ).toBe('# Plain\n\nJust body.\n');
  });

  test('no description', () => {
    expect(
      serializeFileBody({
        frontmatter: { 'issue-key': 'X-1' },
        h1: 'Heading only',
        description: '',
      }),
    ).toBe('<!--\nissue-key = X-1\n-->\n\n# Heading only\n');
  });
});

describe('canonicalFileItemPath', () => {
  test('builds canonical filename under parent', () => {
    const p = canonicalFileItemPath('/tmp/proj', {
      status: 'x',
      index: null,
      issueKey: 'XX-1',
      title: 'My Issue',
      directive: null,
    });
    expect(p).toBe('/tmp/proj/[x] XX-1 My Issue.md');
  });
});

describe('renameItemFile', () => {
  test('no-op when paths match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-w-'));
    const f = join(dir, 'a.md');
    await writeFile(f, 'x');
    await renameItemFile(f, f);
    expect(await readFile(f, 'utf8')).toBe('x');
  });

  test('moves file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-w-'));
    const a = join(dir, 'a.md');
    const b = join(dir, 'b.md');
    await writeFile(a, 'x');
    await renameItemFile(a, b);
    expect(await readFile(b, 'utf8')).toBe('x');
  });
});

describe('writeFileItemBody', () => {
  test('writes serialized body', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-w-'));
    const f = join(dir, 'out.md');
    await writeFileItemBody(f, {
      rawFrontmatter: null,
      frontmatter: { 'issue-key': 'X-1' },
      h1: 'Hi',
      description: 'Hello.\n',
      descriptionStartLine: 1,
    });
    expect(await readFile(f, 'utf8')).toBe('<!--\nissue-key = X-1\n-->\n\n# Hi\n\nHello.\n');
  });
});

describe('replaceInlineLine', () => {
  test('rewrites a task line', () => {
    const body = ['- [ ] Old title', 'prose line', '- [ ] Other'].join('\n');
    const out = replaceInlineLine(body, 1, {
      status: 'x',
      index: null,
      issueKey: 'XX-1',
      title: 'New title',
      directive: null,
    });
    expect(out).toBe(['- [x] XX-1 New title', 'prose line', '- [ ] Other'].join('\n'));
  });

  test('preserves indent', () => {
    const body = '  - [ ] Nested';
    const out = replaceInlineLine(body, 1, {
      status: 'x',
      index: null,
      issueKey: null,
      title: 'Nested',
      directive: null,
    });
    expect(out).toBe('  - [x] Nested');
  });

  test('preserves link form', () => {
    const body = '- [ ] [XX-1 Title](./[x]%20XX-1%20Title.md)';
    const out = replaceInlineLine(body, 1, {
      status: 'x',
      index: null,
      issueKey: 'XX-1',
      title: 'Title',
      directive: null,
    });
    expect(out).toBe('- [x] [XX-1 Title](./[x]%20XX-1%20Title.md)');
  });

  test('throws on non-task line', () => {
    expect(() => replaceInlineLine('prose', 1, {
      status: ' ', index: null, issueKey: null, title: 'x', directive: null,
    })).toThrow();
  });
});
