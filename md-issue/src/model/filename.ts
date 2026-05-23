import type { Fields } from './types.ts';

/**
 * Default Issue-Key pattern (Jira `XX-123` or GitHub `#123`). Provider-specific
 * patterns can be supplied via `opts.issueKeyPattern` once the path → provider
 * mapping has been resolved.
 */
export const DEFAULT_ISSUE_KEY_PATTERN = /^([A-Z][A-Z0-9_]*-\d+|#\d+)(?= |$)/;

export type ParseFilenameOptions = {
  /** Anchored regex matching the issue key at the start of the remaining string. */
  issueKeyPattern?: RegExp;
};

export type ParseResult = {
  fields: Fields;
  /** Original extension (e.g. `.md`) or empty string for dirnames. */
  ext: string;
};

/**
 * Parse a filename or dirname into `Fields`. Strips the `.md` extension if present.
 * Returns null for inputs that have no parseable title.
 */
export function parseFilename(
  name: string,
  opts: ParseFilenameOptions = {},
): ParseResult | null {
  let s = name;
  let ext = '';
  if (s.endsWith('.md')) {
    ext = '.md';
    s = s.slice(0, -3);
  }

  let status = ' ';
  const statusMatch = s.match(/^\[(.)\] /);
  if (statusMatch) {
    status = statusMatch[1] ?? ' ';
    s = s.slice(statusMatch[0].length);
  }

  let index: string | null = null;
  const indexMatch = s.match(/^(\S)\. /);
  if (indexMatch) {
    index = indexMatch[1] ?? null;
    s = s.slice(indexMatch[0].length);
  }

  let issueKey: string | null = null;
  const keyPattern = opts.issueKeyPattern ?? DEFAULT_ISSUE_KEY_PATTERN;
  const keyMatch = s.match(keyPattern);
  if (keyMatch) {
    issueKey = keyMatch[0];
    s = s.slice(keyMatch[0].length).replace(/^ /, '');
  }

  let directive: string | null = null;
  const directiveMatch = s.match(/^(.*?) >> (\S+)$/);
  let title: string;
  if (directiveMatch) {
    title = directiveMatch[1] ?? '';
    directive = directiveMatch[2] ?? null;
  } else {
    title = s;
  }

  if (!title) return null;

  return {
    fields: { status, index, issueKey, title, directive },
    ext,
  };
}

/**
 * Serialize `Fields` back to canonical filename form. Always emits `[<status>]`.
 * Pass `ext: ''` for dirnames.
 */
export function serializeFilename(fields: Fields, ext: string = '.md'): string {
  const parts: string[] = [];
  parts.push(`[${fields.status}]`);
  if (fields.index !== null) parts.push(`${fields.index}.`);
  if (fields.issueKey !== null) parts.push(fields.issueKey);
  let main = parts.join(' ');
  main += ` ${fields.title}`;
  if (fields.directive !== null) main += ` >> ${fields.directive}`;
  return main + ext;
}

/**
 * True iff the given filename round-trips exactly through parse → serialize
 * with the supplied options.
 */
export function isCanonicalFilename(name: string, opts?: ParseFilenameOptions): boolean {
  const parsed = parseFilename(name, opts);
  if (!parsed) return false;
  return serializeFilename(parsed.fields, parsed.ext) === name;
}
