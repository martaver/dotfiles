import type { Frontmatter } from '../model/types.ts';
import type { FieldDecision } from './reconcile.ts';

/** Match any git-style conflict marker at the start of a line. */
const CONFLICT_MARKER_RE = /^(<{7}|={7}|>{7}) /m;

/**
 * True iff `text` already contains git-style merge conflict markers. lint
 * refuses to touch such files so the user can resolve them first.
 */
export function hasConflictMarkers(text: string): boolean {
  return CONFLICT_MARKER_RE.test(text);
}

export type ConflictBlock = {
  /** Label for the "ours" side of the marker (e.g. `filename`). */
  oursLabel: string;
  /** Text content for the "ours" side. */
  oursText: string;
  /** Label for the "theirs" side. */
  theirsLabel: string;
  /** Text content for the "theirs" side. */
  theirsText: string;
};

/** Render `<<<<<<< … ======= … >>>>>>> …` block as a string. */
export function renderConflictBlock(block: ConflictBlock): string {
  return [
    `<<<<<<< ${block.oursLabel}`,
    block.oursText,
    `=======`,
    block.theirsText,
    `>>>>>>> ${block.theirsLabel}`,
  ].join('\n');
}

/**
 * Turn a frontmatter object into a conflict-marker block for a single key.
 * Returns the new frontmatter rendered as a string (NOT wrapped in `<!--`),
 * with the conflicting key replaced by a `<<<<<<<` / `=======` / `>>>>>>>` block.
 */
export function frontmatterWithConflict(
  fm: Frontmatter,
  conflictKey: string,
  conflict: Extract<FieldDecision, { kind: 'conflict' }>,
  options: { fmKey: string },
): { lines: string[] } {
  // Render the non-conflicting keys in canonical order, then inject the
  // conflict block in place of the conflicting key.
  const knownOrder = ['issue-key', 'status', 'provider', 'issue-type', 'priority'] as const;
  const out: string[] = [];

  const conflictMirrors = Object.entries(conflict.mirrors).filter(
    ([, v]) => v !== null && v !== '',
  );
  // Pair up the first two mirrors as ours/theirs. Most fields have two mirrors
  // (filename vs frontmatter, filename vs h1). If somehow >2, take the first
  // two and the rest are silently dropped (lint will re-detect after resolve).
  const [ours, theirs] = conflictMirrors;

  const renderConflict = (): string[] => {
    if (!ours || !theirs) return [];
    return [
      `<<<<<<< ${ours[0]}`,
      `${options.fmKey} = ${ours[1]}`,
      `=======`,
      `${options.fmKey} = ${theirs[1]}`,
      `>>>>>>> ${theirs[0]}`,
    ];
  };

  const seen = new Set<string>();
  for (const k of knownOrder) {
    if (k === conflictKey) {
      out.push(...renderConflict());
      seen.add(k);
      continue;
    }
    const v = fm[k];
    if (v !== undefined) {
      out.push(`${k} = ${v}`);
      seen.add(k);
    }
  }
  for (const [k, v] of Object.entries(fm)) {
    if (seen.has(k) || k === conflictKey) continue;
    if (v !== undefined) out.push(`${k} = ${v}`);
  }
  // If the conflict key isn't a known key, append it at the end.
  if (!seen.has(conflictKey)) out.push(...renderConflict());

  return { lines: out };
}
