![todoist-shortcuts logo](src/icon128.png)

**todoist-shortcuts** is a browser extension or greasemonkey script which adds a
bunch of keyboard shortcuts to [Todoist](https://todoist.com). Along with this
repository, it is also available from the following places:

* [ Extension for Google Chrome
    ![Chrome Users](https://img.shields.io/chrome-web-store/users/dehmghpdcahlffompjagejmgbcfahndp.svg)
  ](https://chrome.google.com/webstore/detail/todoist-shortcuts/dehmghpdcahlffompjagejmgbcfahndp)

* [ Extension for Mozilla Firefox
    ![Firefox Users](https://img.shields.io/amo/users/todoist-shortcuts.svg)
    ![Firefox Rating](https://img.shields.io/amo/rating/todoist-shortcuts.svg)
  ](https://addons.mozilla.org/en-US/firefox/addon/todoist-shortcuts/)

These keyboard shortcuts are directly inspired by the shortcuts used for GMail,
which, in turn were inspired by vim-like keyboard interaction. I highly
recommend enabling the advanced keyboard shortcuts if you use GMail.

So, if the choices of keypresses seem strange, stick with it! Many of
the keypresses used here can also be used in GMail or even vim (or,
better yet, [evil-mode] ;) ).

[evil-mode]: https://github.com/emacs-evil/evil

# Keyboard shortcuts guide sheet

[**See this printable shortcuts guide**][google-sheet], created by
[kimaero] (see [#71]).  This guide can also be brought up while using
Todoist by pressing `?`.

[google-sheet]: https://docs.google.com/spreadsheets/d/1AGh85HlDze19bWpCa2OTErv9xc7grmMOMRV9S2OS7Xk
[kimaero]: https://github.com/kimaero
[#71]: https://github.com/mgsloan/todoist-shortcuts/issues/71

# Keyboard shortcut details

## Add tasks

| keys | action                                 |
|------|----------------------------------------|
| `q`  | Add task                               |
| `a`  | Add new task at the bottom of the list |
| `A`  | Add new task at the top of the list    |

See the "Task Quick Add shortcuts" section of [todoist's keyboard shortcuts
documentation](https://support.todoist.com/hc/en-us/articles/205063212) for
information about shorthands to use when adding tasks.  "Adding or editing
tasks" is also a good section to read, which includes keyboard shortcuts not
described in this document.

## Navigation

| keys           | action                                                                |
|----------------|-----------------------------------------------------------------------|
| `j` or `down`  | move cursor down                                                      |
| `k` or `up`    | move cursor up                                                        |
| `h` or `left`  | collapse nested at cursor                                             |
| `l` or `right` | expand nested at cursor                                               |
| `^`            | move cursor to first task                                             |
| `$`            | move cursor to last task                                              |
| `{`            | move cursor up to first section task                                  |
| `}`            | move cursor down to next section                                      |
| `/` or `f`     | focus search input                                                    |
| `g`            | enter section navigation mode                                         |
| `shift+g`      | navigate to task's project, or select in agenda if already on project |
| `` ` ``        | select the next top section (including favorites)                     |
| `~`            | select the previous top section (including favorites)                 |

In "section navigation mode", the different selections in the left
pane are annotated with the keys to press to navigate to that
section. Sometimes the sidebar can have more than a screenful of
content. While in this mode, you can scroll the left pane down and up
with `space` and `shift+space`. For smaller scrolling jumps, you can
also use up arrow and down arrow.

When projects have sub-projects, they are automatically expanded when the
project is selected from the list. To collapse the sub-projects, just use
navigation mode to select the same project again.

## Manipulation of tasks at cursor

| keys                       | action                                                   |
|----------------------------|----------------------------------------------------------|
| `enter`                    | edit task at cursor                                      |
| `o`                        | add task after cursor                                    |
| `shift+o`                  | add task before cursor                                   |
| `i`                        | open task side panel (see [side panel section][], below) |
| `c`                        | open comments for task at cursor                         |
| `shift+r`                  | open reminders for task at cursor                        |
| `+`                        | open assign dialog for task at cursor                    |
| `shift+j` or `shift+down`  | move task at cursor downwards                            |
| `shift+k` or `shift+up`    | move task at cursor upwards                              |
| `shift+l` or `shift+left`  | dedent task at cursor                                    |
| `shift+h` or `shift+right` | indent task at cursor                                    |
| `shift+c`                  | clicks [toggl][] or [clockify][] time tracking button    |
| `ctrl+c`                   | copy title and url of task(s) in markdown format         |
| `ctrl+,`                   | copy task title(s)                                       |
| `ctrl+shift+,`             | copy task url(s)                                         |


Note that there are some known bugs related to task motion - see
[#27](https://github.com/mgsloan/todoist-shortcuts/issues/27) and
[#29](https://github.com/mgsloan/todoist-shortcuts/issues/29).

`shift+c` clicking of time tracking buttons supports both the
[toggl-button extension][toggl] and [clockify extension][clockify].

[toggl]: https://toggl.com/toggl-button/
[clockify]: https://chrome.google.com/webstore/detail/clockify-time-tracker/pmjeegjhjdlccodhacdgbgfagbpmccpe
[side panel section]: #task-side-panel

## Selection

| keys                     | action                                |
|--------------------------|---------------------------------------|
| `x`                      | add task at cursor to selection       |
| `* a`                    | select all tasks                      |
| `* n` or `escape`        | clear selection                       |
| `* 1`                    | add all priority 1 tasks to selection |
| `* 2`                    | add all priority 2 tasks to selection |
| `* 3`                    | add all priority 3 tasks to selection |
| `* 4` or `* 0`           | add all priority 4 tasks to selection |
| `* h` or `* left-arrow`  | collapses all tasks                   |
| `* l` or `* right-arrow` | expands all tasks                     |

## Manipulation of selected items

If none are selected, then these will apply to the cursor instead.

| keys       | action                            |
|------------|-----------------------------------|
| `t`        | schedule                          |
| `T`        | schedule by editing text          |
| `alt+t`    | open time-of-day scheduler        |
| `d`        | done: mark task as complete       |
| `e` or `#` | delete                            |
| `&`        | duplicate                         |
| `v`        | move to project via search prompt |
| `@` or `y` | open label dialog                 |
| `1`        | set priority to 1                 |
| `2`        | set priority to 2                 |
| `3`        | set priority to 3                 |
| `4` or `0` | set priority to 4                 |

Deleting a task via `e` or `#` is fairly similar to marking it
complete via `d`.  Here are the differences:

1. Deleting a child task (nested under another task), it will be
   removed from the list. Completing a child task will mark it
   complete, but it will stay in the list.

2. Deleting a Recurring Task (e.g. every day) will cause the task to
   no longer be scheduled.

## Scheduling

When scheduling is opened via `t`, the following keybindings will apply:

| keys                    | date                                      |
|-------------------------|-------------------------------------------|
| `c`                     | today (mnemonic is "current day")         |
| `t`                     | tomorrow                                  |
| `w`                     | next week                                 |
| `p` or `s`              | postpone (recurring tasks)                |
| `r`                     | remove                                    |
| `backspace` or `delete` | clear and focus text date entry           |
| `enter`                 | focus text date entry without clearing it |
| `alt+t`                 | open time of day scheduler                |
| `escape`                | exit scheduling                           |

The "Smart Scheduler" is opened by pressing `s` when scheduling
multiple items. Currently there are only two keybindings for the smart
scheduler: `enter` to apply the choices, and `escape` to cancel.

## Sorting

When viewing the inbox or a project, the following keybindings can be used to
sort the tasks:

| keys | sorted by        |
|------|------------------|
| `s`  | Sort by date     |
| `p`  | Sort by priority |
| `r`  | Sort by assignee |
| `n`  | Sort by name     |

## Bulk reschedule mode

| keys           | action                               |
|----------------|--------------------------------------|
| `* t`          | enter bulk reschedule mode           |
| `v` or `alt+v` | switch to bulk move mode (see below) |
| `escape`       | exit bulk reschedule mode            |

Once bulk reschedule mode is entered, it will repeatedly bring up the reschedule
dialog until there are no more tasks after the cursor.  All of the normal cursor
navigation keys can be used while in this mode.

## Bulk move mode

| keys     | action                                     |
|----------|--------------------------------------------|
| `* v`    | enter bulk move mode                       |
| `alt+t`  | switch to bulk reschedule mode (see above) |
| `escape` | exit bulk move mode                        |

Once bulk move mode is entered, it will repeatedly bring up the move-to-project
dialog until there are no more tasks after the cursor. By holding down `alt`,
you can use the normal cursor navigation keys in this mode.

## Task side panel

NOTE: Some shortcuts may only work in the english translation, as the
DOM structure chosen by Todoist for this part of the UI has obfuscated
IDs.

The task side panel can be opened for the task under the cursor by
pressing `i`. Once the side panel is visible, you can use the
following shortcuts:

| keys            | action                     |
|-----------------|----------------------------|
| `i` or `escape` | close the task side panel  |
| `h`             | navigate to parent task    |

The rest of the bindings match the shortcuts used in other contexts.
Listed here for completeness:

| keys              | action                                                                    |
|-------------------|---------------------------------------------------------------------------|
| `d`               | done: mark task as complete                                               |
| `q` or `a` or `A` | add a subtask                                                             |
| `t`               | schedule                                                                  |
| `v`               | move to project via search prompt                                         |
| `y` or `@`        | open label dialog                                                         |
| `1`               | set priority to 1                                                         |
| `2`               | set priority to 2                                                         |
| `3`               | set priority to 3                                                         |
| `4` or `0`        | set priority to 4                                                         |
| `shift+r`         | open reminders                                                            |
| `+`               | open assignee dialog                                                      |
| `e`               | archive                                                                   |
| `#`               | delete                                                                    |
| `shift+c`         | clicks [toggl-button (time tracking integration extension)][toggl-button] |

## Other

| keys                   | action                                                 |
|------------------------|--------------------------------------------------------|
| `u` or `z` or `ctrl+z` | undo                                                   |
| `f` or `/`             | open search                                            |
| `shift+enter`          | clicks first link in the task the cursor is on         |
| `ctrl+s`               | manually synchronize state with server                 |
| `?`                    | display [keyboard shortcuts guide sheet](google-sheet) |
| `!`                    | open notifications                                     |
| `ctrl+k`               | open Todoist command pallette                          |
| `ctrl+shift+/`         | open random task from current view                     |

Note that undo only works when the "UNDO" button is visible at the bottom of the
screen. Some actions are not undo-able, such as [deletion or archiving multiple
tasks](https://github.com/mgsloan/todoist-shortcuts/issues/23)

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

# `todoist-shortcuts` in [electron] application

This repository provides browser extentions for both Chrome and Firefox, and
therefore augments the browser's web client of Todoist. If you wanted the
`todoist-shortcuts` in the standalone Todoist desktop application it is not as
easy/straight-forward. The following article and associated repository outline
how you can achieve such a solution:

- https://kevinjalbert.com/todoist-with-keyboard-navigation-via-nativefier/
- https://github.com/kevinjalbert/todoist-shortcuts-nativefier

An alternative approach, suggested [here][#62], is to use [google
chrome's "open as window"
functionality](https://www.howtogeek.com/403399/how-to-make-chrome-open-as-window-shortcuts-now-that-google-killed-them/).

[electron]: https://electronjs.org/
[#62]: https://github.com/mgsloan/todoist-shortcuts/issues/62

# Development

Contributions are appreciated. See [development.md](./development.md) for more
information about development.

# Supported by bounty from Doist company

Much of the work on this has been kindly supported by Amir Salihefendic of Doist
company. They're awesome!

In response to a ["Need a way of buying beer"][] issue, I've created a
"Buy Me a Coffee" account.  If you feel the urge to show some
appreciation for this project, feel free to send me a few dollars. If
not, that's fine too, I hope you enjoy using todoist-shortcuts :)

["Need a way of buying beer"]: https://github.com/mgsloan/todoist-shortcuts/issues/45

<a href="https://www.buymeacoffee.com/mgsloan" target="_blank"><img src="https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png" alt="Buy Me A Coffee" style="height: auto !important;width: auto !important;" ></a>
