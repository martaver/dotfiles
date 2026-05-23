import { describe, expect, test } from 'bun:test';
import { parseInlineLine, serializeInlineLine } from '../../src/model/inline.ts';

describe('parseInlineLine', () => {
  test('basic task with status only', () => {
    const r = parseInlineLine('- [ ] Do thing');
    expect(r?.fields.status).toBe(' ');
    expect(r?.fields.title).toBe('Do thing');
    expect(r?.indent).toBe(0);
  });

  test('with issue key', () => {
    const r = parseInlineLine('- [x] FE-123 Do something cool');
    expect(r?.fields.issueKey).toBe('FE-123');
    expect(r?.fields.title).toBe('Do something cool');
    expect(r?.fields.status).toBe('x');
  });

  test('with index, key, title', () => {
    const r = parseInlineLine('- [ ] 1. ZZ-224 First do one thing');
    expect(r?.fields).toEqual({
      status: ' ',
      index: '1',
      issueKey: 'ZZ-224',
      title: 'First do one thing',
      directive: null,
    });
  });

  test('with directive', () => {
    const r = parseInlineLine('- [ ] Do thing >> ISSUE');
    expect(r?.fields.directive).toBe('ISSUE');
    expect(r?.fields.title).toBe('Do thing');
  });

  test('captures indent', () => {
    const r = parseInlineLine('    - [ ] Nested task');
    expect(r?.indent).toBe(4);
    expect(r?.fields.title).toBe('Nested task');
  });

  test('link form: [key title](href)', () => {
    const line = '- [ ] [XX-123 My Issue](./[x]%20XX-123%20My%20Issue.md)';
    const r = parseInlineLine(line);
    expect(r?.isLink).toBe(true);
    expect(r?.linkHref).toBe('./[x]%20XX-123%20My%20Issue.md');
    expect(r?.fields.issueKey).toBe('XX-123');
    expect(r?.fields.title).toBe('My Issue');
  });

  test('returns null for non-task list lines', () => {
    expect(parseInlineLine('- foo')).toBeNull();
    expect(parseInlineLine('  - bare prose item')).toBeNull();
    expect(parseInlineLine('# A heading')).toBeNull();
    expect(parseInlineLine('plain paragraph')).toBeNull();
  });
});

describe('serializeInlineLine', () => {
  test('basic round-trip', () => {
    const fields = {
      status: 'x',
      index: null,
      issueKey: 'FE-123',
      title: 'Do something',
      directive: null,
    };
    expect(serializeInlineLine(fields)).toBe('- [x] FE-123 Do something');
  });

  test('indent applied', () => {
    const fields = {
      status: ' ',
      index: null,
      issueKey: null,
      title: 'Nested',
      directive: null,
    };
    expect(serializeInlineLine(fields, { indent: 4 })).toBe('    - [ ] Nested');
  });

  test('directive included', () => {
    const fields = {
      status: ' ',
      index: null,
      issueKey: null,
      title: 'Promote me',
      directive: 'ISSUE',
    };
    expect(serializeInlineLine(fields)).toBe('- [ ] Promote me >> ISSUE');
  });

  test('link form', () => {
    const fields = {
      status: ' ',
      index: null,
      issueKey: 'XX-123',
      title: 'My Issue',
      directive: null,
    };
    expect(
      serializeInlineLine(fields, {
        isLink: true,
        linkHref: './[x]%20XX-123%20My%20Issue.md',
      }),
    ).toBe('- [ ] [XX-123 My Issue](./[x]%20XX-123%20My%20Issue.md)');
  });
});

describe('round-trip', () => {
  const canonicals = [
    '- [ ] Do thing',
    '- [x] FE-123 Done',
    '- [ ] 1. ZZ-224 First do one thing',
    '- [ ] Do thing >> ISSUE',
    '    - [ ] Nested task',
  ];

  for (const line of canonicals) {
    test(`identity: ${JSON.stringify(line)}`, () => {
      const parsed = parseInlineLine(line);
      expect(parsed).not.toBeNull();
      expect(
        serializeInlineLine(parsed!.fields, { indent: parsed!.indent }),
      ).toBe(line);
    });
  }
});
