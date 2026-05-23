import { describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractInlineItems, loadTree } from '../../src/model/tree.ts';
import type { Item } from '../../src/model/types.ts';

function findByTitle(items: Item[], title: string, form?: Item['form']): Item | undefined {
  for (const it of items) {
    if (it.fields.title === title && (form === undefined || it.form === form)) return it;
    const found = findByTitle(it.children, title, form);
    if (found) return found;
  }
  return undefined;
}

describe('extractInlineItems', () => {
  test('flat list', () => {
    const body = '- [ ] First\n- [x] Second done\n';
    const items = extractInlineItems(body, 'index.md', 1);
    expect(items).toHaveLength(2);
    expect(items[0]?.fields.title).toBe('First');
    expect(items[1]?.fields.status).toBe('x');
  });

  test('nested children via indent', () => {
    const body = ['- [ ] Parent', '  - [ ] Child A', '  - [ ] Child B', '- [ ] Sibling'].join(
      '\n',
    );
    const items = extractInlineItems(body, 'index.md', 1);
    expect(items).toHaveLength(2);
    expect(items[0]?.children.map((c) => c.fields.title)).toEqual(['Child A', 'Child B']);
    expect(items[1]?.fields.title).toBe('Sibling');
  });

  test('ignores non-task list lines', () => {
    const body = '- [ ] A task\n- a bare item\n- [ ] Another task\n';
    const items = extractInlineItems(body, 'index.md', 1);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.fields.title)).toEqual(['A task', 'Another task']);
  });
});

describe('loadTree against the root/ fixture', () => {
  test('parses every Item in the fixture tree without error', async () => {
    const items = await loadTree('root');

    // From [x] XX-123 My Issue.md
    const myIssue = findByTitle(items, 'My Issue', 'file');
    expect(myIssue).toBeDefined();
    expect(myIssue?.fields.issueKey).toBe('XX-123');
    expect(myIssue?.fields.status).toBe('x');
    expect(myIssue?.body?.frontmatter['issue-key']).toBe('XX-123');

    // Same title appears as an inline link reference in root/index.md
    const myIssueLink = findByTitle(items, 'My Issue', 'inline');
    expect(myIssueLink?.fields.issueKey).toBe('XX-123');

    // From [ ] YY-323 Another Epic/
    const anotherEpic = findByTitle(items, 'Another Epic');
    expect(anotherEpic).toBeDefined();
    expect(anotherEpic?.form).toBe('dir');
    expect(anotherEpic?.fields.issueKey).toBe('YY-323');
    expect(anotherEpic?.children.length).toBeGreaterThan(0);

    // Children of the Dir item
    const child0 = anotherEpic?.children.find((c) => c.fields.index === '0');
    expect(child0).toBeDefined();
    expect(child0?.fields.issueKey).toBe('ZZ-222');

    // Inline items extracted from root/index.md
    const inlineFE123 = findByTitle(items, 'Do something cool');
    expect(inlineFE123).toBeDefined();
    expect(inlineFE123?.form).toBe('inline');
    expect(inlineFE123?.fields.issueKey).toBe('FE-123');
  });
});

describe('loadTree on synthesized fixtures', () => {
  test('handles empty root directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-tree-'));
    const items = await loadTree(dir);
    expect(items).toEqual([]);
  });

  test('returns File and Dir items at top level', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-tree-'));
    await writeFile(join(dir, '[ ] AA-1 First.md'), '# First\n');
    await mkdir(join(dir, '[ ] AA-2 Second'));
    await writeFile(
      join(dir, '[ ] AA-2 Second', 'index.md'),
      '<!--\nissue-key = AA-2\n-->\n# Second\n',
    );
    await writeFile(
      join(dir, '[ ] AA-2 Second', '[ ] 0. BB-1 Child.md'),
      '# Child\n',
    );

    const items = await loadTree(dir);
    const titles = items.map((i) => i.fields.title).toSorted();
    expect(titles).toEqual(['First', 'Second']);
    const second = items.find((i) => i.fields.title === 'Second');
    expect(second?.form).toBe('dir');
    expect(second?.children.map((c) => c.fields.title)).toEqual(['Child']);
  });

  test('ignores .md-issue/ and .git/', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'md-issue-tree-'));
    await mkdir(join(dir, '.md-issue'));
    await writeFile(join(dir, '.md-issue', 'config.toml'), '');
    await mkdir(join(dir, '.git'));
    await writeFile(join(dir, '[ ] AA-1 Real.md'), '# Real\n');

    const items = await loadTree(dir);
    expect(items.map((i) => i.fields.title)).toEqual(['Real']);
  });
});
