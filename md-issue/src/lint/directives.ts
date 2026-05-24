import { mkdir, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { serializeFilename } from '../model/filename.ts';
import { dedentLines, inlineItemRange } from '../model/inline.ts';
import { serializeFileBody } from '../model/writers.ts';
import type { Fields, Item } from '../model/types.ts';
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

/**
 * Apply `>> FILE` to an inline item: extract the item from its parent file and
 * create a sibling `.md` file with the inline's content as body.
 */
export async function applyInlineToFileDirective(
  ctx: ApplyContext,
  item: Item,
): Promise<AppliedItem> {
  return promoteInlineToItem(ctx, item, 'file');
}

/**
 * Apply `>> DIR` to an inline item: extract the item from its parent file and
 * create a sibling directory containing `index.md`.
 */
export async function applyInlineToDirDirective(
  ctx: ApplyContext,
  item: Item,
): Promise<AppliedItem> {
  return promoteInlineToItem(ctx, item, 'dir');
}

async function promoteInlineToItem(
  ctx: ApplyContext,
  item: Item,
  targetForm: 'file' | 'dir',
): Promise<AppliedItem> {
  if (!item.inline) throw new Error(`Inline item missing position info: ${item.path}`);

  const parentAbs = join(ctx.workspaceRoot, item.path);
  const parentText = await readFile(parentAbs, 'utf8');
  const lines = parentText.split(/\r?\n/);

  const { start, end } = inlineItemRange(lines, item.inline.line, item.inline.indent);
  const contentLines = dedentLines(lines.slice(start + 1, end), item.inline.indent + 2);

  // Strip the directive from the resulting item.
  const cleanFields: Fields = { ...item.fields, directive: null };
  const parentDir = dirname(parentAbs);
  const ext = targetForm === 'dir' ? '' : '.md';
  const targetName = serializeFilename(cleanFields, ext);
  const targetAbs = join(parentDir, targetName);
  const bodyPath = targetForm === 'dir' ? join(targetAbs, 'index.md') : targetAbs;

  // Build the new item's body. Description comes from the dedented continuation
  // lines; frontmatter carries the issue-key if present.
  const description = contentLines.join('\n').replace(/\n+$/, '');
  const bodyText = serializeFileBody({
    frontmatter: cleanFields.issueKey ? { 'issue-key': cleanFields.issueKey } : {},
    h1: cleanFields.title,
    description,
  });

  if (targetForm === 'dir') await mkdir(targetAbs, { recursive: true });
  await writeFile(bodyPath, bodyText);

  // Rewrite the parent: splice out the inline range.
  const newParentLines = [...lines.slice(0, start), ...lines.slice(end)];
  await writeFile(parentAbs, newParentLines.join('\n'));

  return {
    newPath: relative(ctx.workspaceRoot, targetAbs),
    baselinePath: null,
    stagePaths: [
      relative(ctx.repoRoot, parentAbs),
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

/**
 * Apply `>> DIR` to a File-form item: convert `<file>.md` into `<file>/index.md`.
 * Existing inline children inside the body stay inline.
 */
export async function applyFileToDirDirective(
  ctx: ApplyContext,
  item: Item,
): Promise<AppliedItem> {
  if (!item.body) throw new Error(`File item missing body: ${item.path}`);
  const sourceAbs = join(ctx.workspaceRoot, item.path);
  const cleanFields: Fields = { ...item.fields, directive: null };
  const parentDir = dirname(sourceAbs);
  const targetDirAbs = join(parentDir, serializeFilename(cleanFields, ''));
  const bodyAbs = join(targetDirAbs, 'index.md');

  await mkdir(targetDirAbs, { recursive: true });
  await writeFile(
    bodyAbs,
    serializeFileBody({
      frontmatter: item.body.frontmatter,
      h1: item.body.h1,
      description: item.body.description,
    }),
  );
  // Strip the directive from the new file's representation by using `cleanFields`.
  // Remove the original `.md` file.
  await unlink(sourceAbs);

  return {
    newPath: relative(ctx.workspaceRoot, targetDirAbs),
    baselinePath: item.path,
    stagePaths: [
      relative(ctx.repoRoot, sourceAbs),
      relative(ctx.repoRoot, targetDirAbs),
    ],
    conflicts: {
      status: { kind: 'noop', value: null },
      issueKey: { kind: 'noop', value: null },
      title: { kind: 'noop', value: null },
    },
    touched: true,
  };
}

// touch unused imports kept for future expansion
void rm;
