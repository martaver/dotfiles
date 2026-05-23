import { realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { findRepoRoot, isInConflictState, readIndexFile } from '../git/operations.ts';
import { resolveRenames } from './rename.ts';
import { parseFilename } from '../model/filename.ts';
import { extractFrontmatter, parseFrontmatter } from '../model/frontmatter.ts';
import { loadTree } from '../model/tree.ts';
import type { FileBody, Item } from '../model/types.ts';
import { applyPlanToFile, stagePaths, type AppliedItem, type ApplyContext } from './apply.ts';
import { buildStatusMap, extractMirrors, reconcileItem, type StatusMap } from './reconcile.ts';

export type LintResult = {
  applied: AppliedItem[];
  conflicts: AppliedItem[];
};

export type LintOptions = {
  /** Absolute workspace root (typically the repo containing `.md-issue/`). */
  workspaceRoot: string;
  /**
   * Status table from config.toml `[status]`. Pass the raw object — empty/undefined
   * accepted.
   */
  statusTable?: Record<string, string>;
};

/**
 * The main lint loop. Walks the working tree, reconciles each File item against
 * its index baseline, applies updates, and stages the result.
 */
export async function runLint(opts: LintOptions): Promise<LintResult> {
  const { statusTable } = opts;
  // Resolve symlinks so paths are comparable to what `git rev-parse` returns
  // (macOS realpaths `/tmp` to `/private/tmp`).
  const workspaceRoot = await realpath(opts.workspaceRoot);
  const repoRoot = (await findRepoRoot(workspaceRoot)) ?? workspaceRoot;
  if (await isInConflictState(repoRoot)) {
    throw new Error('Repo has unmerged paths — resolve git conflicts before running lint.');
  }

  const statusMap = buildStatusMap(statusTable);
  const ctx: ApplyContext = { workspaceRoot, repoRoot, statusMap };
  const renames = await resolveRenames(repoRoot);
  const items = await loadTree(workspaceRoot);

  const applied: AppliedItem[] = [];
  const conflicts: AppliedItem[] = [];
  const allStagePaths: string[] = [];

  for (const item of flattenFileItems(items)) {
    const result = await reconcileAndApply(ctx, statusMap, item, renames, workspaceRoot, repoRoot);
    if (!result) continue;
    applied.push(result);
    if (hasConflict(result)) conflicts.push(result);
    allStagePaths.push(...result.stagePaths);
  }

  await stagePaths(ctx, allStagePaths);
  return { applied, conflicts };
}

function flattenFileItems(items: Item[]): Item[] {
  const out: Item[] = [];
  const walk = (xs: Item[]): void => {
    for (const x of xs) {
      if (x.form === 'file' || x.form === 'dir') out.push(x);
      walk(x.children);
    }
  };
  walk(items);
  return out;
}

function hasConflict(item: AppliedItem): boolean {
  return (
    item.conflicts.status.kind === 'conflict' ||
    item.conflicts.issueKey.kind === 'conflict' ||
    item.conflicts.title.kind === 'conflict'
  );
}

async function reconcileAndApply(
  ctx: ApplyContext,
  statusMap: StatusMap,
  item: Item,
  renames: Map<string, string>,
  workspaceRoot: string,
  repoRoot: string,
): Promise<AppliedItem | null> {
  if (!item.body) return null; // dir without index.md — nothing to reconcile yet
  const currentDiskPath = join(workspaceRoot, item.path);
  const relForRepo = relative(repoRoot, currentDiskPath);
  const baselineRel = renames.get(relForRepo) ?? relForRepo;
  const baselineRaw = await readIndexFile(repoRoot, baselineRel);

  const baselineMirrors = baselineRaw === null
    ? null
    : (() => {
        const filenameOnly = baselineRel.split('/').pop() ?? baselineRel;
        const parsed = parseFilename(filenameOnly);
        if (!parsed) return null;
        const { raw, rest } = extractFrontmatter(baselineRaw);
        const fm = raw === null ? {} : parseFrontmatter(raw);
        const h1Match = rest.replace(/^(?:\r?\n)+/, '').match(/^# (.+?)\r?\n/);
        const baselineBody: FileBody = {
          rawFrontmatter: raw,
          frontmatter: fm,
          h1: h1Match ? (h1Match[1] ?? '').trim() : null,
          description: '',
        };
        return extractMirrors(parsed.fields, baselineBody, statusMap);
      })();

  const currentMirrors = extractMirrors(item.fields, item.body, statusMap);
  const plan = reconcileItem(baselineMirrors, currentMirrors);

  const baselinePath = baselineRaw === null ? null : baselineRel;
  return applyPlanToFile(ctx, {
    currentDiskPath,
    baselinePath,
    fields: item.fields,
    body: item.body,
    plan,
  });
}

