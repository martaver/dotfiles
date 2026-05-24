import { mkdir, rename } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { serializeFilename } from '../model/filename.ts';
import type { Item } from '../model/types.ts';
import type { AppliedItem, ApplyContext } from './apply.ts';

/**
 * Apply the `>> ARCHIVE` directive: move the item (file or directory) into the
 * configured archive directory, stripping the directive from its name.
 */
export async function applyArchiveDirective(
  ctx: ApplyContext,
  item: Item,
  archiveDir: string,
): Promise<AppliedItem> {
  const ext = item.form === 'dir' ? '' : '.md';
  const sourceAbs = join(ctx.workspaceRoot, item.path);

  // Strip the directive so the destination name no longer carries `>> ARCHIVE`.
  const cleanFields = { ...item.fields, directive: null };
  const targetName = serializeFilename(cleanFields, ext);
  const targetDirAbs = join(ctx.workspaceRoot, archiveDir);
  await mkdir(targetDirAbs, { recursive: true });
  const targetAbs = join(targetDirAbs, targetName);

  await rename(sourceAbs, targetAbs);

  return {
    newPath: relative(ctx.workspaceRoot, targetAbs),
    baselinePath: item.path,
    stagePaths: [
      relative(ctx.repoRoot, sourceAbs),
      relative(ctx.repoRoot, targetAbs),
    ],
    conflicts: {
      status: { kind: 'noop', value: null },
      issueKey: { kind: 'noop', value: null },
      title: { kind: 'noop', value: null },
    },
    touched: true,
  };
}

// suppress unused-import warnings if these helpers evolve
void dirname;
