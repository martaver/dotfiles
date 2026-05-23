import { writeFile, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parseInlineLine, serializeInlineLine } from './inline.ts';
import { serializeFilename } from './filename.ts';
import { serializeFrontmatter } from './frontmatter.ts';
import type { Fields, FileBody, Frontmatter } from './types.ts';

/**
 * Serialize a File or Dir item's full content (frontmatter + H1 + description)
 * to a canonical string. `h1Text` is the human title to render after `# `;
 * pass `null` to omit the heading.
 */
export function serializeFileBody(args: {
  frontmatter: Frontmatter;
  h1: string | null;
  description: string;
}): string {
  const fmBlock = serializeFrontmatter(args.frontmatter);
  const sections: string[] = [];
  if (fmBlock) sections.push(fmBlock);
  if (args.h1 !== null) sections.push(`# ${args.h1}`);
  if (args.description) sections.push(args.description.replace(/\n+$/, ''));
  if (sections.length === 0) return '';
  return `${sections.join('\n\n')}\n`;
}

/**
 * Write a File-form item's body to `absPath`. Creates parent directories as
 * needed. Does NOT handle filename canonicalization — caller resolves the
 * target path.
 */
export async function writeFileItemBody(absPath: string, body: FileBody): Promise<void> {
  await mkdir(dirname(absPath), { recursive: true });
  await writeFile(absPath, serializeFileBody({
    frontmatter: body.frontmatter,
    h1: body.h1,
    description: body.description,
  }));
}

/**
 * Compute the canonical absolute path for a File-form item. `containerDir` is
 * the parent directory (absolute). `ext` defaults to `.md` (pass `''` for
 * dirnames).
 */
export function canonicalFileItemPath(
  containerDir: string,
  fields: Fields,
  ext: string = '.md',
): string {
  return join(containerDir, serializeFilename(fields, ext));
}

/**
 * Move a file on disk if `from !== to`. No-op when paths are equal. Throws on
 * any other error.
 */
export async function renameItemFile(from: string, to: string): Promise<void> {
  if (from === to) return;
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
}

/**
 * Replace exactly one task-list line in a file body. The line is identified by
 * its (1-based) line number; if the line doesn't parse as an inline task,
 * throws. Preserves the rest of the body verbatim.
 */
export function replaceInlineLine(
  body: string,
  lineNumber: number,
  newFields: Fields,
): string {
  const lines = body.split(/\r?\n/);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lines.length) {
    throw new Error(`Line ${lineNumber} out of range (body has ${lines.length} lines)`);
  }
  const original = lines[idx] ?? '';
  const parsed = parseInlineLine(original);
  if (!parsed) {
    throw new Error(`Line ${lineNumber} does not parse as an inline task: ${original}`);
  }
  const opts: Parameters<typeof serializeInlineLine>[1] = { indent: parsed.indent };
  if (parsed.isLink) opts.isLink = true;
  if (parsed.linkHref !== null) opts.linkHref = parsed.linkHref;
  lines[idx] = serializeInlineLine(newFields, opts);
  return lines.join('\n');
}

/**
 * Delete a file on disk. Used by ARCHIVE / DELETE directives in later milestones.
 */
export async function deleteFileItem(absPath: string): Promise<void> {
  await unlink(absPath);
}
