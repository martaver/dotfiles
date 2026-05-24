import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { parseInlineLine, serializeInlineLine } from '../model/inline.ts';
import type { Fields, Item } from '../model/types.ts';
import type { ApplyContext } from './apply.ts';

export type PropagateResult = {
  /** Paths (repo-relative) that had inline references rewritten. */
  stagePaths: string[];
  /** Count of inline lines updated, for the lint summary. */
  updates: number;
};

/**
 * For every inline item that references a File or Dir item by IssueKey,
 * rewrite the inline line to mirror the target's current `status`, `title`,
 * and (for link form) `href`. The `index` field on the inline line is
 * preserved — it's a parent-file ordering hint, not the target's property.
 *
 * Directives are NOT propagated: inline references mirror the synced state,
 * not pending intent on the target.
 */
export async function propagateCrossFile(
  ctx: ApplyContext,
  items: Item[],
): Promise<PropagateResult> {
  const all = walkAll(items);

  // Build a lookup of canonical File/Dir items by IssueKey.
  const byKey = new Map<string, Item>();
  for (const it of all) {
    if ((it.form === 'file' || it.form === 'dir') && it.fields.issueKey) {
      byKey.set(it.fields.issueKey, it);
    }
  }

  // Group inline items needing updates by their parent file path.
  const inlineByParent = new Map<string, Item[]>();
  for (const it of all) {
    if (it.form !== 'inline' || !it.inline) continue;
    if (!it.fields.issueKey) continue;
    if (!byKey.has(it.fields.issueKey)) continue;
    const list = inlineByParent.get(it.path) ?? [];
    list.push(it);
    inlineByParent.set(it.path, list);
  }

  const stagePaths = new Set<string>();
  let updates = 0;

  for (const [parentRel, inlineItems] of inlineByParent) {
    const parentAbs = join(ctx.workspaceRoot, parentRel);
    const text = await readFile(parentAbs, 'utf8');
    const lines = text.split(/\r?\n/);
    let modified = false;

    for (const inline of inlineItems) {
      const target = byKey.get(inline.fields.issueKey ?? '');
      if (!target || !inline.inline) continue;
      const lineIdx = inline.inline.line - 1;
      const orig = lines[lineIdx];
      if (orig === undefined) continue;
      const parsed = parseInlineLine(orig);
      if (!parsed) continue;

      // Desired = target's fields, preserving the inline's own ordering index
      // and link form. Directives don't cross over.
      const desired: Fields = {
        status: target.fields.status,
        index: inline.fields.index,
        issueKey: target.fields.issueKey,
        title: target.fields.title,
        directive: null,
      };

      const isLink = parsed.isLink;
      let linkHref = parsed.linkHref;
      if (isLink) {
        const parentDir = dirname(parentRel);
        const rel = relative(parentDir, target.path);
        linkHref = `./${encodeURI(rel)}`;
      }

      const opts: Parameters<typeof serializeInlineLine>[1] = { indent: parsed.indent };
      if (isLink) opts.isLink = true;
      if (linkHref !== null) opts.linkHref = linkHref;
      const newLine = serializeInlineLine(desired, opts);
      if (newLine !== orig) {
        lines[lineIdx] = newLine;
        modified = true;
        updates += 1;
      }
    }

    if (modified) {
      await writeFile(parentAbs, lines.join('\n'));
      stagePaths.add(relative(ctx.repoRoot, parentAbs));
    }
  }

  return { stagePaths: [...stagePaths], updates };
}

function walkAll(items: Item[]): Item[] {
  const out: Item[] = [];
  const walk = (xs: Item[]): void => {
    for (const x of xs) {
      out.push(x);
      walk(x.children);
    }
  };
  walk(items);
  return out;
}
