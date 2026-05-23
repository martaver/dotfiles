import { dirname, join, relative } from 'node:path';
import { addPaths } from '../git/operations.ts';
import {
  canonicalFileItemPath,
  renameItemFile,
  serializeFileBody,
} from '../model/writers.ts';
import { writeFile } from 'node:fs/promises';
import type { Fields, FileBody } from '../model/types.ts';
import type { ItemPlan, StatusMap } from './reconcile.ts';

export type AppliedItem = {
  /** Workspace-relative path the file lives at after apply. */
  newPath: string;
  /** Workspace-relative path the file lived at before apply. Null for new files. */
  baselinePath: string | null;
  /** Paths to stage with `git add`. Includes deletions of old paths. */
  stagePaths: string[];
  /** Field-level conflict descriptions (apply skips these for now). */
  conflicts: ItemPlan;
  /** True if anything was written or renamed. */
  touched: boolean;
};

export type ApplyContext = {
  /** Absolute path to the workspace root. */
  workspaceRoot: string;
  /** Repo root (for `git add` resolution). May equal workspaceRoot or be a parent. */
  repoRoot: string;
  statusMap: StatusMap;
};

/**
 * Apply a reconciled plan to a single File-form item. Writes the canonical body
 * back to disk, renames if the canonical filename differs, and returns the list
 * of repo-relative paths to stage.
 */
export async function applyPlanToFile(
  ctx: ApplyContext,
  args: {
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

  // Compute canonical disk path from the (possibly updated) fields.
  const containerDir = dirname(args.currentDiskPath);
  const canonicalPath = canonicalFileItemPath(containerDir, newFields);
  let finalPath = args.currentDiskPath;

  if (canonicalPath !== args.currentDiskPath) {
    await renameItemFile(args.currentDiskPath, canonicalPath);
    finalPath = canonicalPath;
    touched = true;
  }

  // Write the canonical body so frontmatter / H1 reflect the reconciled fields.
  if (touched) {
    await writeFile(finalPath, serializeFileBody(newBody));
  }

  // Staging targets:
  //   1. The final disk path (the new state, or unchanged).
  //   2. The baseline path, if it was previously tracked and differs from final
  //      (stages the deletion of the old tracked path).
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
