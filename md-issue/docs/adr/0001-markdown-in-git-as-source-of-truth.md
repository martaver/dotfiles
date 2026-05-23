# Markdown in git as the source of truth

md-issue keeps **Items** as markdown files in a git repository, and `lint` uses `git diff` between the working tree and the index to detect intentional changes to **Fields** and propagate them across mirror locations (filename, frontmatter, H1, inline line text). We picked this over a normalized-JSON baseline because the central value proposition is "filesystem IS the issue tracker" — rename a file = rename an issue — and moving the source of truth to JSON would re-introduce the same markdown-vs-canonical diff problem from the other direction while making `git diff` unreadable to users and editor tooling.

## Conflict localization

When `lint` (or a pull-driven merge) detects a multi-value conflict on a **Field** that has multiple mirror locations, conflict markers are written to **exactly one** in-file location — preferring the H1 (for **Title**) or the frontmatter (for everything else) — never the filename, since filename conflict markers would be unparseable. After the user resolves that single location, `lint` propagates the resolved value to the remaining mirrors.

## Considered Options

- **Markdown-in-git (chosen).** Markdown files are canonical. `lint` reconciles **Field** mirrors via `git diff` of the working tree against the index.
- **JSON-as-baseline.** Canonical state lives as normalized, sorted JSON in git; markdown is a projection. Deferred — adopt only if `lint` performance becomes a real bottleneck. The likely first step before going this far is a git-ignored `.md-issue/index.json` *read-cache* maintained by `lint`, which delivers fast lookups for editors and plugins without moving the source of truth.

## Deferred related decisions

- **Git-hooks integration** is intentionally not built yet. The current model is "user runs `md-issue lint` manually." Revisit once a concrete workflow case emerges (e.g. pre-commit enforcement, post-merge re-sync).
