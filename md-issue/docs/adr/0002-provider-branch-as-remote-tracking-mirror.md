# Provider Branch as a remote-tracking mirror

Each configured **Provider** has its own local git branch (`md-issue/<provider-name>`) that mirrors the provider's state in the same markdown representation md-issue uses everywhere. `pull` writes fetched provider state into this branch as a new commit, then merges it into the working branch (stash → rebase → unstash); `push` advances this branch after a successful sync and refuses to run if the working branch is behind it. We picked this over fetching state directly into the working tree because it lets us reuse git's three-way merge tooling, IDE conflict-marker UX, and rollback semantics for the entire sync workflow — instead of inventing a parallel mechanism.

## Considered Options

- **Provider Branch (chosen).** A `md-issue/<provider-name>` branch acts like a remote-tracking ref. The working tree never sees a partial provider snapshot; conflicts surface as normal git conflicts on merge.
- **Fetch-into-working-tree, with in-app conflict resolution.** Pull writes provider state directly into the working files and md-issue presents its own conflict UI. Rejected: re-implements git, hostile to existing tooling, and offers no audit trail of what came from where.
- **No provider state tracking at all.** Push optimistic-locks against provider versions only; pull writes straight to working tree without history. Rejected: there's no way to tell "what's new since I last looked," which makes selective merge impossible.

## Sync watermark

Delta sync uses the timestamp of the latest commit on the **Provider Branch** as the "fetch updates since X" watermark — no separate state file. Deletions are detected by a same-call ID-list reconciliation on every pull, not a periodic full re-fetch.

## Deferred related decisions

- **Clock-skew handling.** If "use latest commit timestamp" turns out to be vulnerable to clock skew between local and provider clocks, switch to the *second-most-recent* commit's timestamp and discard the deltas from the most recent one on the next pull. Revisit if duplicates or missed updates appear in practice.
