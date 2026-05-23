# md-issue

A CLI tool that two-way syncs a directory of markdown files with an issue tracker (Jira, GitHub). Files, directories, and markdown list lines ARE issues — md-issue keeps them in sync with the provider.

## Language

### Item taxonomy

**Item**:
A unit of work that md-issue tracks. Every **Item** has a sync state (Task/Issue/Epic) and a form (Inline/File/Dir); the two are orthogonal.
_Avoid_: thing, entry, record

**Task**:
An unsynced **Item** — has no **Issue Key**. May carry a directive marking it as a future **Issue** or future **Epic**, but until push completes it is still a **Task**. Any **Item** in any **Form** can be a **Task**.
_Avoid_: subtask, todo, local issue

**Issue**:
An **Item** that is synced with the **IssueProvider** and carries an **Issue Key**. Children of an **Issue** are **Tasks** by default. An **Item** becomes an **Issue** only after a successful push.
_Avoid_: ticket

**Epic**:
An **Issue** whose `issue-type` in the **IssueProvider** is the configured epic type. An **Item** becomes an **Epic** only after a successful push as that issue-type — never as a property of a **Task**.

The "children default to **Issues**" rule fires off the **declared** role of the parent (via **Directive** or stored issue-type), not the synced role. So a **Task** carrying `>> EPIC` already causes its children to default to **Issues** before the first push — declared > synced for the purpose of inheriting defaults.
_Avoid_: parent issue, story

### Item form

Form is independent of sync state. Any **Item** is exactly one cell in the (sync-state × form) grid — e.g. an inline task, a file issue, a dir epic.

**Inline**:
An **Item** represented as a single markdown list line (`- [ ] title`) inside another markdown file, optionally followed by indented description and sub-items.

**File**:
An **Item** represented as its own `.md` file. Filename encodes status, index, issue key, and title.

**Dir**:
An **Item** represented as a directory containing an `index.md` (the item's own content) and zero or more sub-items as inline/file/dir children. Any **Item** can be a **Dir** — being a **Dir** does NOT make it an **Epic**.

### Item fields

Every **Item** has a small fixed set of **Fields**. Each field is mirrored across every location where the **Item** appears — in the filename or dirname, in the file's frontmatter (HTML comment), and in inline list-line text. `lint` reconciles divergent values across mirrors using git diff.

**Filename grammar** (and dirname grammar) — fields appear in this fixed order:

```
[<status>] <index>. <issue-key> <title> >> <directive>
```

Only `<title>` is mandatory. Status defaults to `[ ]`. Index, issue-key, and directive are each optional.

**Status**:
The workflow state of an **Item**, represented locally as a single `status-char` inside `[ ]` (e.g. `[x]`, `[-]`, `[ ]`). Config maps each `status-char` to a **Provider** status name. The literal space `[ ]` is reserved for "undefined status — defer to the **Provider**'s default" and is the only **Status** value with built-in semantics; all other characters get their meaning from config (no wildcard mapping is allowed).

**Index**:
An optional single-character ordering prefix on a **File**- or **Dir**-form item (e.g. `1. `). Primary purpose is OS sort order. When config maps an **Index** value to a **Priority**, the resolved **Priority** (not the **Index** char) is what appears in frontmatter and on the provider.

**Priority**:
A provider-side ordering label (e.g. `Urgent`, `High`, `Normal`) that an **Index** may be mapped to via config. Stored in frontmatter only when an **Index** mapping is defined.

**Title**:
The human-readable name of the **Item**. Mirrored in the filename/dirname, in the file's top-level H1 heading, and (for inline items) in the list-line text. Either the filename/dirname or the H1 may carry a trailing **Directive** suffix. Characters that aren't filename-safe are replaced in the filename via a configurable `unsafe-char → safe-char` map; the H1 retains the original.

**Description**:
The free-form markdown body that follows the H1 (for **File**/**Dir** items) or the indented prose under the list line (for **Inline** items). Maps to the provider's description / body field. Not a **Field** and not mirror-managed by `lint`.

### Workflow states

An **Item** exists in one of three workflow states at any moment. The states correspond to the three git areas:

**Unlinted**:
The state of an **Item** whose changes live only in the git working tree. The **Fields** across mirror locations may be inconsistent; `lint` has not yet reconciled them.

**Staged**:
The state of an **Item** whose changes have been reconciled by `lint` and written to the git index. **Fields** are internally consistent across mirrors. Ready to be sent to the **IssueProvider** by `push`.

**Committed**:
The state of an **Item** whose changes have been synced with the **IssueProvider** via `push` (and/or whose remote state has been merged in via `pull`), with the result captured in a git commit. Conflicts (if any) have been resolved before this state is reached.

The user moves an **Item** through these states explicitly: edit → `lint` → `push`/`pull` → `commit`. No background daemon promotes states automatically.

### Sync mechanics

**IssueProvider**:
The remote system md-issue syncs with: Jira or GitHub. The abstraction underlying every concrete **Provider**.

**Provider**:
A named, configured instance of an **IssueProvider** within a repo (e.g. `jira-main`, `github-platform`). A repo can declare multiple **Providers**; config maps glob path patterns to a specific **Provider** (first-match-wins) so different parts of the tree can sync to different remotes. Each **Provider** owns the format of its own **Issue Keys** — md-issue defers to the **Provider** for parsing and producing them. Once an **Item** is synced, its **Provider** is recorded in frontmatter and "sticks" through file moves; crossing a path boundary into a different **Provider**'s mapping does NOT migrate the **Item** automatically — that requires an explicit `>> MIGRATE` **Directive**.

**Provider Branch**:
A local git branch — one per **Provider**, named `md-issue/<provider-name>` — that tracks that **Provider**'s last-known state, treated as if it were a remote-tracking branch. `pull` fetches the **Provider**'s current state into this branch and then merges it into the working branch. `push` advances this branch after a successful sync, and refuses to run if the working branch hasn't merged in all of its commits.

**Issue Key**:
The provider-assigned identifier that pins a local **Item** to its remote counterpart. The exact format is owned by the **Provider** (e.g. Jira: `FE-123`; GitHub: `#123`) — each **Provider** parses and produces its own keys, and the key alone is not expected to identify which **Provider** it belongs to (that's done by the **Item**'s stored Provider name in frontmatter). A **Task** has no key; an **Issue** always does. Mirrored in the filename/dirname (between **Index** and **Title**), in the file's frontmatter, and (for inline items) in the line text.

**Directive**:
A user-authored expression of intent attached to an **Item** (e.g. `>> EPIC`, `>> ISSUE`, `>> FILE`, `>> DIR`, `>> MIGRATE`, `>> ARCHIVE`, `>> DELETE`). Appears as a suffix on the **Title** in any of its mirror locations — filename/dirname, H1, or inline list-line. On the next applicable command, md-issue acts on the intent and removes the directive from the source. **Directives** cascade: a **Task** carrying `>> EPIC` will push as an **Epic**, after which its child **Items** are created as **Issues**, and so on. Closing an **Issue** is NOT a **Directive** — it's a **Status** change (set the **Status** char to whatever maps to "Done"/"Closed").

## Example dialogue

> **Dev:** I'm going to promote this task to its own file so I can write a longer description.
>
> **Lead:** That just changes its form from inline to file — it's still a task until you push it.
>
> **Dev:** And if I want it tracked in Jira I add a `>> ISSUE` directive — that makes it an issue on the next push.
>
> **Lead:** Right. But until push actually succeeds and a key comes back, it's still a task with a directive on it. Same goes for `>> EPIC` — an epic-to-be is a task, not an epic.

