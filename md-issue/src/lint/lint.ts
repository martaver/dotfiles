import { realpath } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { findRepoRoot, isInConflictState, readIndexFile } from '../git/operations.ts';
import { resolveRenames } from './rename.ts';
import { parseFilename } from '../model/filename.ts';
import { extractFrontmatter, parseFrontmatter } from '../model/frontmatter.ts';
import { loadTree } from '../model/tree.ts';
import type { FileBody, Item } from '../model/types.ts';
import { applyPlanToItem, stagePaths, type AppliedItem, type ApplyContext } from './apply.ts';
import { hasConflictMarkers } from './conflict.ts';
import {
  applyArchiveDirective,
  applyFileToDirDirective,
  applyInlineToDirDirective,
  applyInlineToFileDirective,
} from './directives.ts';
import { propagateCrossFile } from './propagate.ts';
import { buildStatusMap, extractMirrors, reconcileItem, type StatusMap } from './reconcile.ts';
import { readFile } from 'node:fs/promises';

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
  /** Archive destination dir (workspace-relative) for the `>> ARCHIVE` directive. */
  archiveDir?: string;
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
  const applied: AppliedItem[] = [];
  const conflicts: AppliedItem[] = [];
  const allStagePaths: string[] = [];

  // Pass 1: handle directives on inline items (FILE / DIR) and File-form DIR.
  // These are wholesale transformations of the tree; reload the tree after so
  // pass 2 sees the new file/dir layout.
  {
    const firstLoad = await loadTree(workspaceRoot);
    for (const item of walkAllItems(firstLoad)) {
      if (item.form === 'inline' && item.fields.directive === 'FILE') {
        const result = await applyInlineToFileDirective(ctx, item);
        applied.push(result);
        allStagePaths.push(...result.stagePaths);
      } else if (item.form === 'inline' && item.fields.directive === 'DIR') {
        const result = await applyInlineToDirDirective(ctx, item);
        applied.push(result);
        allStagePaths.push(...result.stagePaths);
      } else if (item.form === 'file' && item.fields.directive === 'DIR') {
        const result = await applyFileToDirDirective(ctx, item);
        applied.push(result);
        allStagePaths.push(...result.stagePaths);
      }
    }
  }

  // Re-load after the structural transformations so reconciliation sees the
  // current state.
  const { fileRenames, dirRenames } = await resolveRenames(repoRoot);
  const items = await loadTree(workspaceRoot);

  for (const item of flattenFileItems(items)) {
    // Lint-owned directives are applied as wholesale transformations and skip
    // the reconcile path.
    if (item.fields.directive === 'ARCHIVE') {
      const archiveDir = opts.archiveDir ?? 'archive';
      const result = await applyArchiveDirective(ctx, item, archiveDir);
      applied.push(result);
      allStagePaths.push(...result.stagePaths);
      continue;
    }

    const renames = item.form === 'dir' ? dirRenames : fileRenames;
    const result = await reconcileAndApply(ctx, statusMap, item, renames, workspaceRoot, repoRoot);
    if (!result) continue;
    applied.push(result);
    if (hasConflict(result)) conflicts.push(result);
    allStagePaths.push(...result.stagePaths);
  }

  // Pass 3: cross-file propagation. Inline references by IssueKey to a File
  // or Dir item are rewritten to mirror the (now canonical) target.
  const treeForPropagation = await loadTree(workspaceRoot);
  const propagation = await propagateCrossFile(ctx, treeForPropagation);
  allStagePaths.push(...propagation.stagePaths);

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

function walkAllItems(items: Item[]): Item[] {
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
  const bodyDiskPath = item.form === 'dir' ? join(currentDiskPath, 'index.md') : currentDiskPath;
  // If the file already has unresolved conflict markers, refuse to touch it.
  const currentBodyText = await readFile(bodyDiskPath, 'utf8');
  if (hasConflictMarkers(currentBodyText)) {
    return {
      newPath: relative(workspaceRoot, currentDiskPath),
      baselinePath: null,
      stagePaths: [],
      conflicts: {
        status: { kind: 'noop', value: null },
        issueKey: { kind: 'noop', value: null },
        title: { kind: 'noop', value: null },
      },
      touched: false,
      skippedReason: 'has-conflict-markers',
    };
  }
  const relForRepo = relative(repoRoot, currentDiskPath);
  const baselineRel = renames.get(relForRepo) ?? relForRepo;
  const baselineBodyRel = item.form === 'dir' ? `${baselineRel}/index.md` : baselineRel;
  const baselineRaw = await readIndexFile(repoRoot, baselineBodyRel);

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
  return applyPlanToItem(ctx, {
    form: item.form,
    currentDiskPath,
    baselinePath,
    fields: item.fields,
    body: item.body,
    plan,
  });
}

