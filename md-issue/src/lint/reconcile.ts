import type { Fields, FileBody } from '../model/types.ts';

export type Mirror = 'filename' | 'frontmatter' | 'h1';

/** Status mapping derived from `config.status`. Filename char `' '` is reserved. */
export type StatusMap = {
  charToName: Map<string, string>;
  nameToChar: Map<string, string>;
};

export function buildStatusMap(statusTable: Record<string, string> | undefined): StatusMap {
  const charToName = new Map<string, string>();
  const nameToChar = new Map<string, string>();
  for (const [char, name] of Object.entries(statusTable ?? {})) {
    if (char === ' ') continue; // reserved
    charToName.set(char, name);
    nameToChar.set(name, char);
  }
  return { charToName, nameToChar };
}

/**
 * Pull the per-mirror values out of a File-form Item's parsed state. Status is
 * normalised to its mapped name; the literal-space char becomes `null` (defer
 * to provider).
 */
export function extractMirrors(
  fields: Fields,
  body: FileBody,
  statusMap: StatusMap,
): ItemMirrors {
  return {
    status: {
      filename: fields.status === ' ' ? null : statusMap.charToName.get(fields.status) ?? null,
      frontmatter: body.frontmatter['status'] ?? null,
    },
    issueKey: {
      filename: fields.issueKey,
      frontmatter: body.frontmatter['issue-key'] ?? null,
    },
    title: {
      filename: fields.title,
      h1: body.h1,
    },
  };
}

export type ItemMirrors = {
  status: { filename: string | null; frontmatter: string | null };
  issueKey: { filename: string | null; frontmatter: string | null };
  title: { filename: string; h1: string | null };
};

export type FieldDecision =
  | { kind: 'noop'; value: string | null }
  | { kind: 'propagate'; value: string | null }
  | { kind: 'conflict'; mirrors: Record<string, string | null> };

export type ItemPlan = {
  status: FieldDecision;
  issueKey: FieldDecision;
  title: FieldDecision;
};

/**
 * Decide what to do for a single field given its baseline and current values
 * across mirror locations. Generic over the set of mirrors.
 */
export function reconcileField(
  baseline: Record<string, string | null> | null,
  current: Record<string, string | null>,
): FieldDecision {
  const presentMirrors = Object.entries(current).filter(([, v]) => v !== null && v !== '');
  if (baseline === null) {
    if (presentMirrors.length === 0) return { kind: 'noop', value: null };
    const values = new Set(presentMirrors.map(([, v]) => v));
    if (values.size === 1) {
      const first = presentMirrors[0]?.[1] ?? null;
      return { kind: 'propagate', value: first };
    }
    return { kind: 'conflict', mirrors: current };
  }

  const changed = Object.entries(current).filter(([m, v]) => (baseline[m] ?? null) !== v);
  if (changed.length === 0) return { kind: 'noop', value: null };

  const changedValues = new Set(changed.map(([, v]) => v));
  if (changedValues.size === 1) {
    return { kind: 'propagate', value: changed[0]?.[1] ?? null };
  }
  return { kind: 'conflict', mirrors: current };
}

/**
 * Reconcile every tracked field on a File-form item. `baseline` is null for
 * items with no index version (new files).
 */
export function reconcileItem(baseline: ItemMirrors | null, current: ItemMirrors): ItemPlan {
  return {
    status: reconcileField(baseline?.status ?? null, current.status),
    issueKey: reconcileField(baseline?.issueKey ?? null, current.issueKey),
    title: reconcileField(baseline?.title ?? null, current.title),
  };
}
