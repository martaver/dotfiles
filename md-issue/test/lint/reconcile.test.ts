import { describe, expect, test } from 'bun:test';
import {
  buildStatusMap,
  extractMirrors,
  reconcileField,
  reconcileItem,
} from '../../src/lint/reconcile.ts';
import type { Fields, FileBody } from '../../src/model/types.ts';

function mkFields(overrides: Partial<Fields> = {}): Fields {
  return {
    status: ' ',
    index: null,
    issueKey: null,
    title: 'Untitled',
    directive: null,
    ...overrides,
  };
}

function mkBody(overrides: Partial<FileBody> = {}): FileBody {
  return {
    rawFrontmatter: null,
    frontmatter: {},
    h1: null,
    description: '',
    descriptionStartLine: 1,
    ...overrides,
  };
}

describe('reconcileField', () => {
  test('no changes → noop', () => {
    const baseline = { a: 'X', b: 'X' };
    const current = { a: 'X', b: 'X' };
    expect(reconcileField(baseline, current)).toEqual({ kind: 'noop', value: null });
  });

  test('one mirror changed → propagate', () => {
    const baseline = { a: 'X', b: 'X' };
    const current = { a: 'Y', b: 'X' };
    expect(reconcileField(baseline, current)).toEqual({ kind: 'propagate', value: 'Y' });
  });

  test('multiple mirrors changed, same value → propagate', () => {
    const baseline = { a: 'X', b: 'X' };
    const current = { a: 'Y', b: 'Y' };
    expect(reconcileField(baseline, current)).toEqual({ kind: 'propagate', value: 'Y' });
  });

  test('multiple mirrors changed, different values → conflict', () => {
    const baseline = { a: 'X', b: 'X' };
    const current = { a: 'Y', b: 'Z' };
    expect(reconcileField(baseline, current)).toEqual({
      kind: 'conflict',
      mirrors: { a: 'Y', b: 'Z' },
    });
  });

  test('new item, all mirrors agree → propagate', () => {
    const current = { a: 'X', b: 'X' };
    expect(reconcileField(null, current)).toEqual({ kind: 'propagate', value: 'X' });
  });

  test('new item, one mirror absent → propagate the present value', () => {
    const current = { a: 'X', b: null };
    expect(reconcileField(null, current)).toEqual({ kind: 'propagate', value: 'X' });
  });

  test('new item, mirrors disagree → conflict', () => {
    const current = { a: 'X', b: 'Y' };
    expect(reconcileField(null, current)).toEqual({
      kind: 'conflict',
      mirrors: { a: 'X', b: 'Y' },
    });
  });

  test('new item, all mirrors empty → noop', () => {
    const current = { a: null, b: null };
    expect(reconcileField(null, current)).toEqual({ kind: 'noop', value: null });
  });
});

describe('buildStatusMap', () => {
  test('reserves the literal space char', () => {
    const m = buildStatusMap({ ' ': '<default>', x: 'Done', _: 'Backlog' });
    expect(m.charToName.has(' ')).toBe(false);
    expect(m.charToName.get('x')).toBe('Done');
    expect(m.nameToChar.get('Backlog')).toBe('_');
  });

  test('handles missing input', () => {
    const m = buildStatusMap(undefined);
    expect(m.charToName.size).toBe(0);
  });
});

describe('extractMirrors', () => {
  const statusMap = buildStatusMap({ x: 'Done', _: 'Backlog' });

  test('status maps filename char to provider name', () => {
    const fields = mkFields({ status: 'x', issueKey: 'XX-1', title: 'Foo' });
    const body = mkBody({ frontmatter: { status: 'Done', 'issue-key': 'XX-1' }, h1: 'Foo' });
    const m = extractMirrors(fields, body, statusMap);
    expect(m.status).toEqual({ filename: 'Done', frontmatter: 'Done' });
    expect(m.issueKey).toEqual({ filename: 'XX-1', frontmatter: 'XX-1' });
    expect(m.title).toEqual({ filename: 'Foo', h1: 'Foo' });
  });

  test('literal-space status becomes null', () => {
    const fields = mkFields({ status: ' ' });
    const m = extractMirrors(fields, mkBody(), statusMap);
    expect(m.status.filename).toBeNull();
  });

  test('unmapped char becomes null (will surface as conflict if frontmatter has a value)', () => {
    const fields = mkFields({ status: '*' });
    const m = extractMirrors(fields, mkBody(), statusMap);
    expect(m.status.filename).toBeNull();
  });
});

describe('reconcileItem — end-to-end on a single File item', () => {
  const statusMap = buildStatusMap({ x: 'Done', _: 'Backlog' });

  test('status edited in filename propagates to frontmatter', () => {
    const baseline = extractMirrors(
      mkFields({ status: '_', issueKey: 'XX-1', title: 'Foo' }),
      mkBody({ frontmatter: { status: 'Backlog', 'issue-key': 'XX-1' }, h1: 'Foo' }),
      statusMap,
    );
    const current = extractMirrors(
      mkFields({ status: 'x', issueKey: 'XX-1', title: 'Foo' }),
      mkBody({ frontmatter: { status: 'Backlog', 'issue-key': 'XX-1' }, h1: 'Foo' }),
      statusMap,
    );
    const plan = reconcileItem(baseline, current);
    expect(plan.status).toEqual({ kind: 'propagate', value: 'Done' });
    expect(plan.issueKey).toEqual({ kind: 'noop', value: null });
    expect(plan.title).toEqual({ kind: 'noop', value: null });
  });

  test('title edited in H1 propagates to filename', () => {
    const baseline = extractMirrors(
      mkFields({ status: 'x', issueKey: 'XX-1', title: 'Old' }),
      mkBody({ frontmatter: { status: 'Done', 'issue-key': 'XX-1' }, h1: 'Old' }),
      statusMap,
    );
    const current = extractMirrors(
      mkFields({ status: 'x', issueKey: 'XX-1', title: 'Old' }),
      mkBody({ frontmatter: { status: 'Done', 'issue-key': 'XX-1' }, h1: 'New' }),
      statusMap,
    );
    const plan = reconcileItem(baseline, current);
    expect(plan.title).toEqual({ kind: 'propagate', value: 'New' });
  });

  test('user changes both filename and frontmatter to inconsistent values → conflict', () => {
    const baseline = extractMirrors(
      mkFields({ status: '_', issueKey: 'XX-1', title: 'Foo' }),
      mkBody({ frontmatter: { status: 'Backlog', 'issue-key': 'XX-1' }, h1: 'Foo' }),
      statusMap,
    );
    const current = extractMirrors(
      mkFields({ status: 'x', issueKey: 'XX-1', title: 'Foo' }),
      mkBody({ frontmatter: { status: 'Backlog', 'issue-key': 'XX-1' }, h1: 'Foo' }),
      statusMap,
    );
    // Only filename changed → propagate; not a conflict. Add a frontmatter
    // change that disagrees and now it IS a conflict.
    const conflicting = extractMirrors(
      mkFields({ status: 'x', issueKey: 'XX-1', title: 'Foo' }),
      mkBody({ frontmatter: { status: 'Backlog', 'issue-key': 'XX-1' }, h1: 'Foo' }),
      statusMap,
    );
    conflicting.status.frontmatter = 'In Review';
    const plan = reconcileItem(baseline, conflicting);
    expect(plan.status.kind).toBe('conflict');
    const okPlan = reconcileItem(baseline, current);
    expect(okPlan.status.kind).toBe('propagate');
  });
});
