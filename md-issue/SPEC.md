# MD Issue

This is to be a command line tool for syncing issues in issue trackers like Jira or GitHub with markdown files.

Supported `IssueProviders`:
- GitHub
- Jira

Technology:
- `bun`: the CLI platform
- `typescript`: the implementation language
- `git`: the diff engine used to detect changes and their intention.
- `markdown`: the syntax for issue files

This tool will maintain a dir structure of `markdown` files that two-way sync to issues in supported issue trackers.

The goal is to be able to fluidly structure work items / issues without needing to use a CLI to create / transition issues.
- create file = create new issue / epic
- create dir = create new epic
- create file in dir = create new issue in epic
- file / dir has tag prefix, e.g. `XX-123` then it exists in Jira
- file / dir does NOT have an issue key, e.g. `XX-123` then it does not exist in Jira and needs to be created


# Terminology

An `item` is a line which contains a markdown list item, prefixed with a `[ ]`, indicating a task to be done.

Example format:
```
- [ ] <item-title>
  <item-description>
```

There can be two kinds of `item`:

A `task` is an `item` that is local only and:
  - will not be sync'd to the `IssueProvider` on `push`
  - it does not have an `issue-key`

An `issue` is an `item` that is synced with the `IssueProvider` and:
  - will be created / updated in the `IssueProvider` on `push`
  - gets an `issue-key`.
  - in its markdown, `item`s in an `issue` are `task`s by default

An `epic` is an `issue` that:
  - corresponds to an `epic` `issue-type` in `IssueProvider` (if relevant)
  - in its markdown, `item` in an `epic` are `issue`s by default

# Formats

There are three ways an `item` can live:
- `inline` as an `item` in a markdown file
- `file` as its own markdown file, whose filename is the `item`'s title
- `dir` as a dir whose name is the `item`'s title', and an `index.md` that contains the `item` content

# Directives 

Are suffixes to an `item` formatted as `>> <COMMAND>`.

They give instructions to CLI tasks to perform in their next run.

Once completed, they remove themselves from the `item` text.

## Types of directives

`>> FILE`:
Force `lint` to break this `item` out into a `item-file`.

Creates a new `item-file` for the `item` with file name matching `item` first line.
Content related to the `item` is copied to the `item-file`.
The `item` itself and its content is replaced with into a link to the `item-file`.

`>> DIR`: 
Force `lint` to break this `item` out into a `item-dir`.

Creates a new `item-dir` for the `item` with the dir name matching the `item` first line.
Createa a new `item-file` for the `item` in the `item-dir` called index.md with the title matching the `item` first line.
Content related to the `item` is copied to the `item-dir`'s index file.
The `item` itself and its content is replaced with into a link to the `item-dir`'s index file'.

`>> ISSUE`:
For a `task`: force `push` to treat it as a new `issue`, creating it in `IssueProvider`:
  - with the default `project-key`
  - with the default `issue-type`

For an `issue`: does nothing

`>> <issue-type>`:
Syncs `task` to `IssueProvider`, creating it:
  - with the default `project-key`
  - with the specified `issue-type`
  - for an `issue`: do nothing

`>> <project-key>`:
Same as `>> ISSUE` but with the project specified by `<project-key` 
  - for an `issue`: if `<project-key>` is different to the one in the `IssueProvider`, move this ticket to that project

## Commands

### `lint`
`lint` keeps the file structure organized and up-to-date. 
Parses the detected changes in `git` and keeps related information in sync.
E.g. if I change status of an `item` in `index.md` then it ensures all other statuses are updated.
  - "linted" changes are staged in `git`
  - "unlinted" changes remain unstaged until the `lint` command has checked them

## Issue Key
Each issue file / dir is prefixed with an `IssueProvider` `issue-key`, e.g. `FE-123` which is used to map the file / dir to the corresponding issue in the `IssueProvider`.

The absence of an `issue-key` indicates that the issue is new, and should be created in the `IssueProvider`.

Once an `issue` has an `issue-key` it doesn't lose it.

`pull`: used to identify the file / dir corresponding to the issue
`push`: when the new `issue-key` is returned by the `IssueProvider` it should be used to prefix the file / dir.
`lint`: ensure each `issue-key` is only used exactly once

## Issue Status / Resolution
Each issue file / dir has a `status-prefix` formatted `[<status_char>] ` (e.g. `[x]`) to indicate `status`. 

The config declares a mapping between a `status-char` and the `status` in the `IssueProvider`, e.g.
```
_: backlog
p: planning
-: in-progress
r: in-review
x: done
```

And they are used in the prefix to indicate `status`.

An empty `[ ]` prefix indicates the default `status` that the issue would be created with in the `IssueProvider`.

The absence of a `[ ]` prefix is not an error, it just maps to the default status.

`pull`:
- if status changed remotely, but not locally, then update local
- if changed remotely and locally, then resolve as a get merge conflict
`push`: 
- if changed locally, but not remotely then update remote
- if changed locally and remotely, then resolve as a git merge conflict
`lint`: 
- if the `[ ]` prefix doesn't exist, it's added.

## Issue Sorting & Priority
Issue files / dirs can be optionally sorted with a formatted `index` (e.g. `1. `) before the issue key, e.g.
```
[ ] 1. KF-554 My Priority Issue.md
```
In this case the `index` is `1` and naturally gets ordered at the top of a list of files / dirs by the file system.

The `index` can be any single character.

This is mainly to allow the user to order tasks locally, but:

This can optionally be used by the `IssueProvider` to order issues, e.g. in a kanban board or list, if supported.

The config optionally can also map `index` to a specific `priority` in the `IssueProvider`, e.g.
```
0: Immediate
1: Urgent
2: High
*: Normal          // a wildcard for unmatched or unset index values
_: Low
```

## Example Directory Structure
An example directory structure can be found at `root/`.

Here is a summary of the ways in which files / dirs can be structured

````
<root>/
  [ ] XX-123 My Issue.md                                  An issue
  [ ] EE-323 My Epic.md                                   An epic (single file format, type: epic in frontmatter)
  [ ] EE-323 My Epic/                                     An epic (dir format)
    [ ] YY-442 My Epic Issue.md                           An issue belonging to epic
    [ ] 1. YY-443 My Epic Issue with priority.md          An issue belonging to epic with an order
    [ ] YY-442 My Epic Issue.md                           An issue belonging to epic
````