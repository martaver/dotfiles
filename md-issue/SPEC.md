# md-issue — Specification

A command-line tool that two-way syncs a directory of markdown files with an issue tracker (Jira, GitHub). **The filesystem is the source of truth** — markdown files, directories, and inline list-lines *are* issues; md-issue keeps them consistent with the configured **Provider**(s).

Terminology in **bold** is defined in [CONTEXT.md](./CONTEXT.md). Architectural decisions are recorded in [docs/adr/](./docs/adr/). This document describes behavior — not implementation.

---

## 1. Item encoding

### 1.1 Forms

Every **Item** lives in exactly one of three **Forms**:

- **Inline** — a markdown list line `- [<status>] <index>. <issue-key> <title> >> <directive>` inside another markdown file, optionally followed by indented description and child list-lines.
- **File** — a `.md` file. The filename encodes **Fields**; the body holds the **Description**.
- **Dir** — a directory containing an `index.md`. The dirname encodes **Fields**; the `index.md` body holds the **Description**, and may contain child **Items** in any form.

**Form** is independent of sync state (**Task** / **Issue** / **Epic**). Any combination is valid.

### 1.2 Filename grammar (and dirname grammar, and inline list-line grammar)

Fields appear in this fixed order, with only `<title>` mandatory:

```
[<status>] <index>. <issue-key> <title> >> <directive>
```

Examples:

| Encoded form | Status | Index | Issue Key | Title | Directive |
|---|---|---|---|---|---|
| `[x] XX-123 My Issue.md` | `x` | — | `XX-123` | `My Issue` | — |
| `[ ] 1. ZZ-224 Foo.md` | (space) | `1` | `ZZ-224` | `Foo` | — |
| `[ ] Big Thing >> EPIC.md` | (space) | — | — | `Big Thing` | `EPIC` |
| `- [ ] Do thing >> ISSUE` (inline) | (space) | — | — | `Do thing` | `ISSUE` |

`[ ]` (literal space) = "undefined status, defer to the **Provider**'s default." All other status characters are user-configured. No wildcard status mapping is permitted.

### 1.3 Field mirroring

The **Fields** (**Status**, **Index**, **Issue Key**, **Title**, **Directive**) are mirrored across every location where they can appear:

| Field | Filename / Dirname | Frontmatter | H1 / Inline line | Description body |
|---|---|---|---|---|
| Status | yes (`[x]`) | yes (`status:`) | no | no |
| Index | yes (`1. `) | only when mapped to a **Priority** (stored as the **Priority** value, not the index char) | no | no |
| Issue Key | yes | yes | no | no |
| Title | yes | no (redundant) | yes (H1 / list-line) | no |
| Directive | yes (suffix) | no | yes (H1 / list-line suffix) | no |

`lint` reconciles divergent values across mirror locations using `git diff` of the working tree against the index ([ADR 0001](./docs/adr/0001-markdown-in-git-as-source-of-truth.md)).

### 1.4 Frontmatter

Stored as an HTML comment at the top of a **File** or `index.md`:

```html
<!--
issue-key = XX-123
status = backlog
provider = jira-main
issue-type = Story
-->
```

Holds: fields the filename can't carry, **Provider**-specific extras the user has opted into, and a mirror of `issue-key` / `status` so the file is self-describing when opened. `provider` is stored once on first push and is sticky thereafter (see §4.4).

### 1.5 Description and unsafe characters

Everything below the H1 (for **File**/**Dir**) or below the indented continuation of the list-line (for **Inline**) is the **Description**. It is free-form markdown and round-trips to the **Provider**'s description/body field.

The **Title** can contain characters that are not filename-safe. Config declares an `unsafe-chars` map (`"/" = "_"`, etc.) that `lint` uses when encoding the **Title** into a filename or dirname. The H1 / inline line text always retains the original.

---

## 2. Sync states and the default-inheritance rule

### 2.1 States

- **Task** — unsynced **Item** with no **Issue Key**. May carry a **Directive** declaring future intent, but until push succeeds it's still a Task.
- **Issue** — synced **Item** with an **Issue Key**.
- **Epic** — an **Issue** whose `issue-type` matches the **Provider**'s configured epic type. Only created post-sync.

### 2.2 Default sync state for new items

When a new **Item** is created in the tree (no **Directive**, no key), its default sync state is inherited from its nearest enclosing **Item**'s **declared role**:

- Inside a declared **Epic** → defaults to **Issue**
- Inside an **Issue** (and not also a declared Epic) → defaults to **Task**
- Inside a **Task** (or no enclosing Item) → defaults to **Task**

"Declared role" is whichever is stronger: a **Directive** (e.g. `>> EPIC`) or a synced `issue-type`. A **Task** carrying `>> EPIC` already counts as a declared Epic for the purpose of this rule — so the entire subtree can be created in a single push.

A **Directive** on the **Item** itself always overrides the inherited default.

---

## 3. Workflow states (and git areas)

| Workflow state | Lives in | Meaning |
|---|---|---|
| **Unlinted** | git working tree | User edits not yet reconciled across **Field** mirrors |
| **Staged** | git index | `lint` has reconciled mirrors; ready to push |
| **Committed** | git history | `push` / `pull` cycle complete; remote state captured |

Movement is always explicit: `edit` → `md-issue lint` → `md-issue push` / `md-issue pull` → `git commit`. No background daemon promotes between states.

---

## 4. Commands

### 4.1 `md-issue lint`

Reconciles **Field** mirrors and applies lint-owned **Directives** (`>> FILE`, `>> DIR`).

1. Compare working tree (current) vs index (baseline).
2. For each touched **Item**:
   - Parse every mirror location for that Item's Fields.
   - **Single-mirror change**: propagate to all other mirror locations.
   - **Multi-mirror changes, same value**: no-op.
   - **Multi-mirror changes, different values**: write git-style conflict markers (`<<<<<<<` / `=======` / `>>>>>>>`) into **exactly one** in-file location — preferring H1 (for Title) or frontmatter (for everything else), never the filename. Lint refuses to proceed on that file until conflict is resolved.
3. Cross-file propagation: when a **Field** change affects how an **Item** appears in another file (e.g. status change must be reflected in any parent `index.md` that has an inline reference to the **Item**), update those mirrors too.
4. Apply ready lint-owned **Directives**: `>> FILE`, `>> DIR`, `>> ARCHIVE`.
5. `git add` reconciled changes. Unresolved conflicts stay unstaged.
6. Print summary.

`lint` refuses to proceed if any file currently contains git conflict markers or the working tree is in a conflicted merge state.

### 4.2 `md-issue push`

Operates on **Staged** state only — refuses to run if there are **Unlinted** changes in the working tree.

1. Auto-invoke `pull` first to ensure the **Provider Branch** is up to date and merged into the working branch. Abort if the merge produces conflicts.
2. Diff staged state against last commit per **Provider** to identify what to send.
3. Topologically sort changes (parents before children) and group by **Provider**.
4. Hand each per-**Provider** batch to that **Provider**'s `applyChanges(batch)`. The adapter decides how to execute (Jira: bulk endpoints; GitHub: serial or GraphQL-bundled — [ADR 0003](./docs/adr/0003-provider-hierarchy-mapping.md)).
5. On success per **Item**: write returned **Issue Key** to all mirror locations, remove consumed **Directive**, set frontmatter `provider`. Stage the changes.
6. On failure: stop, report which **Item** failed. Already-pushed **Items** remain staged with their new keys (forward progress preserved). Re-running push resumes.
7. Auto-commit on completion. Advance the **Provider Branch**(es) to match.

### 4.3 `md-issue pull`

Brings remote state into the local tree.

1. For each configured **Provider**:
   - Delta fetch since the latest commit timestamp on that **Provider Branch**.
   - Same-call ID-list reconciliation to detect deletions.
   - Render each fetched **Issue** as canonical markdown (filename + frontmatter + H1 + body), place it at its path per dir mappings + hierarchy.
   - Commit on the **Provider Branch** with a synthetic message.
2. Merge each **Provider Branch** into the working branch via stash → rebase → unstash. Standard git conflict resolution (single-location markers per §4.1).
3. Pull refuses to run if there are **Unlinted** changes in the working tree.

### 4.4 `md-issue init`

Bootstrap for a repo:

1. Interactive setup (or `--config` flag): write `.md-issue/config.toml` with **Provider** definitions, path-glob mappings, status / index / unsafe-char maps.
2. Add `.md-issue/cache/` to `.gitignore`. Leave `config.toml` committed.
3. Verify `auth-cmd` works for every **Provider**.
4. Create empty **Provider Branch**(es), one per **Provider** (`md-issue/<provider-name>`), as orphan branches.
5. Scaffold an empty root `index.md`.
6. Offer to install a basic shell completion. (Git pre-commit hook installation is deferred — see [ADR 0001](./docs/adr/0001-markdown-in-git-as-source-of-truth.md).)
7. Optionally — if `--import` is passed — invoke `md-issue pull --full` to fetch the entire current state of every configured **Provider** into the working tree.

---

## 5. Directives

| Directive | Owner | Effect |
|---|---|---|
| `>> FILE` | lint | Promote **Inline** → **File** |
| `>> DIR` | lint | Promote **Inline**/**File** → **Dir** |
| `>> ARCHIVE` | lint | Move **Item** locally to a configured archive dir (no **Provider** effect) |
| `>> ISSUE` | push | Sync as **Issue** with default issue-type |
| `>> EPIC` | push | Sync as **Epic** |
| `>> <issue-type>` | push | Sync with a named issue-type (e.g. `>> BUG`, `>> STORY`) |
| `>> <provider-name>` or `>> <project-key>` | push | Sync to a specific **Provider** / project |
| `>> MIGRATE` | push | Cross-**Provider** migration: close old, create new under the **Provider** that the **Item**'s current path maps to |
| `>> DELETE` | push | Delete from **Provider** and locally |

Closing an **Issue** is **not** a directive — it is a **Status** change (set the **Status** char to whatever maps to "Done"/"Closed" in config).

Only one **Directive** per **Item** at a time. Chaining is disallowed; use sequenced operations.

---

## 6. Multi-provider

A repo can declare multiple **Providers** in `config.toml`. Path-glob mappings (first-match wins) decide which **Provider** owns each directory:

```toml
[[mappings]]
glob = "projects/frontend/**"
provider = "jira-main"

[[mappings]]
glob = "platform/**"
provider = "github-platform"

[[mappings]]
glob = "**"
provider = "jira-main"
```

For a **new Task**, the **Provider** is determined by the **Item**'s path. For an existing **Issue** (one with an **Issue Key**), the **Provider** is whatever was recorded in frontmatter on first sync, and **does not change** if the file is moved to a different mapped path — explicit `>> MIGRATE` is required to change it.

Each **Provider** has its own **Provider Branch**: `md-issue/<provider-name>`.

---

## 7. Provider semantics

### 7.1 Jira

- **Epic** = Issue with `issue-type = Epic`.
- Parent-child = native `parent` field.
- **Issue Key** = `PROJ-NNN` (provider-owned format).
- Bulk endpoints used for `applyChanges`.

### 7.2 GitHub

- **Epic** = GitHub Project (v2). Created when a declared-Epic is pushed for the first time.
- **Issue** = GitHub Issue, added to its Epic's Project.
- Child **Items** of an Issue (Inline form) are rendered as a markdown task list in the Issue body — first-class checklist rendering on GitHub.
- A `>> ISSUE` **Directive** on an inline task promotes it to its own GitHub Issue, added to the same Project. The original task line is rewritten as `- [ ] #<new-key> <title>` so the back-link survives.
- **Issue Key** = `#NNN` (provider-owned format).
- No native batch API for Issues — adapter uses serial REST calls or bundled GraphQL mutations.

See [ADR 0003](./docs/adr/0003-provider-hierarchy-mapping.md) for the rationale.

---

## 8. Configuration

Lives at `.md-issue/config.toml` at the repo root. Committed (no credentials).

```toml
[status]
" " = "<default>"        # built-in: defer to provider
"_" = "Backlog"
"p" = "Planning"
"-" = "In Progress"
"r" = "In Review"
"x" = "Done"

[priority]
"0" = "Immediate"
"1" = "Urgent"
"2" = "High"
"_" = "Low"

[unsafe-chars]
"/" = "_"
":" = "-"
"?" = ""

[archive]
dir = "archive/"

[[providers]]
name = "jira-main"
type = "jira"
host = "company.atlassian.net"
default-project = "FE"
default-issue-type = "Story"
epic-issue-type = "Epic"
auth-cmd = "op read op://Personal/Jira/api-token"

[providers.jira-main.custom-fields]
assignee = true
labels = true

[[providers]]
name = "github-platform"
type = "github"
owner = "myorg"
repo = "platform"
default-project = "Engineering Roadmap"
auth-cmd = "gh auth token"

[providers.github-platform.custom-fields]
assignee = true
labels = true
milestone = true

[[mappings]]
glob = "platform/**"
provider = "github-platform"

[[mappings]]
glob = "**"
provider = "jira-main"
```

Credentials are never committed. `auth-cmd` is invoked at runtime and its stdout is used as the token.

---

## 9. Out of scope (v1)

- Issue comments, worklog, watchers, mentions.
- Custom workflows / state machines beyond a flat status set.
- Bidirectional sync of attachments.
- Webhook-driven push (md-issue is always user-invoked in v1).
- Real-time file-watcher mode (`md-issue watch`) — deferred until lint perf is shown to need it.
- Git hooks integration — deferred ([ADR 0001](./docs/adr/0001-markdown-in-git-as-source-of-truth.md)).

---

## Appendix: example tree

```
.
├── .md-issue/
│   └── config.toml
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-markdown-in-git-as-source-of-truth.md
│       ├── 0002-provider-branch-as-remote-tracking-mirror.md
│       └── 0003-provider-hierarchy-mapping.md
├── archive/
└── root/
    ├── index.md
    ├── [x] XX-123 My Issue.md
    ├── [ ] YY-232 My Epic.md
    └── [ ] YY-323 Another Epic/
        ├── index.md
        ├── [ ] 0. ZZ-222 First.md
        ├── [ ] 1. ZZ-224 Second.md
        └── [ ] 2. ZZ-221 Third.md
```

`md-issue/<provider-name>` branch is invisible in this view — it lives in git refs, not the working tree.
