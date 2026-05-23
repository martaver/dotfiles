import type { Frontmatter } from './types.ts';

/**
 * Match an HTML-comment frontmatter block at the very top of a file body.
 * Captures the inner content (between `<!--` and `-->`).
 */
const FRONTMATTER_RE = /^<!--\r?\n([\s\S]*?)\r?\n-->\r?\n?/;

const KEY_VALUE_RE = /^([a-z][a-z0-9-]*)\s*=\s*(.*)$/;

export type ExtractResult = {
  /** Inner text of the HTML comment, without the wrappers. Null if no block found. */
  raw: string | null;
  /** File body with the frontmatter block (and its trailing newline) stripped. */
  rest: string;
};

/**
 * Pull the leading `<!-- ... -->` frontmatter block off `text`. Returns the raw
 * inner content (null if absent) and the remainder of the file.
 */
export function extractFrontmatter(text: string): ExtractResult {
  const match = text.match(FRONTMATTER_RE);
  if (!match) return { raw: null, rest: text };
  return { raw: match[1] ?? '', rest: text.slice(match[0].length) };
}

/**
 * Parse the inner content of a frontmatter block into a Frontmatter object.
 * Format: one `key = value` per line. Lines that don't match are ignored.
 * Values may be wrapped in single or double quotes (which are stripped).
 */
export function parseFrontmatter(raw: string): Frontmatter {
  const result: Frontmatter = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(KEY_VALUE_RE);
    if (!m) continue;
    const key = m[1];
    let value = m[2] ?? '';
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key !== undefined) result[key] = value;
  }
  return result;
}

/**
 * Serialize a Frontmatter object back to its HTML-comment representation. Known
 * keys come first (in canonical order), then unknown keys in insertion order.
 * Returns the empty string if `fm` has no defined entries.
 */
export function serializeFrontmatter(fm: Frontmatter): string {
  const knownOrder = ['issue-key', 'status', 'provider', 'issue-type', 'priority'] as const;
  const lines: string[] = [];

  for (const k of knownOrder) {
    const v = fm[k];
    if (v !== undefined) lines.push(`${k} = ${v}`);
  }
  for (const [k, v] of Object.entries(fm)) {
    if ((knownOrder as readonly string[]).includes(k)) continue;
    if (v !== undefined) lines.push(`${k} = ${v}`);
  }

  if (lines.length === 0) return '';
  return `<!--\n${lines.join('\n')}\n-->`;
}
