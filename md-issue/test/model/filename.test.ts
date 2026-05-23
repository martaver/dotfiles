import { describe, expect, test } from 'bun:test';
import {
  isCanonicalFilename,
  parseFilename,
  serializeFilename,
} from '../../src/model/filename.ts';

describe('parseFilename', () => {
  test('full form with status, index, key, title, directive', () => {
    const result = parseFilename('[x] 1. XX-123 My Issue >> EPIC.md');
    expect(result).not.toBeNull();
    expect(result?.fields).toEqual({
      status: 'x',
      index: '1',
      issueKey: 'XX-123',
      title: 'My Issue',
      directive: 'EPIC',
    });
    expect(result?.ext).toBe('.md');
  });

  test('title only', () => {
    const result = parseFilename('My Issue.md');
    expect(result?.fields).toEqual({
      status: ' ',
      index: null,
      issueKey: null,
      title: 'My Issue',
      directive: null,
    });
  });

  test('status and key, no index', () => {
    const result = parseFilename('[x] XX-123 My Issue.md');
    expect(result?.fields).toEqual({
      status: 'x',
      index: null,
      issueKey: 'XX-123',
      title: 'My Issue',
      directive: null,
    });
  });

  test('literal space status', () => {
    const result = parseFilename('[ ] YY-232 My Epic.md');
    expect(result?.fields.status).toBe(' ');
    expect(result?.fields.issueKey).toBe('YY-232');
  });

  test('dirname (no extension)', () => {
    const result = parseFilename('[ ] YY-323 Another Epic');
    expect(result?.fields).toEqual({
      status: ' ',
      index: null,
      issueKey: 'YY-323',
      title: 'Another Epic',
      directive: null,
    });
    expect(result?.ext).toBe('');
  });

  test('directive only (no key)', () => {
    const result = parseFilename('[ ] Big Thing >> EPIC.md');
    expect(result?.fields).toEqual({
      status: ' ',
      index: null,
      issueKey: null,
      title: 'Big Thing',
      directive: 'EPIC',
    });
  });

  test('GitHub-style #NNN key', () => {
    const result = parseFilename('[ ] #42 Do thing.md');
    expect(result?.fields.issueKey).toBe('#42');
    expect(result?.fields.title).toBe('Do thing');
  });

  test('preserves unknown status char verbatim', () => {
    const result = parseFilename('[*] YY-232 My Epic.md');
    expect(result?.fields.status).toBe('*');
  });

  test('returns null when title is missing', () => {
    expect(parseFilename('[x] XX-123 .md')).toBeNull();
    expect(parseFilename('.md')).toBeNull();
    expect(parseFilename('')).toBeNull();
  });

  test('does not eat title starting with key-like prefix that lacks a trailing space', () => {
    // `XX-123Foo` should be title, not key + title
    const result = parseFilename('XX-123Foo.md');
    expect(result?.fields.issueKey).toBeNull();
    expect(result?.fields.title).toBe('XX-123Foo');
  });
});

describe('serializeFilename', () => {
  test('canonical full form', () => {
    expect(
      serializeFilename({
        status: 'x',
        index: '1',
        issueKey: 'XX-123',
        title: 'My Issue',
        directive: 'EPIC',
      }),
    ).toBe('[x] 1. XX-123 My Issue >> EPIC.md');
  });

  test('title-only emits explicit `[ ]`', () => {
    expect(
      serializeFilename({
        status: ' ',
        index: null,
        issueKey: null,
        title: 'My Issue',
        directive: null,
      }),
    ).toBe('[ ] My Issue.md');
  });

  test('dirname (no extension)', () => {
    expect(
      serializeFilename(
        {
          status: ' ',
          index: null,
          issueKey: 'YY-323',
          title: 'Another Epic',
          directive: null,
        },
        '',
      ),
    ).toBe('[ ] YY-323 Another Epic');
  });
});

describe('round-trip', () => {
  const canonicals = [
    '[x] XX-123 My Issue.md',
    '[ ] YY-232 My Epic.md',
    '[ ] 0. ZZ-222 An Issue in Another Epic.md',
    '[ ] 1. ZZ-224 An Issue in Another Epic.md',
    '[x] 1. XX-123 My Issue >> EPIC.md',
    '[ ] Big Thing >> EPIC.md',
    '[ ] #42 Do thing.md',
  ];

  for (const name of canonicals) {
    test(`identity: ${name}`, () => {
      expect(isCanonicalFilename(name)).toBe(true);
      const parsed = parseFilename(name);
      expect(parsed).not.toBeNull();
      expect(serializeFilename(parsed!.fields, parsed!.ext)).toBe(name);
    });
  }

  test('non-canonical input parses and serializes to canonical form', () => {
    // Missing brackets — gets `[ ]` on serialize.
    const parsed = parseFilename('My Issue.md');
    expect(serializeFilename(parsed!.fields, parsed!.ext)).toBe('[ ] My Issue.md');
  });
});
