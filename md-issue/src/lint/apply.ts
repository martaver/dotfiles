import { dirname, join, relative } from 'node:path';
import { addPaths } from '../git/operations.ts';
import {
  canonicalFileItemPath,
  renameItemFile,
  serializeFileBody,
} from '../model/writers.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import type { Fields, FileBody, Form } from '../model/types.ts';
import type { FieldDecision, ItemPlan, StatusMap } from './reconcile.ts';
import { frontmatterWithConflict, renderConflictBlock } from './conflict.ts';

export type AppliedItem = {
  /** Workspace-relative path the file lives at after apply. */
  newPath: string;
  /** Workspace-relative path the file lived at before apply. Null for new files. */
  baselinePath: string | null;
  /** Paths to stage with `git add`. Includes deletions of old paths. */
  stagePaths: string[];
  /** Field-level conflict descriptions; apply injects markers into the body. */
  conflicts: ItemPlan;
  /** True if anything was written or renamed. */
  touched: boolean;
  /** Reason the item was skipped entirely (e.g. pre-existing conflict markers). */
  skippedReason?: 'has-conflict-markers';
};

export type ApplyContext = {
  /** Absolute path to the workspace root. */
  workspaceRoot: string;
  /** Repo root (for `git add` resolution). May equal workspaceRoot or be a parent. */
  repoRoot: string;
  statusMap: StatusMap;
};

/**
 * Apply a reconciled plan to a single File- or Dir-form item. Writes the
 * canonical body back to disk, renames the item (file or directory) if the
 * canonical name differs, and returns the list of repo-relative paths to stage.
 *
 * For Dir items: `currentDiskPath` points at the directory; the body is written
 * to `<dir>/index.md`. Children inside the directory move with it on rename.
 */
export async function applyPlanToItem(
  ctx: ApplyContext,
  args: {
    form: Form;
    currentDiskPath: string;
    baselinePath: string | null;
    fields: Fields;
    body: FileBody;
    plan: ItemPlan;
  },
): Promise<AppliedItem> {
  const { fields, body, plan } = args;
  const conflicts: ItemPlan = {
    status: { kind: 'noop', value: null },
    issueKey: { kind: 'noop', value: null },
    title: { kind: 'noop', value: null },
  };
  let touched = false;

  // Resolve each field. `propagate` updates the value; `conflict` records and
  // skips; `noop` keeps current.
  const newFields: Fields = { ...fields };
  const newBody: FileBody = { ...body, frontmatter: { ...body.frontmatter } };

  if (plan.status.kind === 'propagate') {
    const name = plan.status.value;
    const char = name === null ? ' ' : ctx.statusMap.nameToChar.get(name) ?? ' ';
    if (newFields.status !== char) {
      newFields.status = char;
      touched = true;
    }
    if (name === null) {
      if (newBody.frontmatter['status'] !== undefined) {
        delete newBody.frontmatter['status'];
        touched = true;
      }
    } else if (newBody.frontmatter['status'] !== name) {
      newBody.frontmatter['status'] = name;
      touched = true;
    }
  } else if (plan.status.kind === 'conflict') {
    conflicts.status = plan.status;
  }

  if (plan.issueKey.kind === 'propagate') {
    const key = plan.issueKey.value;
    if (newFields.issueKey !== key) {
      newFields.issueKey = key;
      touched = true;
    }
    if (key === null) {
      if (newBody.frontmatter['issue-key'] !== undefined) {
        delete newBody.frontmatter['issue-key'];
        touched = true;
      }
    } else if (newBody.frontmatter['issue-key'] !== key) {
      newBody.frontmatter['issue-key'] = key;
      touched = true;
    }
  } else if (plan.issueKey.kind === 'conflict') {
    conflicts.issueKey = plan.issueKey;
  }

  if (plan.title.kind === 'propagate' && plan.title.value !== null) {
    if (newFields.title !== plan.title.value) {
      newFields.title = plan.title.value;
      touched = true;
    }
    if (newBody.h1 !== plan.title.value) {
      newBody.h1 = plan.title.value;
      touched = true;
    }
  } else if (plan.title.kind === 'conflict') {
    conflicts.title = plan.title;
  }

  // Inject conflict markers for non-title fields into frontmatter, and for
  // title into the H1 location. lint will refuse to re-process this file
  // until the user resolves them.
  const conflictRender = collectFieldConflicts(plan);
  let conflictFmLines: string[] | null = null;
  if (conflictRender.titleConflict) {
    touched = true;
    const c = conflictRender.titleConflict;
    const oursText = c.mirrors['filename'] !== undefined ? `# ${c.mirrors['filename']}` : '# ';
    const theirsText = c.mirrors['h1'] !== undefined ? `# ${c.mirrors['h1']}` : '# ';
    newBody.h1 = null;
    const block = renderConflictBlock({
      oursLabel: 'filename',
      oursText,
      theirsLabel: 'h1',
      theirsText,
    });
    newBody.description = newBody.description ? `${block}\n\n${newBody.description}` : block;
  }
  if (conflictRender.fmConflicts.length > 0) {
    touched = true;
    let lines = Object.entries(newBody.frontmatter)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k} = ${v}`);
    for (const { key, fmKey, decision } of conflictRender.fmConflicts) {
      const reordered = frontmatterWithConflict(newBody.frontmatter, key, decision, { fmKey });
      lines = reordered.lines;
    }
    conflictFmLines = lines;
  }

  // Compute canonical disk path from the (possibly updated) fields. Dir items
  // have no extension; their body file lives at `<dir>/index.md`.
  const containerDir = dirname(args.currentDiskPath);
  const ext = args.form === 'dir' ? '' : '.md';
  const canonicalPath = canonicalFileItemPath(containerDir, newFields, ext);
  let finalPath = args.currentDiskPath;

  if (canonicalPath !== args.currentDiskPath) {
    await renameItemFile(args.currentDiskPath, canonicalPath);
    finalPath = canonicalPath;
    touched = true;
  }

  const bodyPath = args.form === 'dir' ? join(finalPath, 'index.md') : finalPath;

  // Write the canonical body so frontmatter / H1 reflect the reconciled fields.
  if (touched) {
    if (args.form === 'dir') await mkdir(finalPath, { recursive: true });
    if (conflictFmLines !== null) {
      const wrapped = `<!--\n${conflictFmLines.join('\n')}\n-->`;
      const sections: string[] = [wrapped];
      if (newBody.h1 !== null) sections.push(`# ${newBody.h1}`);
      if (newBody.description) sections.push(newBody.description.replace(/\n+$/, ''));
      await writeFile(bodyPath, `${sections.join('\n\n')}\n`);
    } else {
      await writeFile(bodyPath, serializeFileBody(newBody));
    }
  }

  // Staging targets:
  //   1. The final item path — for files this is the file itself; for dirs
  //      this is the directory, and `git add -A --` recurses into it.
  //   2. The baseline path, if it was previously tracked and differs from final
  //      (stages the deletion of the old tracked path / children).
  const toStage = new Set<string>();
  toStage.add(relative(ctx.repoRoot, finalPath));
  if (args.baselinePath !== null) {
    const baselineAbs = join(ctx.workspaceRoot, args.baselinePath);
    if (baselineAbs !== finalPath) toStage.add(args.baselinePath);
  }

  return {
    newPath: relative(ctx.workspaceRoot, finalPath),
    baselinePath: args.baselinePath,
    stagePaths: [...toStage],
    conflicts,
    touched,
  };
}


/**
 * Stage every path in the supplied list with a single `git add`.
 */
export async function stagePaths(ctx: ApplyContext, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const unique = [...new Set(paths)];
  await addPaths(ctx.repoRoot, unique);
}

function collectFieldConflicts(plan: ItemPlan): {
  fmConflicts: Array<{ key: string; fmKey: string; decision: Extract<FieldDecision, { kind: 'conflict' }> }>;
  titleConflict: Extract<FieldDecision, { kind: 'conflict' }> | null;
} {
  const fmConflicts: Array<{ key: string; fmKey: string; decision: Extract<FieldDecision, { kind: 'conflict' }> }> = [];
  let titleConflict: Extract<FieldDecision, { kind: 'conflict' }> | null = null;
  if (plan.status.kind === 'conflict') {
    fmConflicts.push({ key: 'status', fmKey: 'status', decision: plan.status });
  }
  if (plan.issueKey.kind === 'conflict') {
    fmConflicts.push({ key: 'issueKey', fmKey: 'issue-key', decision: plan.issueKey });
  }
  if (plan.title.kind === 'conflict') {
    titleConflict = plan.title;
  }
  return { fmConflicts, titleConflict };
}
