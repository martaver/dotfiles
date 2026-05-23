import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parseFilename } from './filename.ts';
import { extractFrontmatter, parseFrontmatter } from './frontmatter.ts';
import { parseInlineLine } from './inline.ts';
import type { FileBody, Item } from './types.ts';

const SKIP_DIRS = new Set(['.md-issue', '.git', 'node_modules']);

export type LoadOptions = {
  /** Per-path issue-key pattern resolver (provider-aware). Defaults to global default. */
  issueKeyPattern?: (path: string) => RegExp | undefined;
};

/**
 * Walk `root` (workspace root) and produce the top-level Items contained in it.
 * Items found via file/dir entries are returned alongside Inline items extracted
 * from `root/index.md` (if present).
 */
export async function loadTree(root: string, opts: LoadOptions = {}): Promise<Item[]> {
  return loadContainer(root, root, opts);
}

async function loadContainer(
  containerDir: string,
  workspaceRoot: string,
  opts: LoadOptions,
): Promise<Item[]> {
  const items: Item[] = [];

  // 1. Inline items from this container's index.md (if any).
  const indexPath = join(containerDir, 'index.md');
  if (await fileExists(indexPath)) {
    const body = await loadFileBody(indexPath);
    const inlineItems = extractInlineItems(
      body.description,
      relative(workspaceRoot, indexPath),
      indexLineOffset(body),
    );
    items.push(...inlineItems);
  }

  // 2. File / Dir items from this container's entries.
  let entries: string[];
  try {
    entries = await readdir(containerDir);
  } catch {
    return items;
  }

  for (const entry of entries.toSorted()) {
    if (SKIP_DIRS.has(entry)) continue;
    if (entry === 'index.md') continue;
    const fullPath = join(containerDir, entry);
    const st = await stat(fullPath);
    const keyPattern = opts.issueKeyPattern?.(fullPath);
    const parseOpts = keyPattern ? { issueKeyPattern: keyPattern } : {};

    if (st.isDirectory()) {
      const parsed = parseFilename(entry, parseOpts);
      if (!parsed) continue;
      const childIndex = join(fullPath, 'index.md');
      const body = (await fileExists(childIndex)) ? await loadFileBody(childIndex) : undefined;
      const children = await loadContainer(fullPath, workspaceRoot, opts);
      const item: Item = {
        form: 'dir',
        path: relative(workspaceRoot, fullPath),
        fields: parsed.fields,
        children,
      };
      if (body) item.body = body;
      items.push(item);
    } else if (st.isFile() && entry.endsWith('.md')) {
      const parsed = parseFilename(entry, parseOpts);
      if (!parsed) continue;
      const body = await loadFileBody(fullPath);
      const inlineChildren = extractInlineItems(
        body.description,
        relative(workspaceRoot, fullPath),
        indexLineOffset(body),
      );
      items.push({
        form: 'file',
        path: relative(workspaceRoot, fullPath),
        fields: parsed.fields,
        body,
        children: inlineChildren,
      });
    }
  }

  return items;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    const st = await stat(path);
    return st.isFile();
  } catch {
    return false;
  }
}

async function loadFileBody(path: string): Promise<FileBody> {
  const text = await readFile(path, 'utf8');
  const { raw, rest } = extractFrontmatter(text);
  const frontmatter = raw === null ? {} : parseFrontmatter(raw);

  // Strip blank lines at the top of `rest`, then peel off the H1 if present.
  const trimmedLeading = rest.replace(/^(?:\r?\n)+/, '');
  const h1Match = trimmedLeading.match(/^# (.+?)\r?\n/);
  let h1: string | null = null;
  let description = trimmedLeading;
  if (h1Match) {
    h1 = (h1Match[1] ?? '').trim();
    description = trimmedLeading.slice(h1Match[0].length).replace(/^(?:\r?\n)+/, '');
  }

  return {
    rawFrontmatter: raw,
    frontmatter,
    h1,
    description,
  };
}

/**
 * Return the 1-based line number on which `body.description` starts within the
 * original file. Approximate — used so inline items can report a line.
 */
function indexLineOffset(body: FileBody): number {
  let offset = 1;
  if (body.rawFrontmatter !== null) {
    offset += body.rawFrontmatter.split(/\r?\n/).length + 2; // `<!--`, inner, `-->`
  }
  if (body.h1 !== null) offset += 2; // `# Title\n` and a blank line after
  return offset;
}

/**
 * Pull inline Items out of a markdown body. Indent determines nesting: deeper
 * indent than the current top-of-stack means the new line is a child of the
 * top item; equal or lesser indent pops the stack first.
 */
export function extractInlineItems(body: string, sourcePath: string, lineBase: number): Item[] {
  const roots: Item[] = [];
  const stack: { item: Item; indent: number }[] = [];

  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const parsed = parseInlineLine(line);
    if (!parsed) continue;

    const item: Item = {
      form: 'inline',
      path: sourcePath,
      fields: parsed.fields,
      inline: { line: lineBase + i, indent: parsed.indent },
      children: [],
    };

    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? -1) >= parsed.indent) {
      stack.pop();
    }
    const top = stack[stack.length - 1];
    if (top) top.item.children.push(item);
    else roots.push(item);
    stack.push({ item, indent: parsed.indent });
  }

  return roots;
}
