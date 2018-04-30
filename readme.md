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
| `^`            | move cursor to first task        |
| `$`            | move cursor to last task         |
| `/` or `f`     | focus search input               |
| `g`            | enter section navigation mode    |

In "section navigation mode", the different selections in the left pane are
annotated with the keys to press to navigate to that section. Sometimes the
sidebar can have more than a screenful of content. While in this mode, you can
scroll the left pane down and up with `space` and `shift+space`.

When projects have sub-projects, they are automatically expanded when the
project is selected from the list. To collapse the sub-projects, just use
navigation mode to select the same project again.

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

| keys  | action                                |
| ---   | ---                                   |
| `x`   | add task at cursor to selection       |
| `* a` | select all tasks                      |
| `* n` | clear selection                       |
| `* 1` | add all priority 1 tasks to selection |
| `* 2` | add all priority 2 tasks to selection |
| `* 3` | add all priority 3 tasks to selection |
| `* 4` | add all priority 4 tasks to selection |
| `* h` | collapses all tasks                   |
| `* l` | expands all tasks                     |

`x` works a bit different than all the other shortcuts. It can be held down, and
cursor navigation will cause selection or deselection of other tasks. It can be
convenient to hold down `x` and move the mouse over all the tasks you want to
select / deselect.

## Manipulation of selected items

If none are selected, then these will apply to the cursor instead.

| keys   | action                            |
| ---    | ---                               |
| `t`    | schedule                          |
| `d`    | done: mark task as complete       |
| `e`    | archive                           |
| `v`    | move to project via search prompt |
| `#`    | delete                            |
| `1`    | set priority to 1                 |
| `2`    | set priority to 2                 |
| `3`    | set priority to 3                 |
| `4`    | set priority to 4                 |

## Scheduling

When scheduling is opened via `t`, the following keybindings will apply:

| keys   | date         |
| ---    | ---          |
| `d`    | today        |
| `t`    | tomorrow     |
| `w`    | next week    |
| `m`    | in 1 month   |
| `r`    | remove       |

## Sorting

When viewing the inbox or a project, the following keybindings can be used to
sort the tasks:

| keys | sorted by        |
| ---  | ---              |
| `s`  | Sort by date     |
| `p`  | Sort by priority |
| `r`  | Sort by assignee |

## Other

| keys       |             |
| ---        | ---         |
| `u`        | undo        |
| `f` or `/` | open search |

# How to customize keyboard shortcuts

Ideally, there would be a UI for customizing keyboard shortcuts. However, it
seems like this would take a substantial amount of development effort
(PR contributions appreciated!). For now, you can do the following to customize
the keyboard shortcuts in Chrome:

1. Clone this repository (run `git clone https://github.com/mgsloan/todoist-shortcuts`)

2. Go to `chrome://extensions` in the url bar, and switch from the official
   version of todoist-shortcuts to a local version.

   - Disable the official version of todoist-shortcuts by unchecking "Enabled".

   - Click the "Developer mode" box in the top right if it is not yet checked.

   - Click the "Load unpacked extension..." button.  In the directory selecter
     navigate to the folder you cloned todoist-shortcuts to, and point it at the
     `src` sub-directory.

2. Edit `src/todoist-shortcuts.js` in a text editor.

   - You will probably just want to edit the definition of KEY_BINDINGS near the
     top.

   - To disable a keybinding, put `//` in front of it.

   - The functions in the section marked `Actions` are intended to be bound
     directly to keys.  You can also combine multiple actions via use of the
     `sequence` and `ifThenElse` action combiners.

   - Multiple key sequences can be bound to the same action by using a list of
     key sequences (like `['j', 'down']`) instead of a single string for it.
     The docs for [mousetrap](https://craig.is/killing/mice) may be helpful in
     figuring out how to express key sequences.

3. Use `ctrl+r` on `chrome://extensions`.  This causes the extension to be
   reloaded from your local files.

4. If you reload Todoist, you will now be using your modified version of the
   extension.

I'm sure there is a similar mechanism for Firefox, but I do not use it for
developing the extension, so not sure of the details.

One thing to note is that you will no longer receive automated updates.  To
update your locally modified extension, do the following:

1. `git stash` to store your changes.

2. `git pull` to fetch the most recent changes in this repository.

3. `git stash apply` to bring back your changes. This may cause merge conflicts.

See the git documentation.  A miscellaneous aside is that I highly recommend
[git from the bottom up](https://jwiegley.github.io/git-from-the-bottom-up/) as
a guide to understanding git's data model.

# Development

Contributions are appreciated. See [development.md](./development.md) for more
information about development.

# Supported by bounty from Doist company

Much of the work on this has been kindly supported by Amir Salihefendic of Doist
company. They're awesome!
