# todoist-shortcuts changelog

## Version 42 ##

### Enhancements ###

* Keyboard shortcuts now work in todoist iframes.  In particular,
  todoist-shortcuts can now be used along with the [Todoist for
  Gmail](https://chrome.google.com/webstore/detail/todoist-for-gmail/clgenfnodoocmhnlnpknojdbjjnmecff?hl=en).


## Version 41 ##

### Bug fixes ###

* Fixed a bug where cursor movement would select collapsed tasks.


## Version 40 ##

### Enhancements ###

* When scheduling a recurring task, `s` now postpones the task.


## Version 39 ##

### Bug fixes ###

* Workaround for an issue where moving / indenting / dedenting a task
  causes the window to scroll up a bit. See [#58].

* Removes note about task indenting not working, as it seems to no
  longer be a problem. See [#50]

[#58]: https://github.com/mgsloan/todoist-shortcuts/issues/58
[#50]: https://github.com/mgsloan/todoist-shortcuts/issues/50


## Version 38 ##

### Bug fixes ###

* On initial login, there was some lag for the theme to be
  applied. This caused the background color for navigation tips to be
  wrong. This version fixes this problem.

* Makes it so that scheduling via text entry (`T`) can work with
  multiple tasks selected. See [#24].

[#24]: https://github.com/mgsloan/todoist-shortcuts/issues/24


## Version 37 ##

### Bug fixes ###

* Fixes scheduling of unscheduled tasks. See [#56]

[#56]: https://github.com/mgsloan/todoist-shortcuts/issues/56


## Version 36 ##

### Enhancements ###

* When scheduling multiple items, `s` now opens the smart
  scheduler. Within the smart scheduler, `enter` applies the updates,
  and `escape` cancels. See [#53]

[#53]: https://github.com/mgsloan/todoist-shortcuts/issues/53

### Bug fixes ###

* Fix a crucial bug where most actions weren't working. Adapts to
  changes that affect finding Todoist menus.

* Fixes / improves rescheduling of a single task.

* Fixes updating of internal `viewMode` variable on initial load,
  likely due to slight changes in Todoist behavior. Without this fix,
  some functions might not work until after navigation.


## Version 35 ##

### Enhancements ###

* When navigating to a project / label / filter that is not visible
  due to collapsed parents, the project will now be made visible.


## Version 34 ##

### Enhancements ###

* Improves support for new scheduler added in Todoist
  version 925. This scheduler was previously available on
  beta.todoist.com, and so both schedulers were supported. Since the
  old scheduler no longer exists, support for it has been removed.

* Bump to Todoist version 925


## Version 33 ##

### Enhancements ###

* Documents that task indentation is currently broken, and that task
  motion in general is fiddly. See [#50].

* When navigating to a project that has sub-projects that are
  collapsed, always expands the listing and continues with navigation
  mode. As a side effect, this nicely adapts to a behavior change
  included in Todoist version 908, which allows toggling between
  seeing all sub-projects or just the one parent project. When using
  keyboard bindings, you will now only encounter the first mode,
  rather than arbitrarily toggling between the modes.

* Bump to Todoist version 924

[#50]: https://github.com/mgsloan/todoist-shortcuts/issues/50

### Bug fixes ###

* Fixes an issue with moving the cursor between multiple projects,
  when viewing a parent project. It wouldn't change which project is
  considered to be focused, and so actions like sorting by priority
  would apply to the wrong project.

* When inserting new tasks or editing tasks, the cursor position after
  editing would often be surprising. I believe this is due to Todoist
  behavior changes. However, happily the new behavior allows this
  mechanism to be much more reliable.


## Version 32 ##

### Enhancements ###

* Adds a binding, `G`, to navigate to task's project, or select in
  agenda if already on project.

* Bump to Todoist version 920


## Version 31 ##

### Bug fixes ###

* Fixes a really bad bug with the extension on FireFox, where original
  Todoist keybindings wouldn't work, and even many browser keybindings
  wouldn't work. See [#46]

* Fixes use of `ctrl+z` on FireFox.

[#46]: https://github.com/mgsloan/todoist-shortcuts/issues/46


## Version 30 ##

### Enhancements ###

* Keybindings for interacting with text entry of new scheduler on
  https://beta.todoist.com :

    - `backspace` or `delete` clears and focuses the text date entry.

    - `enter`focuses the text date entry without clearing it.

* Also in the new scheduler mode, `s` is now a shortcut for using the
  "suggested" date.

* Bump to Todoist version 919

### Bug fixes ###

* Fixes `enter` binding to edit task text, which seems to have broken
  with updates in Todoist 919. Easy fix, though!


## Version 29 ##

### Bug fixes ###

* Fix behavior of multi selection with new scheduler on
  https://beta.todoist.com .  See [#49].


## Version 28 ##

### Enhancements ###

* Updated to work with new scheduler visible on
  https://beta.todoist.com .  See [#49].

[#49]: https://github.com/mgsloan/todoist-shortcuts/issues/49


## Version 27 ##

### Enhancements ###

* `0` is now an alias for level 4 priority, the default priority. So,
  `0` and `4` do the same thing, as well as `* 0` and `* 4` for
  selecting tasks with default priority.

* In navigation mode, up / down arrows now scroll up / down a bit.

* Fixes navigation to favorite items, broken due to upstream changes
  of DOM structure.

* Fixes styling of navigation links, since they were being clipped,
  due to upstream CSS changes. I like this new approach better anyway,
  tightens up the tips.

* Bump to Todoist version 918.


## Version 26 ##

### Bug fixes ###

* Collapses nested tasks before moving up / down, makes task
  movement better behaved. See [#29]

[#29]: https://github.com/mgsloan/todoist-shortcuts/issues/29


## Version 25 ##

### Enhancements ###

* Adds '&' keybinding for task duplication.


## Version 24 ##

### Bug fixes ###

* Actual working fix to the bug where no cursor would be displayed
  for a custom filter like "today & p1".

* Fixes `h` and `l`, due to changes in class names used by
  Todoist.  See [this comment on #46][#46c2]

[#46c2]: https://github.com/mgsloan/todoist-shortcuts/issues/46#issuecomment-425962924


## Version 23 ##

### Bug fixes ###

* Attempted fix of a bug where no cursor would be displayed for a
  custom filter like "today & p1".


## Version 22 ##

### Bug fixes ###

* Fixes a bug where project navigation didn't work for some
  projects with emojis. See [#44]

* Fixes a bug where project navigation didn't work for favorite
  labels.  I suspect that this is due to a change in CSS class name
  between version 911 and 914.

[#44]: https://github.com/mgsloan/todoist-shortcuts/issues/44


## Version 21 ##

### Bug fixes ###

* Fixes original todoist keybindings `a` / `A` for adding tasks to the
  top / bottom of the list. See [#41]

* Fixes bug that prevented Todoist's ability to display a particular
  task within a listing. See [#42]

[#41]: https://github.com/mgsloan/todoist-shortcuts/issues/41
[#42]: https://github.com/mgsloan/todoist-shortcuts/issues/42


## Version 20 ##

### Bug fixes ###

* The most recent bugfix release broke some keybindings.  This
  release has a bugfix that works around [mousetrap#430].

[mousetrap#430]: https://github.com/ccampbell/mousetrap/issues/430


## Version 19 ##

### Bug fixes ###

* Fixes a bug where it didn't function at all on Firefox, for
  puzzling reasons related to the keypress event handler. See [#40].

* Moving tasks up and down via `shift-j` / `shift-k` now works in agenda
  mode (today / next 7 days). I believe this was enabled by a change in
  Todoist behavior.

* Fix a bug where moving a task left would sometimes move the task into
  a project. See [#39].

[#39]: https://github.com/mgsloan/todoist-shortcuts/issues/39
[#40]: https://github.com/mgsloan/todoist-shortcuts/issues/40


## Version 18 ##

### Enhancements ###

* Adds support for manual sync via `ctrl+s`. See [reddit thread].

* Adds use of backtick and shift+backtick to cycle through top
  level filters (inbox / today / next 7 days + favorites). This is
  the same keybinding that GMail uses for a similar purpose.

* Adds support for sorting by name via `n`. See [#36]

[reddit thread]: https://www.reddit.com/r/todoist/comments/92j1qz/todoistshortcuts_browser_extension_adding/e3a2kbt/
[#36]: https://github.com/mgsloan/todoist-shortcuts/issues/36


## Version 17 ##

### Enhancements ###

* Adds support for clicking the first link in a task via
  shift+enter. See [#33].

* Bump to Todoist version 911.

### Bug fixes ###

* Fixes scheduling actions and navigation to inbox / today / next
  7 days, which no longer worked due to dom updates in Todoist
  version 911.

[#33]: https://github.com/mgsloan/todoist-shortcuts/issues/33


## Version 16 ##

### Enhancements ###

* Adds support for cursor navigation while in bulk move and bulk
  reschedule mode. Also allows switching between these two bulk
  modes.

* Adds an internal function for clicking the "import from tempalte" menu
  item.  To avoid binding everything to keys, there is no default
  keybinding for this.  However, if you modify the code for the
  extension then you can use it.  See [#30].

* Bump to Todoist version 910.

### Bug fixes ###

* No longer attempts to reselect tasks after priority change as this
  triggers a bug. See [#32].

* Fixes a display bug for the navigate mode tips for toggling project /
  label / filter sections. See [#34].

* Fixes a bug where escape would not exit bulk move mode.

[#30]: https://github.com/mgsloan/todoist-shortcuts/issues/30
[#32]: https://github.com/mgsloan/todoist-shortcuts/issues/32
[#34]: https://github.com/mgsloan/todoist-shortcuts/issues/34


## Version 15 ##

* Keyboard events not handled by todoist-shortcuts now get passed
  along to Todoist. See
  [#25](https://github.com/mgsloan/todoist-shortcuts/issues/25).

* Now supports navigation to favorite filters / labels. See
  [#31](https://github.com/mgsloan/todoist-shortcuts/issues/31).


## Version 14 ##

* Bump to Todoist version 908. This version of the extension fixes
  issues with todoist-shortcuts due to some recent changes of
  todoist's DOM structure.

* Improved reliability of task motion commands.

* Adds 'c' keybinding for opening comment dialog.


## Version 13 ##

* Enter can now be used to confirm deletion.

* Pressing escape will now exit out of inline task adding.

* Change "remove label" keybinding to use `@` instead of `l`.  The old
  keybinding shadowed the expand + navigate in keybinding.

* Cursor is now visible in filters and labels! See
  [#14](https://github.com/mgsloan/todoist-shortcuts/issues/14).

* Bump to Todoist version 907.


## Version 12 ##

* Removed some warnings which can occur during normal operation
  (particularly when no tasks are visible). Warnings that can happen
  during normal operation should only happen when the action can not be
  performed for some reason, and should be reasonably human readable.


## Version 11 ##

* Fixed icons


## Version 10 ##

* Due to Todoist making some changes to their code, it is now possible
  to use todoist-shortcuts with languages other than english.
  See [#2](https://github.com/mgsloan/todoist-shortcuts/issues/2)

* In navigate mode, `t` is no longer used to navigate to "Today",
  instead `g` is used. The main reason for this is that in navigate
  mode, it is now possible to use `tp` / `tl` / `tf` to toggle the
  different sections. These would not have b These would not have been
  typeable if `t` was taken. This also makes it a little faster to
  navigate to the commonly used "Today" section.

* Now supports navigating to labels and filters. See
  [#3](https://github.com/mgsloan/todoist-shortcuts/issues/3)

* In navigation mode, selecting a project with collapsed sub-projects will
  cause them to expand. To collapse, just re-select the same project.

* Adds `* l` and `* h` to expand or collapse all task nesting. See
  [#18](https://github.com/mgsloan/todoist-shortcuts/issues/18)

* `?` shortcut for keyboard shortcuts help now links to the readme for
  that particular release, rather than master.

* Typing "x" in an input field no longer toggles selection. See
  [#15](https://github.com/mgsloan/todoist-shortcuts/issues/15)

* There was a bug where after editing a task, the task before it would end
  up selected. This is now fixed. See
  [#9](https://github.com/mgsloan/todoist-shortcuts/issues/9)

* Some Todoist internals are now directly invoked, to handle
  selection more efficiently. See
  [#11](https://github.com/mgsloan/todoist-shortcuts/issues/11)

* Previously key sequences like `* a` required that you not delay more
  than 1 second between keystrokes, due to behavior in the
  [mousetrap](https://github.com/ccampbell/mousetrap) library. This
  is no longer the case.

* Fixes an issue where typing `g` followed by some key that does nothing
  would cause the cursor to move down one.

* Scrolling behavior and cursor mouse behavior is now less glitchy.

* `ctrl+z` is now a synonym for undo.

* Adds `* t` keybinding to enter bulk reschedule mode.

* Adds `* v` keybinding to enter bulk move mode.

* Using `h` to collapse will now collapse the parent if the cursor
  is already collapsed

* Using `l` to expand will now move the cursor to the first
  sub-project.

* `x` can no longer be held down to do multiple selections.  This is due
  to key sequences like `jxjxjxjx` being glitchy.  There is a constant
  called `MULTISELECT` in the source that can be set to `true` to bring
  back the multiselection behavior.

* Bump to todoist version 904.


## Version 9 ##

* Bump to todoist version 893.  Fixes for things that changed.

* Only has noisy version mismatch if your todoist version is too old.

* Now also works on https://beta.todoist.com/app

* Adding tasks via `o` and `O` now works when cursor is on an overdue task
  in agenda view

* Fixes to issues with cursor position after task add. See
  https://github.com/mgsloan/todoist-shortcuts/issues/8

* Old scheduling binding for "n" removed, use "d" instead.


## Version 8 ##

* Now uses the standard drag-and-drop handle to indicate the cursor.

* 'x' can be held down to select / deselect every task the cursor is moved to.

* Vertical auto-scrolling now takes into account top bar occlusion.


## Version 7 ##

* Bump to todoist version 892.

* No longer has a noisy warning by default for version mismatch.

* "r" for sort by assignee now works.

* Scheduling keybinding for "today" is now "d" instead of "n".

* Now "move to project" is back to being "v" instead of "m".


## Version 6 ##

* Bump to todoist version 891.

* Defaults to allow applying done / archive directly to cursor. Issue #1

* Implements sorting keybindings. Issue #1

* Adds "^" and "$" keybindings for moving cursor to first and last task.

* Cursor is now stable even when task gets re-scheduled or moved.

* When navigate mode is activated ("g"), the left pane will now become
  visible even when the browser window is narrow and so in 'mini mode'.


## Version 5 ##

* Bump to todoist version 890.

* Have mismatch warning tell you which version was expected.


## Version 4 ##

* Last version was hastily released, this fixes "move to project" (release
  made minutes after the last one)


## Version 3 ##

* Now "move to project" is "m" instead of "v".


## Version 2 ##

* Most default todoist keybindings like 'u' for undo now work too.

* Fixes position of version mismatch warning when viewing more
than a screenful.

* No longer warns about potential mismatch with todoist version 889
