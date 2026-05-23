# md-issue — Implementation Plan

Build order, module structure, and milestones for delivering [SPEC.md](./SPEC.md). Companion to [CONTEXT.md](./CONTEXT.md) (glossary) and [docs/adr/](./docs/adr/) (architectural decisions).

---

## 1. Tech stack

- **Runtime**: bun (single dependency, fast cold-start, native fetch, native test runner, single-file builds).
- **Language**: TypeScript (strict mode).
- **CLI**: `commander` — battle-tested argv parsing with subcommand support.
- **Interactive prompts**: `@clack/prompts` — used by `init`.
- **TOML**: `smol-toml` — small, fast, spec-compliant, types-friendly.
- **Glob matching**: `picomatch` — fast, correct, no deps.
- **Schema validation**: `zod` — for config validation with good error messages.
- **Git**: shell out via bun's `$` API rather than pulling in `simple-git`. Keeps the dep count low; we only need diff, add, commit, branch, stash, rebase — all of which are stable plumbing.
- **Markdown / frontmatter / inline parsing**: hand-rolled. The grammar is small and bespoke (filename grammar, HTML-comment frontmatter, list-line parsing). Pulling in `unified`/`remark` would be over-engineering — but use `mdast-util-from-markdown` opportunistically if list-line edge cases get hairy.
- **HTTP**: built-in `fetch` (bun provides it).
- **Tests**: `bun:test`.

---

## 2. Module layout

```
src/
├── cli.ts                         entry point
├── commands/
│   ├── init.ts
│   ├── lint.ts
│   ├── push.ts
│   └── pull.ts
├── model/
│   ├── types.ts                   Item, Field, Form, Directive, Status, Index
│   ├── filename.ts                parse / serialize filename grammar
│   ├── frontmatter.ts             HTML-comment parser/writer
│   ├── inline.ts                  list-line parser
│   ├── tree.ts                    whole-tree load / walk
│   └── identity.ts                given an Item, list every mirror location
├── config/
│   ├── load.ts                    read .md-issue/config.toml
│   ├── schema.ts                  zod schema for validation
│   └── mappings.ts                glob → provider resolution
├── git/
│   ├── exec.ts                    shell-out wrapper around git
│   ├── diff.ts                    parse `git diff` output
│   ├── stage.ts                   `git add`
│   ├── branch.ts                  provider branch create/advance
│   └── merge.ts                   stash → rebase → unstash
├── lint/
│   ├── reconcile.ts               per-field mirror reconciliation
│   ├── propagate.ts               cross-file (parent index.md inline refs)
│   ├── conflict.ts                conflict-marker injection (single location)
│   └── directives.ts              execute FILE, DIR, ARCHIVE
├── providers/
│   ├── interface.ts               IssueProvider type
│   ├── auth.ts                    auth-cmd resolution
│   ├── batch.ts                   ChangeBatch types
│   ├── jira/
│   │   ├── index.ts               JiraProvider impl
│   │   ├── api.ts                 REST client
│   │   ├── hierarchy.ts           parent-link logic
│   │   └── batch.ts               bulk endpoint coalescing
│   └── github/
│       ├── index.ts               GitHubProvider impl
│       ├── rest.ts
│       ├── graphql.ts
│       ├── projects.ts            Projects v2 for Epics
│       └── tasklist.ts            inline task-list rendering / promotion
├── push/
│   ├── plan.ts                    build per-provider ChangeBatch from staged state
│   ├── topo.ts                    topological sort (parents first)
│   ├── execute.ts                 invoke applyChanges, handle partial failures
│   └── writeback.ts               keys → mirrors, consume directives
└── pull/
    ├── fetch.ts                   delta + ID-list reconciliation
    ├── render.ts                  provider Issue → canonical markdown
    └── apply.ts                   commit on provider branch + merge
```

Test files mirror the structure under `test/`. Fixtures (sample trees, sample git repos) live in `test/fixtures/`.

---

## 3. Build order

### Milestone 0 — Project scaffold

- `bun init`, `tsconfig.json` (strict), Biome for formatting/linting, `bun:test` smoke test.
- Set up `commander` skeleton with no-op `init`/`lint`/`push`/`pull` subcommands.
- Single-file build target via `bun build --compile`.

### Milestone 1 — Domain model + tree round-trip

Everything in `src/model/` plus `src/config/`.

- **Filename grammar** parser/serializer. Round-trip test: every valid filename string parses to a struct that serializes back to the same string.
- **Frontmatter** parser (HTML-comment) and writer. Preserve unknown keys (for opaque round-trip of custom fields).
- **Inline list-line** parser. Recognize status, index, key, title, directive on a list line; handle indented continuation as description.
- **Tree loader** — walks a directory, yields `Item`s with their **Form** and full set of mirror locations. Handles `index.md` ⇄ dir, recognises archive dir, ignores `.md-issue/`.
- **Config loader** — TOML + zod schema validation. Helpful error messages on schema violations.
- **Glob mapping** — given a path, return its **Provider**.

Tests:
- Parse/serialize round-trip identity for every kind of name.
- Tree fixtures covering all three Forms.
- Config validation negative cases.

**Validation point**: load the existing [root/](./root/) example tree, verify every Item parses correctly, write it back unchanged.

### Milestone 2 — Lint (no network)

Everything in `src/git/`, `src/lint/`, `src/commands/lint.ts`.

- **Git wrappers**: `diff --staged`, `diff` (working tree vs index), `add`, `status` (detect conflict markers).
- **Field reconciliation engine**: given baseline + current for an Item across all mirror locations, compute the propagation plan (single-mirror change → propagate; multi-mirror same → no-op; multi-mirror diff → conflict).
- **Cross-file propagation**: when an Item's Status/Title/Key changes, find every inline reference to it in other index.md files and propagate.
- **Conflict marker injection**: write `<<<<<<<` / `=======` / `>>>>>>>` into exactly one in-file location (H1 for Title, frontmatter for everything else). Refuse to touch files that already contain conflict markers.
- **Lint directives**: `>> FILE` (promote inline → file), `>> DIR` (promote → dir), `>> ARCHIVE` (move to configured archive dir).
- **Stage reconciled changes** at the end.

Tests:
- Mirror reconciliation matrix: every (baseline, current) field combination across locations.
- Cross-file propagation with real git fixture repos.
- Directive execution: FILE/DIR/ARCHIVE.
- Idempotency: running lint twice on the same input is a no-op.

**Validation point**: hand-edit a status in a filename, run lint, observe the frontmatter and H1 (where applicable) updated and the change staged.

### Milestone 3 — Provider abstraction + Jira read-only

`src/providers/interface.ts`, `src/providers/auth.ts`, `src/providers/jira/`, `src/pull/`, `src/commands/pull.ts`.

- **IssueProvider interface**: `parseIssueKey`, `formatIssueKey`, `listSince`, `listAllIds`, `fetchIssue`, `applyChanges`.
- **auth-cmd resolution**: shell out, capture stdout, strip whitespace, cache in-process.
- **Jira REST adapter**: `listSince` via `updated >= "{ts}"` JQL; `listAllIds` via paginated key-only search; `fetchIssue` via `/rest/api/3/issue/{key}`; `applyChanges` initially throws (we're read-only this milestone).
- **Pull**:
  - Determine watermark from latest commit timestamp on **Provider Branch** (or epoch if branch is new).
  - Delta fetch + ID reconciliation.
  - Render fetched Issues as canonical markdown (delegating filename / frontmatter / H1 to `model/`).
  - Place files according to dir mapping + hierarchy (Jira parent field → enclosing dir).
  - Commit on **Provider Branch** with synthetic message.
  - Stash → rebase → unstash to merge into working branch.
  - Refuse if working tree has unlinted changes.

Tests:
- Mocked Jira API: deterministic provider responses, assert exact markdown output.
- Provider branch creation/advancement on a fixture git repo.
- Merge conflict path: edit a pulled Issue locally, pull again with a remote change, observe single-location conflict marker.

**Validation point**: configure against a real (or recorded) Jira instance, run `md-issue pull`, see the project tree appear.

### Milestone 4 — Jira push

`src/push/`, `src/commands/push.ts`, finish `JiraProvider.applyChanges`.

- **Push plan**: diff staged state vs HEAD per Provider; classify each Item as create/update/delete; resolve directives into intended issue-types.
- **Topological sort**: parents before children, then by Index.
- **Jira batch construction**: `applyChanges` splits creates into `/bulk` calls (≤50 each), updates into `/bulkfetch` followed by per-issue PUTs, deletes into `/bulkdelete`.
- **Writeback**: on success per Item, write returned key to all mirrors, consume directive, set frontmatter `provider`, stage.
- **Auto pull-before-push**: invoke pull first; abort on conflicts.
- **Auto-commit on completion**, advance Provider Branch.
- **Partial failure handling**: forward progress preserved; re-running push resumes.

Tests:
- Push plan generation: all states (create, update, delete, no-op, directive-consumed).
- Cascade test: `>> EPIC` on a dir parent with child `.md` files → expect Epic created first, children created as Issues afterwards in same run.
- Writeback round-trip: keys appear in every mirror.

**Validation point**: create local items, push, see them appear in Jira with the right hierarchy.

### Milestone 5 — GitHub provider

`src/providers/github/`.

- REST + GraphQL clients.
- `parseIssueKey`/`formatIssueKey` for `#NNN`.
- **Hierarchy via GitHub Projects v2**: when a declared-Epic is pushed for the first time, create a Project (name = Epic title), then add issues to it. Subsequent child issues are added to the same Project.
- **Inline tasks**: when an Issue with **Inline** children is pushed, render the children as markdown task-list lines in the Issue body.
- **`>> ISSUE` promotion**: detect on inline task during push; create new Issue, add to parent's Project, rewrite the original task-list line as `- [ ] #<new-key> <title>` and stage.
- **No batch**: `applyChanges` runs sequentially. Optionally bundle into a single GraphQL document for fewer round-trips.

Tests:
- All Jira tests, adapted for GitHub semantics.
- Inline-task promotion: assert the back-link rewrite and provider-side state.
- Projects v2 mocked API: assert Project creation only happens once per Epic.

**Validation point**: a repo configured with both Jira and GitHub providers, with different dir mappings, syncs to both.

### Milestone 6 — Init + polish

`src/commands/init.ts`, plus UX/error polish across the codebase.

- Interactive prompts with `@clack/prompts`: provider type, host/owner, project keys, etc.
- Write `.md-issue/config.toml` and `.gitignore` entry.
- Create Provider Branches as orphan branches.
- Scaffold root `index.md`.
- Verify `auth-cmd` works for each provider.
- `--import` flag triggers `pull --full` post-setup.
- Shell completion install for bash/zsh/fish (via `commander`'s built-in support).
- Error messages: every failure path has a human-readable message and an exit code.
- `--verbose` / `--debug` / `--dry-run` flags consistent across commands.
- README, examples, contribution guide.

**Validation point**: a teammate can run `md-issue init` on a fresh machine and reach a working sync state in <5 minutes.

---

## 4. Testing strategy

- **Unit tests** for every parser/serializer (`model/`, `config/`). Coverage target: 95%+.
- **Integration tests** for `lint`, `push`, `pull` using `tmpdir` git fixtures — real `git` invocations against scratch repos.
- **Provider tests** use mock `IssueProvider` implementations plus contract tests that every concrete provider must pass (parse/format key round-trip, applyChanges idempotency, listSince watermark semantics).
- **Recorded HTTP tests** (e.g. `msw` or hand-rolled fixture replays) for Jira and GitHub REST/GraphQL calls — avoids real network in CI.
- **E2E tests** against real Jira sandbox and a test GitHub repo, opt-in via `BUN_TEST_E2E=1`. Not run in default CI.

---

## 5. Deferred to a later release

- File watcher mode (`md-issue watch`).
- Git pre-commit hook installer.
- `JSON read-cache at `.md-issue/cache/index.json` for editor plugins.
- Issue comments, worklog, watchers.
- Webhook-driven push.
- Real-time sync of attachments.
- `>> INLINE` directive (revisit if a use case emerges).
- VS Code extension that surfaces lint inline.

---

## 6. Open implementation decisions to revisit during build

- **Pagination strategy** for Jira `listSince` JQL — default to 100/page; revisit if rate limits bite.
- **GraphQL bundling threshold** for GitHub — under what change-count does it pay vs separate REST calls?
- **Conflict marker format**: stick with literal git markers (`<<<<<<< ours`) or use a md-issue-flavoured marker that's easier to detect? Default to git's for IDE compatibility, revisit if confusion arises.
- **Performance benchmarks** at Milestones 2 and 4 — establish baseline before optimizing.
