# Issues

This is an index of all `issues` in the project.

It's also a scratch pad for structuring work and breaking them out into files / dirs / issues.

By default, in this file, all `items` are `tasks`.

It's possible for issues to exist in-line as a todo item, e.g.

- [ ] FE-123 Do something cool
  ## That can have its own formatting
  As long as the text is aligned with the same minimum indent as the issue title.

  And the issue can have sub-tasks in-line too...

  - [ ] FE-124 First do one thing
    With a simple description (inline with list item). This item is already synced to JIRA.
  
  This text is ignored, because it's not a list item.

  - [ ] Then do another
    This description belongs to 'Then do another', because it's indented to be inline with it

  - then the second to last thing
  - also, don't forget to do this thing
  
  And some issues can be extract into files of their own, and then links are shown instead:
  - [ ] [XX-123 My Issue](./[x]%20XX-123%20My%20Issue.md)
    Text here is ignored (lint generates a warning) because the issue content is in another file

- foo