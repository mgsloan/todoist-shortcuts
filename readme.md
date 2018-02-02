**todoist-shortcuts** is a browser extension or greasemonkey script which adds a
bunch of keyboard shortcuts to [Todoist](https://todoist.com). Along with this
repository, it is also available from the following places:

* [Extension for chrome](https://chrome.google.com/webstore/detail/todoist-shortcuts/dehmghpdcahlffompjagejmgbcfahndp)

* [Extension for firefox](https://addons.mozilla.org/en-US/firefox/addon/todoist-shortcuts/)

# Keyboard shortcuts

## Add tasks

| keys | action                                 |
| ---  | ---                                    |
| `q`  | Add task                               |
| `a`  | Add new task at the bottom of the list |
| `A`  | Add new task at the top of the list    |

See the "Task Quick Add shortcuts" section of [todoist's keyboard shortcuts
documentation](https://support.todoist.com/hc/en-us/articles/205063212) for
information about shorthands to use when adding tasks.  "Adding or editing
tasks" is also a good section to read, which includes keyboard shortcuts not
described in this document.

## Navigation

| keys           | action                           |
| ---            | ---                              |
| `j` or `down`  | move cursor down                 |
| `k` or `up`    | move cursor up                   |
| `h` or `left`  | collapse nested at cursor        |
| `l` or `right` | expand nested at cursor          |
| `/` or `f`     | focus search input               |
| `g`            | enter section navigation mode    |

In "section navigation mode", the different selections in the left pane are
annotated with the key to press to navigate to that section.  "Inbox" always
uses the key `i`, "Today" always uses the key `t`, "Next 7 days" always uses
the key `n`.

Currently, up to 33 projects can be jumped to with this mechanism.  Sometimes
this is more than can fit in a screenful.  While in "section navigation mode",
you can scroll the left pane down and up with `space` and `shift+space`.

## Manipulation of tasks at cursor

| keys                       | action                        |
| ---                        | ---                           |
| `enter`                    | edit task at cursor           |
| `o`                        | add task after cursor         |
| `shift+o`                  | add task before cursor        |
| `shift+j` or `shift+down`  | move task at cursor downwards |
| `shift+k` or `shift+up`    | move task at cursor upwards   |
| `shift+l` or `shift+left`  | dedent task at cursor         |
| `shift+h` or `shift+right` | indent task at cursor         |

## Selection

| keys   | action                                |
| ---    | ---                                   |
| `x`    | add task at cursor to selection       |
| `* a`  | select all tasks                      |
| `* n`  | clear selection                       |
| `* 1`  | add all priority 1 tasks to selection |
| `* 2`  | add all priority 2 tasks to selection |
| `* 3`  | add all priority 3 tasks to selection |
| `* 4`  | add all priority 4 tasks to selection |

## Manipulation of selected items

If none are selected, then these will apply to the cursor instead.

| keys   | action                            |
| ---    | ---                               |
| `t`    | schedule                          |
| `d`    | done: mark task as complete       |
| `e`    | archive                           |
| `m`    | move to project via search prompt |
| `#`    | delete                            |
| `1`    | set priority to 1                 |
| `2`    | set priority to 2                 |
| `3`    | set priority to 3                 |
| `4`    | set priority to 4                 |

## Scheduling

When scheduling is opened via `t`, the following keybindings will apply:

| keys   | date         |
| ---    | ---          |
| `t`    | tomorrow     |
| `n`    | today        |
| `w`    | next week    |
| `m`    | month        |
| `r`    | remove       |

## Sorting

When viewing the inbox or a project, the following keybindings can be used to
sort the tasks:

| keys | sorted by        |
| ---  | ---              |
| `s`  | Sort by date     |
| `p`  | Sort by priority |
| `r`  | Sort by asignee  |

## Other

| keys       |             |
| ---        | ---         |
| `u`        | undo        |
| `f` or `/` | open search |

## Development

Contributions are appreciated. See [development.md](./development.md) for more
information about development.

## Supported by bounty from Doist company

See [this github thread](https://github.com/rohitpaulk/todoist-tribute/issues/5)
for context. The initial work on this was kindly supported by Amir Salihefendic
of Doist company.
