import type { Fields } from './types.ts';
import { DEFAULT_ISSUE_KEY_PATTERN } from './filename.ts';

/**
 * Match a markdown task list line: any indent, `- [<status>] <rest>`.
 * Group 1 = leading whitespace; 2 = single-char status; 3 = remainder.
 */
const TASK_LINE_RE = /^(\s*)- \[(.)\] (.*)$/;

export type ParsedInlineLine = {
  /** Field values pulled from the line. */
  fields: Fields;
  /** Number of leading spaces (== indent depth in spaces). */
  indent: number;
  /** True if the title was wrapped in a `[text](url)` markdown link. */
  isLink: boolean;
  /** Link target when `isLink` is true. */
  linkHref: string | null;
};

/**
 * Parse a single line into an inline Item's `Fields` plus its indent. Returns
 * null for any line that is not a markdown task line.
 */
export function parseInlineLine(
  line: string,
  opts: { issueKeyPattern?: RegExp } = {},
): ParsedInlineLine | null {
  const m = line.match(TASK_LINE_RE);
  if (!m) return null;

  const indent = (m[1] ?? '').length;
  const status = m[2] ?? ' ';
  let rest = m[3] ?? '';

  // Index prefix
  let index: string | null = null;
  const indexMatch = rest.match(/^(\S)\. /);
  if (indexMatch) {
    index = indexMatch[1] ?? null;
    rest = rest.slice(indexMatch[0].length);
  }

  // Cross-reference link form: `[title](href)`
  let isLink = false;
  let linkHref: string | null = null;
  let issueKey: string | null = null;
  let title: string;
  let directive: string | null = null;

  const linkMatch = rest.match(/^\[([^\]]+)\]\(([^)]+)\)\s*$/);
  if (linkMatch) {
    isLink = true;
    linkHref = linkMatch[2] ?? null;
    // Parse the link text the same way (key + title).
    const linkText = linkMatch[1] ?? '';
    const keyPattern = opts.issueKeyPattern ?? DEFAULT_ISSUE_KEY_PATTERN;
    const keyMatch = linkText.match(keyPattern);
    if (keyMatch) {
      issueKey = keyMatch[0];
      title = linkText.slice(keyMatch[0].length).replace(/^ /, '');
    } else {
      title = linkText;
    }
  } else {
    // Issue key prefix
    const keyPattern = opts.issueKeyPattern ?? DEFAULT_ISSUE_KEY_PATTERN;
    const keyMatch = rest.match(keyPattern);
    if (keyMatch) {
      issueKey = keyMatch[0];
      rest = rest.slice(keyMatch[0].length).replace(/^ /, '');
    }

    // Directive suffix
    const directiveMatch = rest.match(/^(.*?) >> (\S+)$/);
    if (directiveMatch) {
      title = directiveMatch[1] ?? '';
      directive = directiveMatch[2] ?? null;
    } else {
      title = rest;
    }
  }

  if (!title) return null;

  return {
    fields: { status, index, issueKey, title, directive },
    indent,
    isLink,
    linkHref,
  };
}

/**
 * Serialize an inline item back to a markdown task line. `indent` is the number
 * of leading spaces.
 */
export function serializeInlineLine(
  fields: Fields,
  opts: { indent?: number; isLink?: boolean; linkHref?: string | null } = {},
): string {
  const pad = ' '.repeat(opts.indent ?? 0);
  const parts: string[] = [];
  if (fields.index !== null) parts.push(`${fields.index}.`);

  if (opts.isLink && opts.linkHref) {
    const inner: string[] = [];
    if (fields.issueKey !== null) inner.push(fields.issueKey);
    inner.push(fields.title);
    parts.push(`[${inner.join(' ')}](${opts.linkHref})`);
    return `${pad}- [${fields.status}] ${parts.join(' ')}`;
  }

  if (fields.issueKey !== null) parts.push(fields.issueKey);
  parts.push(fields.title);
  let main = parts.join(' ');
  if (fields.directive !== null) main += ` >> ${fields.directive}`;
  return `${pad}- [${fields.status}] ${main}`;
}
