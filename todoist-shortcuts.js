// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/*
// @include     http://todoist.com/*
// @version     1
// @grant       none
// ==/UserScript==

// Set timeout is a hack so that the mousetrap library will be in scope.
(function() {
  'use strict';

  // Here's where the keybindings get specified. Of course, feel free to modify
  // this list, or modify this script in general.
  var bindings = [

    // Navigation
    ['j', moveDown],
    ['k', moveUp],
    ['h', collapse],
    ['l', expand],
    // TODO [["g g", "ctrl+k"], switch_project],
    ['g i', goToInbox],
    ['g t', goToToday],
    ['g w', goToNext7],

    // Manipulation of tasks at cursor
    ['enter', edit],
    ['O', addAbove],
    ['o', addBelow],
    // TODO ["ctrl+right", indent],
    // TODO ["ctrl+left", dedent],

    // Selection
    ['x', toggleSelect],
    ['* a', [selectAll, cancelEmptyAdd]],
    ['* n', deselectAll],
    // NOTE: these are a bit different than gmail's "select unread" and similar,
    // as they add to the current selection. I think this is more useful.
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    ['* 4', selectPriority('4')],

    // Manipulation of selected items
    ['t', schedule],
    ['v', moveToProject],
    ['e', archive],
    ['#', deleteTasks],
    ['1', setPriority('1')],
    ['2', setPriority('2')],
    ['3', setPriority('3')],
    ['4', setPriority('4')],

    // Scheduling keybindings (requires schedule to be open)
    ['t', scheduleTomorrow],
    ['n', scheduleToday],
    ['w', scheduleNextWeek],
    ['m', scheduleNextMonth],
    ['r', unschedule]

    // Misc
    // TODO: ["?", show_keybindings]
  ];

  // Which selection-oriented commands to apply to the cursor if there is no
  // selection. A few possible values:
  //
  // * "none" - never apply selection oriented commands to the cursor
  //
  // * "most" - apply to all commands that are easy to manually undo (everything
  //   but archive and delete)
  //
  // * "all" (default) - apply to all selection-oriented commands
  //
  // FIXME: Implement
  // var WHAT_CURSOR_APPLIES_TO = 'all';

  // Set this to true to get more log output.
  var DEBUG = true;

  // Constants for various todoist ids, classes, and text. Non-exhaustive. TODO: make it exhaustive.
  var TODOIST_ROOT_ID = 'todoist_app';
  var EDIT_CLICK_CLASS = 'content';
  var ACTIONS_BAR_CLASS = 'item_selecter';
  var PROJECT_COMPLETE_CLASS = 'ist_complete_select';
  var ARROW_CLASS = 'arrow';
  var CALENDAR_CLASS = 'minical_container';

  var SCHEDULE_TEXT = 'Schedule';
  var MOVE_TEXT = 'Move to project';
  var ARCHIVE_TEXT = 'Archive';
  var DELETE_TEXT = 'Delete';
  var ADD_ABOVE_TEXT = 'Add task above';
  var ADD_BELOW_TEXT = 'Add task below';

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  var MOREMENU_ITEMS =
    [ARCHIVE_TEXT, 'Duplicate', DELETE_TEXT, 'Add label', 'Remove label'];
  var TASKMENU_ITEMS =
    [ADD_ABOVE_TEXT, ADD_BELOW_TEXT];

  // This user script will get run on iframes and other todoist pages. Should
  // skip running anything if #todoist_app doesn't exist.
  var todoistRootDiv = document.getElementById(TODOIST_ROOT_ID);
  if (!todoistRootDiv) return;

  // Misc TODO:
  //
  // * Check todoist version number and give a warning if it hasn't been tested
  //   yet.
  //
  // * Allow using ctrl+arrows while editing text of a task.
  //
  // * In schedule view with nesting, some ids can occur multiple times,
  //   screwing up cursor movement.
  //
  // * In agenda view, cursor should be able to focus empty days, for the
  //   purpose of adding tasks.
  //
  // * Also have "s" mean schedule?
  //
  // * What is postpone?
  //
  // * Enter day of month + move between months.

  /*****************************************************************************
   * Actions
   */

  // Move the cursor up and down.
  function moveDown() { modifyCursorIndex(function(ix) { return ix + 1; });}
  function moveUp() { modifyCursorIndex(function(ix) { return ix - 1; }); }

  // Edit the task under the cursor.
  function edit() {
    withUniqueClass(getCursor(), EDIT_CLICK_CLASS, function(content) {
      content.dispatchEvent(new Event('mousedown'));
    });
  }

  // Toggles selection of the task focused by the cursor.
  function toggleSelect() {
    var selected = getSelectedTaskIds();
    if (cursorId) {
      // See the docs for shiftClickTask for why deselection is so much easier
      // than selection.
      if (selected[cursorId]) {
        shiftClickTask(getCursor());
      } else {
        selected[cursorId] = true;
        setSelections(selected);
      }
    } else {
      warn("No cursor, so can't select");
    }
  }

  // Clicks the "schedule" link when items are selected.
  function schedule() {
    // Only open calendar if it isn't already open. This allows "t" to also be
    // used for selecting "tomorrow".
    if (getUniqueClass(document, CALENDAR_CLASS)) {
      debug('Not opening schedule because it is already open.');
    } else {
      withId(ACTIONS_BAR_CLASS, function(parent) {
        clickLink(parent, SCHEDULE_TEXT);
      });
    }
  }

  // Click "today" in schedule. Only does anything if schedule is open.
  function scheduleToday() {
    withCalendar(function(calendar) {
      withUniqueTagAndText(calendar, 'span', '2', function(el) {
        el.click();
      });
    });
  }

  // Click "tomorrow" in schedule. Only does anything if schedule is open.
  function scheduleTomorrow() {
    withCalendar(function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_tomorrow', function(el) {
        el.click();
      });
    });
  }

  // Click "next week" in schedule. Only does anything if schedule is open.
  function scheduleNextWeek() {
    withCalendar(function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_next_week', function(el) {
        el.click();
      });
    });
  }

  // Click "next month" in schedule. Only does anything if schedule is open.
  function scheduleNextMonth() {
    withCalendar(function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_month', function(el) {
        el.click();
      });
    });
  }

  // Click "no due date" in schedule. Only does anything if schedule is open.
  function unschedule() {
    withCalendar(function(calendar) {
      withUniqueTagAndText(calendar, 'span', 'X', function(el) {
        el.click();
      });
    });
  }

  // Clicks the "Move to project" link when items are selected.
  function moveToProject() {
    withId(ACTIONS_BAR_CLASS, function(parent) {
      clickLink(parent, MOVE_TEXT);
    });
    // The keyboard shortcut used to invoke this also ends up in the completion
    // box. I thought stopPropagation would fix this, but it doesn't. So, empty
    // the completion input.
    setTimeout(function() { fillProjectInput(''); }, 0);
  }

  // Fills in the text of the project selection completion.
  function fillProjectInput(text) {
    withUniqueClass(document, PROJECT_COMPLETE_CLASS, function(complete) {
      withUniqueTag(complete, 'input', function(input) {
        input.value = text;
        // FIXME: Initially doesn't show projects list because setting 'value'
        // doesn't trigger any events. However, neither a bare keydown or change
        // work. Requires further investigation.
        //
        // input.dispatchEvent(new Event("keydown"));
      });
    });
  }

  // Sets the priority of the selected items to the specified level.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function setPriority(level) {
    return function() {
      withUniqueClass(document, 'priority_menu', function(menu) {
        withUniqueClass(menu, 'cmp_priority' + level, function(img) {
          withRestoredSelections(function() { img.click(); });
        });
      });
    };
  }

  // Adds tasks matching the specified priority level to the current selection,
  // even if they are hidden by collapsing.
  //
  // TODO: Should it select items hidden by collapsing? Tricky call.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function selectPriority(level) {
    return function() {
      var actualLevel = '';
      // Yup, todoist has mixed up conventions for priority number...
      if (level === '1') {
        actualLevel = '4';
      } else if (level === '2') {
        actualLevel = '3';
      } else if (level === '3') {
        actualLevel = '2';
      } else if (level === '4') {
        actualLevel = '1';
      } else {
        error('Unrecognized level in selectPriority', level);
      }
      var allTasks = getTasks(true);
      var classToMatch = 'priority_' + actualLevel;
      var selected = getSelectedTaskIds();
      var modified = false;
      for (var i = 0; i < allTasks.length; i++) {
        var task = allTasks[i];
        if (task.classList.contains(classToMatch)) {
          selected[task.id] = true;
          modified = true;
        }
      }
      if (modified) {
        setSelections(selected);
      }
    };
  }

  // Archive selected tasks. Note that this appears to be the same thing as
  // marking a task complete.
  function archive() { clickMenu(moreMenu, ARCHIVE_TEXT); }

  // Delete selected tasks. Todoist will prompt for deletion.
  function deleteTasks() { clickMenu(moreMenu, DELETE_TEXT); }

  // Toggles collapse / expand task under the cursor, if it has children.
  function toggleCollapse() {
    withUniqueClass(getCursor(), ARROW_CLASS, function(el) {
      el.click();
    });
  }

  // Expands or collapses task under the cursor, that have children. Does
  // nothing if it's already in the desired state.
  function collapse() { if (checkCursorExpanded()) { toggleCollapse(); } }
  function expand() { if (checkCursorCollapsed()) { toggleCollapse(); } }

  // Clears all selections.
  function deselectAll() {
    var selected = getSelectedTaskIds();
    for (var id in selected) {
      withId(id, shiftClickTask);
    }
  }

  // Selects all tasks, even those hidden by collapsing.
  function selectAll() {
    selectAllInternal();
  }

  // Clicks "cancel" on inline add of a task, if there's no task in the entry
  // box. This is a hacky workaround for usage of "a" in the default keybinding
  // for select_all.
  //
  // FIXME: Instead figure out a way to suppress the event.
  function cancelEmptyAdd() {
    setTimeout(function() {
      withUniqueClass(document, 'richtext_editor', function(editor) {
        if (editor.textContent === '') {
          cancelAdd();
        } else {
          warn('Not cancelling add because it has text.');
        }
      });
    });
  }

  // Clicks "cancel" on inline add of a task.
  function cancelAdd() {
    withUniqueClass(document, 'cancel', function(cancel) {
      cancel.click();
    });
  }

  // Add a tasks above / below cursor.
  function addAbove() { clickTaskMenu(ADD_ABOVE_TEXT); }
  function addBelow() { clickTaskMenu(ADD_BELOW_TEXT); }

  // Navigate to inbox.
  function goToInbox() {
    withUniqueClass(document, 'cmp_filter_inbox', function(img) { img.click(); });
  }

  // Navigate to today.
  function goToToday() {
    withUniqueClass(document, 'cmp_filter_today', function(img) { img.click(); });
  }

  // Navigate to today.
  function goToNext7() {
    withUniqueClass(document, 'cmp_filter_days', function(img) { img.click(); });
  }

  /** ***************************************************************************
   * Utilities for manipulating the UI
   */

  var lastShiftClicked = null;

  // Given a task element, shift-clicks it. Unfortunately, todoist currently has
  // quite strange behavior:
  //
  // * Shift clicking a selected task deselects a single task.
  //
  // * Shift clicking an unselected task toggles the selection state of all the
  //   tasks between the current task and the other tasks.
  //
  // To work around this, when selecting a previously deselected item,
  // 'setSelections' is used.
  function shiftClickTask(el) {
    var mde = new Event('mousedown');
    mde.shiftKey = true;
    el.dispatchEvent(mde);
    // TODO: Should handle this via a mousedown handler, so that it keeps track
    // of mouseclicks too.  Otherwise could get wonky behavior in
    lastShiftClicked = el.id;
  }

  // Like select_all, but returns the list of task elements.
  function selectAllInternal() {
    deselectAll();
    var allTasks = getTasks(true);
    if (allTasks.length > 0) {
      shiftClickTask(allTasks[0]);
      if (allTasks.length > 1) {
        shiftClickTask(allTasks[allTasks.length - 1]);
      }
    }
    return allTasks;
  }

  // Ensures that the specified task ids are selected (specified by a set-like
  // object). The algorithm for this is quite ugly and inefficient, due to the
  // strange todoist behavior mentioned above.
  function setSelections(ids) {
    var startTime = Date.now();
    var allTasks = selectAllInternal();
    // Then deselect all of the things that shouldn't be selected.
    for (var i = 0; i < allTasks.length; i++) {
      var task = allTasks[i];
      if (!ids[task.id] && taskIsSelected(task)) {
        shiftClickTask(task);
      }
    }
    debug('setSelections timing:', Date.now() - startTime);
  }

  function registerTopBarVisibilityHack() {
    var observer = new MutationObserver(function() {
      // If there are selections but the top bar isn't visible, then toggle the
      // last clicked item.
      if (!getId(ACTIONS_BAR_CLASS)) {
        var selections = getSelectedTaskIds();
        if (!isEmptyMap(selections)) {
          var last = document.getElementById(lastShiftClicked);
          if (last) {
            debug("Detected that top bar isn't visible when it should be.  Attempting workaround.");
            shiftClickTask(last);
            shiftClickTask(last);
            if (getId(ACTIONS_BAR_CLASS)) {
              debug('Workaround successful!');
            } else {
              warn('Workaround failed...');
            }
          } else {
            warn("Actions bar isn't visible even though there are selections, and last clicked task is gone.");
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
  }

  // For some reason todoist clears the selections even after applying things
  // like priority changes. This restores the selections.
  function withRestoredSelections(f) {
    var oldSelections = getSelectedTaskIds();
    try {
      f();
    } finally {
      setSelections(oldSelections);
    }
  }

  // Finds a <a> element with the specified text and clicks it.
  function clickLink(parent, text) {
    withUniqueTagAndText(parent, 'a', text, function(matched) {
      matched.click();
    });
  }

  // Finds a menu element. These do not have any unique class or ID, so instead
  // need to do it by looking at text content of the options.
  function findMenu(name, expectedItems) {
    var results = [];
    withClass(document, 'ist_menu', function(menu) {
      var matches = true;
      for (var i = 0; i < expectedItems.length; i++) {
        if (!getUniqueTagAndText(menu, 'span', expectedItems[i])) {
          matches = false;
          break;
        }
      }
      if (matches) {
        results.push(menu);
      }
    });
    if (results.length === 1) {
      return results[0];
    } else {
      warn('Couldn\'t find ' + name + ' menu element.');
      return null;
    }
  }

  // These are menus that are always in the DOM, but need to be located by text
  // matching their options.
  var moreMenu = findMenu("'More...'", MOREMENU_ITEMS);

  function clickMenu(menu, text) {
    if (menu) {
      withUniqueTagAndText(menu, 'span', text, function(el) {
        el.click();
      });
    } else {
      error("Can't perform action due to not finding menu element.");
    }
  }

  // Returns true if the node under the cursor has children and is collapsed.
  function checkCursorCollapsed() {
    return getUniqueClass(getCursor(), 'cmp_open_arrow_right');
  }

  // Returns true if the node under the cursor has children and is expanded.
  function checkCursorExpanded() {
    return getUniqueClass(getCursor(), 'cmp_open_arrow_down');
  }

  // Opens up the task's contextual menu and clicks an item via text match.
  function clickTaskMenu(text) {
    var menu = getFirstClass(getCursor(), 'menu');
    menu.click();
    var taskMenu = findMenu('task', TASKMENU_ITEMS);
    clickMenu(taskMenu, text);
  }

  function withCalendar(f) {
    var calendar = getUniqueClass(document, CALENDAR_CLASS);
    if (calendar) {
      f(calendar);
    } else {
      debug('Calendar is not open');
    }
  }

  /* TODO Make it so that after adding a task, the cursor will be on it?

  function register_editor_keybindings() {
    withId("#editor", function(editor) {
      var observer = new MutationObserver(function() {

      });
      // TODO: Figure out how to observe less? This seems fine for now.
      observer.observe(editor, { childList: true, subtree: true });
    });
  } */

  /* FIXME: Doesn't work out because the menu doesn't stick around if the
  selection is removed, which makes sense.

  // If there are no selections, then temporarily selects the cursor, so that
  // actions that apply to selections will apply to it.
  //
  // The first argument is a boolean called"dangerous", indicating whether it is
  // difficult for the user to undo the action (ignoring the existence of the
  // undo command). This argument is combined with the WHAT_CURSOR_APPLIES_TO
  // global setting to determine whether to apply this behavior.
  //
  // NOTE: It might be better to avoid this hack, and instead invoke the more
  // direct actions.  However, I already wrote this and it seems to work.
  function maybe_with_cursor_selected(dangerous, f) {
    var should_apply = WHAT_CURSOR_APPLIES_TO == "all" ||
                         (WHAT_CURSOR_APPLIES_TO == "most" && !dangerous);
    if (should_apply) {
      var selections = getSelectedTaskIds();
      if (isEmptyMap(selections)) {
        var prev_cursor_id = cursor_id;
        var cursor = getCursor();
        if (cursor) {
          shiftClickTask(cursor);
          try {
            f();
          } finally {
            // Deselect the task so that it's like
            prev_cursor = getId(prev_cursor_id);
            if (taskIsSelected(prev_cursor)) {
              shiftClickTask(prev_cursor);
            }
          }
        } else {
          debug("Skipping action because there is no selections or cursor");
        }
      } else {
        f();
      }
    } else {
      f();
    }
  }
  */

  /*****************************************************************************
   * Enumeration of tasks
   */

  // Get the <li> elements for all the tasks visible in the current view.
  function getTasks(includeCollapsed) {
    var results = [];
    withClass(document, 'task_item', function(item) {
      // Skip elements which don't correspond to tasks, and skip nested tasks
      // that are not visible (if includeCollapsed is not set).
      if (!item.classList.contains('reorder_item') &&
          (includeCollapsed || item.style.display !== 'none')) {
        results.push(item);
      }
    });
    return results;
  }

  // This returns the ids of all the selected items as a set-like object.
  function getSelectedTaskIds() {
    var results = {};
    var tasks = getTasks(true);
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (taskIsSelected(task)) {
        results[task.id] = true;
      }
    }
    return results;
  }

  function taskIsSelected(task) {
    return task.classList.contains('selected');
  }

  /** ***************************************************************************
   * Task cursor
   */

  // The id of the task that the cursor is on.
  var cursorId = null;

  // Class used on the single task that the cursor is on.
  var CURSOR_CLASS = 'userscript_cursor';

  // Sets the cursor to the first task, if any exists.
  function setCursorToFirstTask() {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[0]);
    }
  }

  // Given the element for a task, set it as the current selection.
  function setCursor(itemElement) {
    withClass(document, CURSOR_CLASS, function(oldCursor) {
      oldCursor.classList.remove(CURSOR_CLASS);
    });
    if (itemElement) {
      cursorId = itemElement.id;
      updateCursorStyle();
      verticalScrollIntoView(itemElement);
    } else {
      cursorId = null;
    }
  }


  // Given a list of task elements (yielded by getTasks), returns the index
  // that corresponds to cursorId.
  function getCursorIndex(tasks) {
    if (cursorId) {
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id ===  cursorId) {
          return i;
        }
      }
    }
    return null;
  }

  // Returns the <li> element which corresponds to the current cursorId.
  function getCursor() {
    return document.getElementById(cursorId);
  }

  // A functional-ish idiom to reduce boilerplate.
  function modifyCursorIndex(f) {
    var tasks = getTasks();
    var newIndex = f(getCursorIndex(tasks), tasks);
    if (newIndex < 0) {
      newIndex = 0;
    }
    if (newIndex >= tasks.length) {
      newIndex = tasks.length - 1;
    }
    setCursor(tasks[newIndex]);
  }

  /*****************************************************************************
   * Utilities
   */

  function debug() {
    if (DEBUG) {
      var args = [].slice.call(arguments);
      args.unshift('todoist-shortcuts:');
      // eslint-disable-next-line no-console
      console.log.apply(null, args);
    }
  }

  function warn() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    // eslint-disable-next-line no-console
    console.warn.apply(null, args);
  }

  function error() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    // eslint-disable-next-line no-console
    console.error.apply(null, arguments);
  }

  // https://github.com/greasemonkey/greasemonkey/issues/2724#issuecomment-354005162
  function addCss(css) {
    var style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    return style;
  }

  // Scrolls the specified element into view by positioning the top of the
  // element in the middle of the window, but only if necessary to bring it into
  // view. Does not work well for elements that are larger than half a screen
  // full.
  function verticalScrollIntoView(el) {
    var rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      var top = rect.top + window.scrollY;
      // FIXME: for large tasks, this could end up with the whole task not being
      // in view.
      window.scrollTo(0, top - window.innerHeight / 2);
    }
  }

  // Alias for document.getElementById
  function getId(id) { return document.getElementById(id); }

  // Invokes the function for the matching id, or logs a warning.
  function withId(id, f) {
    var el = getId(id);
    if (el) {
      return f(el);
    } else {
      warn("Couldn't find ID", id);
      return null;
    }
  }

  // Invokes the function for every child element that matches the class name.
  function withClass(parent, cls, f) {
    var els = parent.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Returns first child that matches the specified class.
  function getFirstClass(parent, cls) {
    var els = parent.getElementsByClassName(cls);
    if (els.length > 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the class name,
  // and returns it.  Returns null if it is not found or not unique.
  function getUniqueClass(parent, cls) {
    var els = parent.getElementsByClassName(cls);
    if (els.length === 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the class name,
  // and invokes the function on it. Logs a warning if there isn't exactly one.
  function withUniqueClass(parent, cls, f) {
    var result = getUniqueClass(parent, cls);
    if (result) {
      return f(result);
    } else {
      warn("Couldn't find unique child with class", cls, 'instead got', result);
      return null;
    }
  }

  // Checks that there is only one child element that matches the tag, and
  // returns it. Returns null if it is not found or not unique.
  function getUniqueTag(parent, tag) {
    var els = parent.getElementsByTagName(tag);
    if (els.length === 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the tag, and
  // invokes the function on it. Logs a warning if there isn't exactly one.
  function withUniqueTag(parent, tag, f) {
    var result = getUniqueTag(parent, tag);
    if (result) {
      return f(result);
    }
    warn("Couldn't find unique child with tag", tag, 'instead got', result);
    return null;
  }

  // Attempts to find an element with the specified tag and textContent. Returns
  // null if it is not not found or not unique.
  function getUniqueTagAndText(parent, tag, text) {
    var result = null;
    var els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.textContent === text) {
        if (!result) {
          result = el;
        } else {
          // Not a unique result, return null.
          return null;
        }
      }
    }
    return result;
  }

  // Attempts to find an element with the specified tag and textContent, and
  // invoked the function on it. Logs a warning if there isn't exactly one.
  function withUniqueTagAndText(parent, tag, text, f) {
    var el = getUniqueTagAndText(parent, tag, text);
    if (el) {
      f(el);
    } else {
      warn("Couldn't find", tag, 'element matching the text', text);
    }
  }

  // Returns true if the map-like / set-like object is empty.
  function isEmptyMap(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }

  /*****************************************************************************
   * Styling
   */

  // Static css styling.  This does the following:
  //
  // * Makes it so that the actions bar doesn't animate its opacity. This way,
  //   the bug worked around by registerTopBarVisibilityHack is less
  //   apparent.
  addCss([
    '#' + ACTIONS_BAR_CLASS + ' {',
    '  opacity: 1 !important;',
    '}'
  ].join('\n'));

  // A CSS style element, dynamically updated by updateCursorStyle.
  var style = addCss('');

  // This is unusual. Usually you would not dynamically generate CSS that uses
  // different IDs. However, this is a nice hack in this case, because todoist
  // frequently re-creates elements.
  function updateCursorStyle() {
    style.textContent = [
      '#' + cursorId + ' {',
      '  border-left: 2px solid #4d90f0;',
      '  margin-left: -4px;',
      '}',
      '#' + cursorId + ' .sel_checkbox_td {',
      '  padding-left: 2px;',
      '}',
      '#' + cursorId + ' .arrow, #' + cursorId + ' .drag_and_drop_handler {',
      '  margin-left: -16px;',
      '}'
    ].join('\n');
  }

  /*****************************************************************************
   * mousetrap v1.6.1 craig.is/killing/mice
   */

  /* eslint-disable */
  (function(r,v,f){function w(a,b,g){a.addEventListener?a.addEventListener(b,g,!1):a.attachEvent("on"+b,g)}function A(a){if("keypress"==a.type){var b=String.fromCharCode(a.which);a.shiftKey||(b=b.toLowerCase());return b}return p[a.which]?p[a.which]:t[a.which]?t[a.which]:String.fromCharCode(a.which).toLowerCase()}function F(a){var b=[];a.shiftKey&&b.push("shift");a.altKey&&b.push("alt");a.ctrlKey&&b.push("ctrl");a.metaKey&&b.push("meta");return b}function x(a){return"shift"==a||"ctrl"==a||"alt"==a||
    "meta"==a}function B(a,b){var g,c,d,f=[];g=a;"+"===g?g=["+"]:(g=g.replace(/\+{2}/g,"+plus"),g=g.split("+"));for(d=0;d<g.length;++d)c=g[d],C[c]&&(c=C[c]),b&&"keypress"!=b&&D[c]&&(c=D[c],f.push("shift")),x(c)&&f.push(c);g=c;d=b;if(!d){if(!n){n={};for(var q in p)95<q&&112>q||p.hasOwnProperty(q)&&(n[p[q]]=q)}d=n[g]?"keydown":"keypress"}"keypress"==d&&f.length&&(d="keydown");return{key:c,modifiers:f,action:d}}function E(a,b){return null===a||a===v?!1:a===b?!0:E(a.parentNode,b)}function c(a){function b(a){a=
    a||{};var b=!1,l;for(l in n)a[l]?b=!0:n[l]=0;b||(y=!1)}function g(a,b,u,e,c,g){var l,m,k=[],f=u.type;if(!h._callbacks[a])return[];"keyup"==f&&x(a)&&(b=[a]);for(l=0;l<h._callbacks[a].length;++l)if(m=h._callbacks[a][l],(e||!m.seq||n[m.seq]==m.level)&&f==m.action){var d;(d="keypress"==f&&!u.metaKey&&!u.ctrlKey)||(d=m.modifiers,d=b.sort().join(",")===d.sort().join(","));d&&(d=e&&m.seq==e&&m.level==g,(!e&&m.combo==c||d)&&h._callbacks[a].splice(l,1),k.push(m))}return k}function f(a,b,c,e){h.stopCallback(b,
    b.target||b.srcElement,c,e)||!1!==a(b,c)||(b.preventDefault?b.preventDefault():b.returnValue=!1,b.stopPropagation?b.stopPropagation():b.cancelBubble=!0)}function d(a){"number"!==typeof a.which&&(a.which=a.keyCode);var b=A(a);b&&("keyup"==a.type&&z===b?z=!1:h.handleKey(b,F(a),a))}function p(a,c,u,e){function l(c){return function(){y=c;++n[a];clearTimeout(r);r=setTimeout(b,1E3)}}function g(c){f(u,c,a);"keyup"!==e&&(z=A(c));setTimeout(b,10)}for(var d=n[a]=0;d<c.length;++d){var m=d+1===c.length?g:l(e||
    B(c[d+1]).action);q(c[d],m,e,a,d)}}function q(a,b,c,e,d){h._directMap[a+":"+c]=b;a=a.replace(/\s+/g," ");var f=a.split(" ");1<f.length?p(a,f,b,c):(c=B(a,c),h._callbacks[c.key]=h._callbacks[c.key]||[],g(c.key,c.modifiers,{type:c.action},e,a,d),h._callbacks[c.key][e?"unshift":"push"]({callback:b,modifiers:c.modifiers,action:c.action,seq:e,level:d,combo:a}))}var h=this;a=a||v;if(!(h instanceof c))return new c(a);h.target=a;h._callbacks={};h._directMap={};var n={},r,z=!1,t=!1,y=!1;h._handleKey=function(a,
    c,d){var e=g(a,c,d),k;c={};var h=0,l=!1;for(k=0;k<e.length;++k)e[k].seq&&(h=Math.max(h,e[k].level));for(k=0;k<e.length;++k)e[k].seq?e[k].level==h&&(l=!0,c[e[k].seq]=1,f(e[k].callback,d,e[k].combo,e[k].seq)):l||f(e[k].callback,d,e[k].combo);e="keypress"==d.type&&t;d.type!=y||x(a)||e||b(c);t=l&&"keydown"==d.type};h._bindMultiple=function(a,b,c){for(var d=0;d<a.length;++d)q(a[d],b,c)};w(a,"keypress",d);w(a,"keydown",d);w(a,"keyup",d)}if(r){var p={8:"backspace",9:"tab",13:"enter",16:"shift",17:"ctrl",
    18:"alt",20:"capslock",27:"esc",32:"space",33:"pageup",34:"pagedown",35:"end",36:"home",37:"left",38:"up",39:"right",40:"down",45:"ins",46:"del",91:"meta",93:"meta",224:"meta"},t={106:"*",107:"+",109:"-",110:".",111:"/",186:";",187:"=",188:",",189:"-",190:".",191:"/",192:"`",219:"[",220:"\\",221:"]",222:"'"},D={"~":"`","!":"1","@":"2","#":"3",$:"4","%":"5","^":"6","&":"7","*":"8","(":"9",")":"0",_:"-","+":"=",":":";",'"':"'","<":",",">":".","?":"/","|":"\\"},C={option:"alt",command:"meta","return":"enter",
    escape:"esc",plus:"+",mod:/Mac|iPod|iPhone|iPad/.test(navigator.platform)?"meta":"ctrl"},n;for(f=1;20>f;++f)p[111+f]="f"+f;for(f=0;9>=f;++f)p[f+96]=f.toString();c.prototype.bind=function(a,b,c){a=a instanceof Array?a:[a];this._bindMultiple.call(this,a,b,c);return this};c.prototype.unbind=function(a,b){return this.bind.call(this,a,function(){},b)};c.prototype.trigger=function(a,b){if(this._directMap[a+":"+b])this._directMap[a+":"+b]({},a);return this};c.prototype.reset=function(){this._callbacks={};
    this._directMap={};return this};c.prototype.stopCallback=function(a,b){return-1<(" "+b.className+" ").indexOf(" mousetrap ")||E(b,this.target)?!1:"INPUT"==b.tagName||"SELECT"==b.tagName||"TEXTAREA"==b.tagName||b.isContentEditable};c.prototype.handleKey=function(){return this._handleKey.apply(this,arguments)};c.addKeycodes=function(a){for(var b in a)a.hasOwnProperty(b)&&(p[b]=a[b]);n=null};c.init=function(){var a=c(v),b;for(b in a)"_"!==b.charAt(0)&&(c[b]=function(b){return function(){return a[b].apply(a,
    arguments)}}(b))};c.init();r.Mousetrap=c;"undefined"!==typeof module&&module.exports&&(module.exports=c);"function"===typeof define&&define.amd&&define(function(){return c})}})("undefined"!==typeof window?window:null,"undefined"!==typeof window?document:null);
  /* eslint-enable */


  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  setCursorToFirstTask();

  // Register mutation observers
  registerTopBarVisibilityHack();

  // Register key bindings
  for (var i = 0; i < bindings.length; i++) {
    if (bindings[i].length === 2) {
      var action = bindings[i][1];
      // Allow a list of functions to call.
      if (action instanceof Array) {
        var actions = action;
        // eslint-disable-next-line no-loop-func
        action = function() {
          for (var j = 0; j < actions.length; j++) {
            actions[j]();
          }
        };
      }
      // eslint-disable-next-line no-undef
      Mousetrap.bind(bindings[i][0], action);
    } else {
      error('Improper binding entry at index', i, 'value is', bindings[i]);
    }
  }
})();
