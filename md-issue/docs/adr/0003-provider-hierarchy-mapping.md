# Provider-specific hierarchy mapping

md-issue's three-level hierarchy (**Epic** → **Issue** → child **Items**) maps onto each **Provider**'s native data model differently, and the **Provider** adapter owns that translation. **Jira**: **Epics** are Issues with `issue-type = Epic`, child Issues use the native `parent` field, sub-tasks use sub-task issue-types. **GitHub**: **Epics** are GitHub Projects (v2), **Issues** are GitHub Issues added to the Project, and children of an Issue live as markdown task-list lines in the Issue body (rendered as a checklist by GitHub). A `>> ISSUE` **Directive** on one of those inline tasks promotes it to its own GitHub Issue, added to the same Project, with a back-link replacing the original task-list line.

We picked this over a uniform abstraction (e.g. label-based epics on GitHub, or GitHub sub-issues) because each provider's "natural" hierarchy renders best in its own UI: Projects give GitHub users the kanban/board view that's idiomatic for cross-issue planning, while inline task lists give Issue-internal subtasks first-class rendering without inflating the Issue count.

## Considered Options

- **Per-provider native (chosen).** Jira native Epic+parent; GitHub Projects + inline task lists.
- **Uniform sub-issue mapping.** Use GitHub's sub-issue feature for all hierarchy on GitHub. Rejected: ties md-issue to a feature that's still maturing on GitHub, doesn't give the cross-issue board view, and creates many small issues for what users think of as task-list items.
- **Label-based epic links.** Tag children with `epic/<n>`. Rejected: weak (no real hierarchy), pollutes labels, no board view.

## Open questions

- **GitHub Projects scope.** Projects can be repo-scoped, user-scoped, or org-scoped. Config picks where new Projects are created; default is repo-scoped if the **Provider** is configured against a single repo. Revisit if multi-repo Epic spans become a real use case.
- **Inline task ↔ Issue promotion details.** When `>> ISSUE` promotes an inline task to its own Issue, the original line is rewritten to `- [ ] #<new-issue-key> <title>` so the back-link survives. The exact rewrite format (e.g. whether to include status mirroring) is left for the SPEC.
