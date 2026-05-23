export type Form = 'inline' | 'file' | 'dir';

export type SyncState = 'task' | 'issue' | 'epic';

export const KnownDirectives = {
  FILE: 'FILE',
  DIR: 'DIR',
  ARCHIVE: 'ARCHIVE',
  ISSUE: 'ISSUE',
  EPIC: 'EPIC',
  MIGRATE: 'MIGRATE',
  DELETE: 'DELETE',
} as const;

export type KnownDirective = (typeof KnownDirectives)[keyof typeof KnownDirectives];

/** Status char from the filename `[X]` prefix. Single character. ' ' = undefined. */
export type Status = string;

/** Single-character index prefix from `N. `. */
export type Index = string;

/** Provider-owned key (e.g. `XX-123`, `#123`). */
export type IssueKey = string;

/** Directive token (e.g. 'EPIC' or a provider-name). */
export type Directive = string;

/** The five mirrored fields parsed from any one Item location. */
export type Fields = {
  status: Status;
  index: Index | null;
  issueKey: IssueKey | null;
  title: string;
  directive: Directive | null;
};

/** Known frontmatter keys; unknowns are preserved verbatim. */
export type Frontmatter = {
  'issue-key'?: string;
  status?: string;
  provider?: string;
  'issue-type'?: string;
  priority?: string;
} & { [key: string]: string | undefined };

export type FileBody = {
  /** Raw frontmatter block text (without the `<!--` / `-->` wrappers) or null. */
  rawFrontmatter: string | null;
  frontmatter: Frontmatter;
  /** Text of the H1 line content (after `# `), or null if no H1. */
  h1: string | null;
  /** Everything after the H1 line, trimmed. Empty string if no body. */
  description: string;
};

export type InlineLocation = {
  /** 1-based line number in the enclosing file. */
  line: number;
  /** Number of leading spaces before `- [...]`. */
  indent: number;
};

export type Item = {
  form: Form;
  /** Workspace-relative path. For Inline: path of the enclosing file. */
  path: string;
  fields: Fields;
  /** Present on File/Dir items. */
  body?: FileBody;
  /** Present on Inline items. */
  inline?: InlineLocation;
  /** Free-form description for Inline items (indented continuation). */
  inlineDescription?: string;
  children: Item[];
};
