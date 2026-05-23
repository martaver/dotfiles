import { describe, expect, test } from 'bun:test';
import {
  extractFrontmatter,
  parseFrontmatter,
  serializeFrontmatter,
} from '../../src/model/frontmatter.ts';

describe('extractFrontmatter', () => {
  test('extracts a top-of-file block', () => {
    const text = '<!--\nissue-key = XX-123\nstatus = backlog\n-->\n\n# My Issue\n';
    const { raw, rest } = extractFrontmatter(text);
    expect(raw).toBe('issue-key = XX-123\nstatus = backlog');
    expect(rest).toBe('\n# My Issue\n');
  });

  test('returns null + original text when no block', () => {
    const text = '# My Issue\n\nNo frontmatter here.\n';
    const { raw, rest } = extractFrontmatter(text);
    expect(raw).toBeNull();
    expect(rest).toBe(text);
  });

  test('ignores frontmatter-like content not at the top', () => {
    const text = '# My Issue\n\n<!--\nissue-key = NO\n-->\n';
    const { raw } = extractFrontmatter(text);
    expect(raw).toBeNull();
  });
});

describe('parseFrontmatter', () => {
  test('parses key = value lines', () => {
    const fm = parseFrontmatter('issue-key = XX-123\nstatus = backlog\nprovider = jira-main');
    expect(fm).toEqual({
      'issue-key': 'XX-123',
      status: 'backlog',
      provider: 'jira-main',
    });
  });

  test('preserves unknown keys', () => {
    const fm = parseFrontmatter('custom-field = some-value\nissue-key = XX-1');
    expect(fm['custom-field']).toBe('some-value');
    expect(fm['issue-key']).toBe('XX-1');
  });

  test('strips matched surrounding quotes', () => {
    expect(parseFrontmatter('status = "in review"')['status']).toBe('in review');
    expect(parseFrontmatter("status = 'in review'")['status']).toBe('in review');
  });

  test('keeps values with internal slashes verbatim (lenient parser)', () => {
    // Real fixture has `status = backlog / unplanned`.
    expect(parseFrontmatter('status = backlog / unplanned')['status']).toBe(
      'backlog / unplanned',
    );
  });

  test('ignores blank lines and unparseable lines', () => {
    const fm = parseFrontmatter('\nissue-key = XX-1\n\nnonsense\nstatus = done\n');
    expect(fm).toEqual({ 'issue-key': 'XX-1', status: 'done' });
  });
});

describe('serializeFrontmatter', () => {
  test('emits known keys in canonical order', () => {
    const out = serializeFrontmatter({
      status: 'done',
      'issue-key': 'XX-1',
      provider: 'jira-main',
    });
    expect(out).toBe('<!--\nissue-key = XX-1\nstatus = done\nprovider = jira-main\n-->');
  });

  test('appends unknown keys after known ones, in insertion order', () => {
    const fm = {
      'issue-key': 'XX-1',
      alpha: '1',
      beta: '2',
    };
    expect(serializeFrontmatter(fm)).toBe(
      '<!--\nissue-key = XX-1\nalpha = 1\nbeta = 2\n-->',
    );
  });

  test('returns empty string when there is nothing to write', () => {
    expect(serializeFrontmatter({})).toBe('');
  });
});

describe('round-trip', () => {
  test('parse → serialize → parse identity', () => {
    const raw = 'issue-key = XX-123\nstatus = backlog / unplanned\nprovider = jira-main';
    const parsed = parseFrontmatter(raw);
    const serialized = serializeFrontmatter(parsed);
    const reparsed = parseFrontmatter(serialized.replace(/^<!--\n|\n-->$/g, ''));
    expect(reparsed).toEqual(parsed);
  });
});
