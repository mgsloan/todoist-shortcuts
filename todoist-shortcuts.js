// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/app*
// @include     http://todoist.com/app*
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
    ['j', cursorDown],
    ['k', cursorUp],
    ['h', collapse],
    ['l', expand],
    // [['g g', 'ctrl+k'], goToProject],
    ['g i', goToInbox],
    ['g t', goToToday],
    // TODO: g n is more intuitive I think. One or both?
    [['g w', 'g n'], goToNext7],

    // Manipulation of tasks at cursor
    ['enter', edit],
    ['O', addAbove],
    ['o', addBelow],
    ['J', moveDown],
    ['K', moveUp],
    // TODO ["ctrl+right", indent],
    // TODO ["ctrl+left", dedent],

    // Selection
    ['x', toggleSelect],
    ['* a', sequence([selectAll, cancelEmptyAdd])],
    ['* n', deselectAll],
    // NOTE: these are a bit different than gmail's "select unread" and similar,
    // as they add to the current selection. I think this is more useful.
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    ['* 4', selectPriority('4')],

    // Manipulation of selected tasks
    ['t', ifThenElse(checkCalendarOpen, scheduleTomorrow, schedule)],
    ['v', moveToProject],
    ['d', done],
    ['e', archive],
    // TODO: Similarly, should we follow gmail here?
    // d (delete)
    // r (remove)
    // delete
    ['#', deleteTasks],
    ['1', setPriority('1')],
    ['2', setPriority('2')],
    ['3', setPriority('3')],
    ['4', setPriority('4')],

    // Scheduling keybindings (requires schedule to be open)
    //
    // The following binding is handled earlier ['t', scheduleTomorrow]
    ['n', scheduleToday],
    ['w', scheduleNextWeek],
    ['m', scheduleNextMonth],
    ['r', unschedule],

    // Misc
    // TODO: ["?", show_keybindings]
    ['escape', closeContextMenus]
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
  var AGENDA_VIEW_ID = 'agenda_view';
  var EDIT_CLICK_CLASS = 'content';
  var ACTIONS_BAR_CLASS = 'item_selecter';
  var PROJECT_COMPLETE_CLASS = 'ist_complete_select';
  var ARROW_CLASS = 'arrow';
  var CALENDAR_CLASS = 'minical_container';

  var SCHEDULE_TEXT = 'Schedule';
  var MOVE_TEXT = 'Move to project';
  var ARCHIVE_TEXT = 'Archive';
  var ARCHIVE_TASK_TEXT = 'Archive task';
  var DELETE_TEXT = 'Delete';
  var DELETE_CONFIRM_TEXT = 'Delete';
  var DELETE_TASK_TEXT = 'Delete task';
  var ADD_ABOVE_TEXT = 'Add task above';
  var ADD_BELOW_TEXT = 'Add task below';

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  var MORE_MENU_ITEMS =
    [ARCHIVE_TEXT, 'Duplicate', DELETE_TEXT, 'Add label', 'Remove label'];
  var TASKMENU_ITEMS =
    [ARCHIVE_TASK_TEXT, MOVE_TEXT, DELETE_TASK_TEXT];

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
  //
  // * Should j and k step into expanded trees? probably keep it that way
  //
  // * l should step out even if not focused on the collapser
  //
  // * h should also move cursor down after opening
  //
  // * In "today" / "next 7 days" view, o and O should add to the same day.
  //   Should also scroll so the add box is in view.
  //
  // * Should it match append / insert? 'a' would edit at the end of task text,
  //   'i' would edit at beginning of task text.
  //
  // * o / O should work even when no tasks exist or when none selected
  //
  // * Could get some efficiency by not doing id / class searches from the
  //   document root.
  //
  // * Remember per project cursor locations.


  /*****************************************************************************
   * Action combiners
   */

  // Take multiple actions (functions that take no arguments), and run them in
  // sequence.
  function sequence(actions) {
    return function() {
      for (var i = 0; i < actions.length; i++) {
        actions[i]();
      }
    };
  }

  // TODO: Use something other than mousetrap or augment it to allow enabling
  // different keymaps under different conditions?

  // If the condition is true, runs the first action, otherwise runs the second.
  function ifThenElse(condition, calendarAction, normalAction) {
    return function() {
      if (condition()) {
        calendarAction();
      } else {
        normalAction();
      }
    };
  }

  /*****************************************************************************
   * Actions
   */

  // Move the cursor up and down.
  function cursorDown() { modifyCursorIndex(function(ix) { return ix + 1; }); }
  function cursorUp() { modifyCursorIndex(function(ix) { return ix - 1; }); }

  // Edit the task under the cursor.
  function edit() {
    withUniqueClass(getCursor(), EDIT_CLICK_CLASS, unconditional, function(content) {
      content.dispatchEvent(new Event('mousedown'));
    });
  }

  // Toggles selection of the task focused by the cursor.
  function toggleSelect() {
    var cursor = getCursor();
    if (cursor) {
      // NOTE: todoist's shift-click actually only does one element at a time,
      // even if they have the same id. This intentionally deviates from that
      // behavior.
      if (checkTaskIsSelected(cursor)) {
        deselectTaskId(cursor.id);
      } else {
        selectTaskId(cursor.id);
      }
    } else {
      warn("No cursor, so can't select");
    }
  }

  // Clicks the 'schedule' link when tasks are selected.
  function schedule() {
    // Only open calendar if it isn't already open. This allows 't' to also be
    // used for selecting 'tomorrow'.
    if (getUniqueClass(document, CALENDAR_CLASS)) {
      debug('Not opening schedule because it is already open.');
    } else {
      debug('Attempting to open schedule.');
      withId(ACTIONS_BAR_CLASS, function(parent) {
        clickLink(parent, SCHEDULE_TEXT);
      });
    }
  }

  // Click 'today' in schedule. Only does anything if schedule is open.
  function scheduleToday() {
    withCalendar('scheduleToday', function(calendar) {
      withUniqueClass(calendar, 'today_icon', notMatchingText('X'), click);
    });
  }

  // Click 'tomorrow' in schedule. Only does anything if schedule is open.
  function scheduleTomorrow() {
    withCalendar('scheduleTomorrow', function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_tomorrow', unconditional, click);
    });
  }

  // Click 'next week' in schedule. Only does anything if schedule is open.
  function scheduleNextWeek() {
    withCalendar('scheduleNextWeek', function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_next_week', unconditional, click);
    });
  }

  // Click 'next month' in schedule. Only does anything if schedule is open.
  function scheduleNextMonth() {
    withCalendar('scheduleNextMonth', function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_month', unconditional, click);
    });
  }

  // Click 'no due date' in schedule. Only does anything if schedule is open.
  function unschedule() {
    withCalendar('unschedule', function(calendar) {
      withUniqueClass(calendar, 'today_icon', matchingText('X'), click);
    });
  }

  // Clicks the 'Move to project' link when tasks are selected.
  function moveToProject() {
    withId(ACTIONS_BAR_CLASS, function(parent) { clickLink(parent, MOVE_TEXT); });
    // The keyboard shortcut used to invoke this also ends up in the completion
    // box. I thought stopPropagation would fix this, but it doesn't. So, empty
    // the completion input.
    setTimeout(function() { fillProjectInput(''); });
  }

  // Fills in the text of the project selection completion.
  function fillProjectInput(text) {
    withUniqueClass(document, PROJECT_COMPLETE_CLASS, unconditional, function(complete) {
      withUniqueTag(complete, 'input', unconditional, function(input) {
        input.value = text;
        // FIXME: Initially doesn't show projects list because setting 'value'
        // doesn't trigger any events. However, neither a bare keydown or change
        // work. Requires further investigation.
        //
        // input.dispatchEvent(new Event("keydown"));
      });
    });
  }

  // Sets the priority of the selected tasks to the specified level.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function setPriority(level) {
    return function() {
      withUniqueClass(document, 'priority_menu', unconditional, function(menu) {
        withUniqueClass(menu, 'cmp_priority' + level, unconditional, function(img) {
          var isAgenda = checkIsAgendaMode();
          withRestoredSelections(isAgenda, click(img));
        });
      });
    };
  }

  // Adds tasks matching the specified priority level to the current selection,
  // even if they are hidden by collapsing.
  //
  // TODO: Should it select tasks hidden by collapsing? Tricky call.
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
      var isAgenda = checkIsAgendaMode();
      var allTasks = getTasks(true);
      var classToMatch = 'priority_' + actualLevel;
      var selected = getSelectedTaskKeys(isAgenda);
      var modified = false;
      for (var i = 0; i < allTasks.length; i++) {
        var task = allTasks[i];
        if (task.classList.contains(classToMatch)) {
          selected[getTaskKey(task, isAgenda)] = true;
          modified = true;
        }
      }
      if (modified) {
        setSelections(selected, isAgenda);
      }
    };
  }

  // Archive selected tasks. This seems to be similar to marking a task
  // complete.  The main variation in behavior between this and 'done' is that
  // for nested tasks, 'done' keeps them in the list but checks them off. Note
  // that this appears to be the same thing as marking a task complete.
  function archive() {
    clickMenu(moreMenu, ARCHIVE_TEXT);
  }

  // Mark all the tasks as completed.
  function done() {
    // For some reason, only one task can be marked once at a time. So, the
    // timeout hack.  Means that the user will see intermediate UI updates,
    // but hey, it works.
    withSelectedTasks(function(task) {
      setTimeout(function() { clickTaskDone(task) });
    });
  }

  // Delete selected tasks. Todoist will prompt for deletion.
  function deleteTasks() {
    clickMenu(moreMenu, DELETE_TEXT);
  }

  // Press delete confirm button.
  function confirmDelete() {
    withUniqueClass(document, 'ist_button_red', matchingText(DELETE_CONFIRM_TEXT), click);
  }

  // Toggles collapse / expand task under the cursor, if it has children.
  function toggleCollapse() {
    withUniqueClass(getCursor(), ARROW_CLASS, unconditional, click);
  }

  // Expands or collapses task under the cursor, that have children. Does
  // nothing if it's already in the desired state.
  function collapse() { if (checkCursorExpanded()) { toggleCollapse(); } }
  function expand() { if (checkCursorCollapsed()) { toggleCollapse(); } }

  // Clears all selections.
  function deselectAll() {
    var isAgenda = checkIsAgendaMode();
    var selected = getSelectedTaskKeys(isAgenda);
    for (var key in selected) {
      withTaskByKey(key, shiftClickTask);
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
      withUniqueClass(document, 'richtext_editor', unconditional, function(editor) {
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
    withUniqueClass(document, 'cancel', unconditional, click);
  }

  // Add a tasks above / below cursor.
  function addAbove() { clickTaskMenu(getCursor(), ADD_ABOVE_TEXT); }
  function addBelow() { clickTaskMenu(getCursor(), ADD_BELOW_TEXT); }

  // Navigate to inbox.
  function goToInbox() {
    withUniqueClass(document, 'cmp_filter_inbox', unconditional, click);
  }

  // Navigate to today.
  function goToToday() {
    withUniqueClass(document, 'cmp_filter_today', unconditional, click);
  }

  // Navigate to today.
  function goToNext7() {
    withUniqueClass(document, 'cmp_filter_days', unconditional, click);
  }

  // Click somewhere on the page that shouldn't do anything in particular except
  // closing context menus.
  function closeContextMenus() {
    click(document.body);
  }

  /** ***************************************************************************
   * Utilities for manipulating the UI
   */

  // FIXME: lastShiftClicked should probably also be set when user actually
  // shift clicks, instead of just simulated ones.
  var lastShiftClicked = null;
  var lastShiftClickedIndent = null;

  // Given a task element, shift-clicks it. Unfortunately, todoist currently has
  // quite strange behavior:
  //
  // * Shift clicking a selected task deselects a single task.
  //
  // * Shift clicking an unselected task toggles the selection state of all the
  //   tasks between the current task and the other tasks.
  //
  // To work around this, when selecting a previously deselected task,
  // 'setSelections' is used.
  function shiftClickTask(task) {
    // NOTE: Intentionally doesn't simulate full click like the 'click'
    // function. This function gets called a lot, so best to just trigger one
    // event.
    var mde = new Event('mousedown');
    mde.shiftKey = true;
    task.dispatchEvent(mde);
    // TODO: Should handle this via a mousedown handler, so that it keeps track
    // of mouseclicks too.  Otherwise could get wonky behavior in
    lastShiftClicked = task.id;
    lastShiftClickedIndent = getTaskIndentClass(task);
  }

  // Selects all tasks that have the specified id.
  function selectTaskId(id) {
    var isAgenda = checkIsAgendaMode();
    var selected = getSelectedTaskKeys(isAgenda);
    withClass(document, id, function(task) {
      selected[getTaskKey(task, isAgenda)] = true;
    });
    setSelections(selected, isAgenda);
  }

  // Deselects all tasks that have the specified id.
  //
  // See the docs for shiftClickTask for why deselection is so much easier than
  // selecting a task id.
  function deselectTaskId(id) {
    withClass(document, id, function(task) {
      if (checkTaskIsSelected(task)) {
        shiftClickTask(task);
      }
    });
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
  function setSelections(selections, isAgenda) {
    var startTime = Date.now();
    var allTasks = selectAllInternal();
    // Then deselect all of the things that shouldn't be selected.
    for (var i = 0; i < allTasks.length; i++) {
      var task = allTasks[i];
      var key = getTaskKey(task, isAgenda);
      if (!selections[key] && checkTaskIsSelected(task)) {
        shiftClickTask(task);
      }
    }
    debug('setSelections timing:', Date.now() - startTime);
  }

  var lastCursorTasks = [];
  var lastCursorIndex = [];

  // If the cursor exists, set 'lastCursorTasks' / 'lastCursorIndex'. IF it
  // doesn't exist, then use previously stored info to place it after its prior
  // location.
  function stableCursorHack() {
    if (getCursor()) {
      lastCursorTasks = getTasks();
      lastCursorIndex = getCursorIndex(lastCursorTasks);
    } else {
      debug("cursor element disappeared, finding new location");
      var found = false;
      for (var i = lastCursorIndex; i < lastCursorTasks.length; i++) {
        var oldTask = lastCursorTasks[i];
        if (oldTask) {
          var task = getId(oldTask.id);
          if (task) {
            debug("found still-existing task that was after old cursor, setting cursor to it");
            found = true;
            setCursor(task);
            break;
          }
        }
      }
      if (!found) {
        debug("didn't find a particular task to select, so selecting last task");
        setCursorToLastTask();
      }
    }
  }

  // If there are selections but the top bar isn't visible, then toggle the
  // last clicked task.
  function topBarVisibilityHack() {
    if (!getId(ACTIONS_BAR_CLASS)) {
      var isAgenda = checkIsAgendaMode();
      var selections = getSelectedTaskKeys(isAgenda);
      if (!isEmptyMap(selections)) {
        var last = getTaskById(lastShiftClicked, lastShiftClickedIndent);
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
  }

  function registerMutationObserver() {
    var observer = new MutationObserver(function() {
      topBarVisibilityHack();
      stableCursorHack();
    });
    // TODO: More fine-grained mutation observer.  This is rather inefficient.
    observer.observe(document.body, { childList: true });
    onDisable(function() {
      observer.disconnect();
    });
  }

  // For some reason todoist clears the selections even after applying things
  // like priority changes. This restores the selections.
  function withRestoredSelections(isAgenda, f) {
    var oldSelections = getSelectedTaskKeys();
    try {
      f();
    } finally {
      setSelections(oldSelections, isAgenda);
    }
  }

  // Finds a <a> element with the specified text and clicks it.
  function clickLink(parent, text) {
    withUniqueTag(parent, 'a', matchingText(text), click);
  }

  // Finds a menu element. These do not have any unique class or ID, so instead
  // need to do it by looking at text content of the options.
  function findMenu(name, expectedItems, predicate0, expectedCount0) {
    var predicate = predicate0 ? predicate0 : unconditional;
    var expectedCount = expectedCount0 ? expectedCount0 : 1;
    var results = [];
    withClass(document, 'ist_menu', function(menu) {
      if (predicate(menu)) {
        var matches = true;
        for (var i = 0; i < expectedItems.length; i++) {
          if (!getUniqueTag(menu, 'span', matchingText(expectedItems[i]))) {
            matches = false;
            break;
          }
        }
        if (matches) {
          results.push(menu);
        }
      }
    });
    if (results.length === expectedCount) {
      return results[0];
    } else {
      warn('Couldn\'t find unique \'' + name + '\' menu element, found:', results);
      return null;
    }
  }

  // These are menus that are always in the DOM, but need to be located by text
  // matching their options.
  var moreMenu = findMenu('More...', MORE_MENU_ITEMS);
  var taskMenu = findMenu('task', TASKMENU_ITEMS, unconditional, 2);
  var agendaTaskMenu = findMenu('agenda task', TASKMENU_ITEMS, function(el) { return el !== taskMenu; });

  function clickMenu(menu, text) {
    if (menu) {
      withUniqueTag(menu, 'span', matchingText(text), click);
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
  function clickTaskMenu(task, text, isAgenda) {
    withUniqueTag(task, 'div', matchingClass('menu'), function(openMenu) {
      var menu = isAgenda ? agendaTaskMenu : taskMenu;
      if (menu.style.display === 'none') {
        click(openMenu);
      } else {
        // If it's already visible, it might be for the wrong task.
        click(openMenu);
        // If it hides after clicking, then it was already associated with the
        // right task, click it again.
        if (menu.style.display === 'none') {
          click(openMenu);
        }
      }
      clickMenu(menu, text);
    });
  }

  function checkCalendarOpen() {
    return findCalendar() !== null;
  }

  function findCalendar() {
    return getUniqueClass(document, CALENDAR_CLASS);
  }

  function withCalendar(name, f) {
    var calendar = findCalendar();
    if (calendar) {
      f(calendar);
    } else {
      warn('Not performing action', name, 'because calendar is not open');
    }
  }

  // Simulate a mouse click.
  function click(el) {
    el.dispatchEvent(new Event('mousedown'));
    el.dispatchEvent(new Event('mouseup'));
    el.click();
  }

  function moveUp() {
    var isAgenda = checkIsAgendaMode();
    var task = getCursor();
    var startCursorKey = getCursorKey(isAgenda);
    task.dispatchEvent(new Event('mouseover'));
    try {
      withCursorDragHandle(function(el, x, y) {
        el.dispatchEvent(new MouseEvent('mousedown', {
          screenX: x,
          screenY: y,
          clientX: x,
          clientY: y
        }));
        // FIXME: In order to jump between sections, should use previous task position
        //
        // NOTE: Would be nice to not need this 0ms timeout as it makes it a
        // little laggier. Seems to be needed though.
        setTimeout(function() {
          var params = {
            bubbles: true,
            screenX: x,
            screenY: y - task.clientHeight + 20,
            clientX: x,
            clientY: y - task.clientHeight + 20
          };
          el.dispatchEvent(new MouseEvent('mousemove', params));
          el.dispatchEvent(new MouseEvent('mouseup', params));
        });
      });
    } finally {
      withTaskByKey(startCursorKey, function(el) {
        el.dispatchEvent(new Event('mouseout'));
      });
    }
  }

  function withCursorDragHandle(f) {
    withUniqueClass(getCursor(), 'drag_and_drop_handler', unconditional, function(el) {
      var x = el.offsetLeft - window.scrollX;
      var y = el.offsetTop - window.scrollY;
      f(el, x, y);
    });
  }

  function moveDown() {
    withDragHandle(getCursor(), function(el) {
    });
  }

  function withDragHandle(task, f) {
    var key = getTaskKey(task);
    task.dispatchEvent(new Event('mouseover'));
    try {
      withUniqueClass(task, 'drag_and_drop_handler', unconditional, f);
    } finally {
      withTaskByKey(key, function(el) { el.dispatchEvent(new Event('mouseout')); });
    }
  }

  function clickTaskDone(task) {
    withUniqueClass(task, 'ist_checkbox', unconditional, click);
  }

  function findSection(task) {
    return findParent(task, or(matchingClass("section_day"), 
                               matchingClass("project_editor_instance"));
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
      var selections = getSelectedTaskKeys();
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
            if (checkTaskIsSelected(prev_cursor)) {
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
          (includeCollapsed || notHidden(item))) {
        results.push(item);
      }
    });
    return results;
  }

  // This applies the function to every selected task.
  function withSelectedTasks(f) {
    var tasks = getTasks(true);
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (checkTaskIsSelected(task)) {
        f(task);
      }
    }
  }

  // This returns the ids of all the selected tasks as a set-like object.
  //
  // When in agenda mode, also includes the indent level in the key. See
  // 'getTaskById' for why.
  function getSelectedTaskKeys(isAgenda) {
    var results = {};
    var tasks = getTasks(true);
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (checkTaskIsSelected(task)) {
        var key = getTaskKey(task, isAgenda);
        results[key] = true;
      }
    }
    return results;
  }

  // Get key used for the cursor, in the getSelectedTaskKeys map.
  function getTaskKey(task, isAgenda) {
    if (isAgenda === true) {
      return task.id + ' ' + getTaskIndentClass(task);
    } else if (isAgenda === false) {
      return task.id;
    } else {
      error('getTaskKey called with wrong number of arguments');
      return null;
    }
  }

  function makeTaskKey(id, indent, isAgenda) {
    if (isAgenda) {
      return id + ' ' + indent;
    } else {
      return id;
    }
  }

  function checkTaskIsSelected(task) {
    return task.classList.contains('selected');
  }

  function getTaskIndentClass(task) {
    return findUnique(isIndentClass, task.classList);
  }

  function isIndentClass(cls) {
    return cls.startsWith('indent_');
  }

  function withTaskByKey(key, f) {
    var task = getTaskByKey(key, f);
    if (task) {
      f(task);
    } else {
      warn('Couldn\'t find task key', key);
    }
  }

  function getTaskByKey(key) {
    var arr = key.split(' ');
    return getTaskById(arr[0], arr[1]);
  }

  // Given a task id, returns a task element. If an indent is also given and
  // todoist is in agenda mode, then it will use this to select the right
  // element.  The purpose of this is explained below:
  //
  // This is a workaround for todoist using duplicate 'id' values for tasks in
  // the case that they are nested in a tree, but different parts of the tree
  // are scheduled for different days. Since a task will only appear once at a
  // given indent, this is sufficient to distinguish different. Also, this is
  // stable because you can't adjust indent level in agenda mode.
  function getTaskById(id, indent) {
    if (checkIsAgendaMode()) {
      // In agenda mode, can't rely on uniqueness of ids. So, search for
      // matching 'indent'. Turns out todoist also uses the ids as classes.
      var els = document.getElementsByClassName(id);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (!indent) {
          warn('getTaskById called in agenda mode but with no indent value.');
          return el;
        } else if (el.classList.contains(indent)) {
          return el;
        }
      }
      return null;
    } else {
      return document.getElementById(id);
    }
  }

  /** ***************************************************************************
   * Task cursor
   */

  // The id of the task that the cursor is on.
  var cursorId = null;

  // The indent class of the task that the cursor is on. See 'getTaskById' for
  // detailed explanation.
  var cursorIndent = null;

  // Class used on the single task that the cursor is on.
  var CURSOR_CLASS = 'userscript_cursor';

  // Sets the cursor to the first task, if any exists.
  function setCursorToFirstTask() {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[0]);
    }
  }

  // Sets the cursor to the last task, if any exists.
  function setCursorToLastTask() {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[tasks.length - 1]);
    }
  }

  // Given the element for a task, set it as the current selection.
  function setCursor(task) {
    withClass(document, CURSOR_CLASS, function(oldCursor) {
      oldCursor.classList.remove(CURSOR_CLASS);
    });
    if (task) {
      cursorId = task.id;
      cursorIndent = getTaskIndentClass(task);
      updateCursorStyle();
      verticalScrollIntoView(task);
    } else {
      cursorId = null;
    }
  }

  // Given a list of task elements (yielded by getTasks), returns the index
  // that corresponds to cursorId.
  function getCursorIndex(tasks) {
    if (cursorId) {
      var isAgenda = checkIsAgendaMode();
      for (var i = 0; i < tasks.length; i++) {
        var task = tasks[i];
        if (task.id === cursorId &&
            (!isAgenda || task.classList.contains(cursorIndent))) {
          return i;
        }
      }
    }
    return null;
  }

  function getCursorKey(isAgenda) {
    return makeTaskKey(cursorId, cursorIndent, isAgenda);
  }

  // Returns the <li> element which corresponds to the current cursorId.
  function getCursor() {
    return getTaskById(cursorId, cursorIndent);
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

  // TODO: Should this be cached in a variable? It often gets called multiple
  // times in an action.
  function checkIsAgendaMode() {
    return getId(AGENDA_VIEW_ID) !== null;
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

  // TODO: add issue tracker link?  What about warning?
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
    onDisable(function() {
      style.remove();
    });
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
  function getId(id) {
    return document.getElementById(id);
  }

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

  // Finds a parentElement which matches the specified predicate.
  function findParent(element, predicate) {
    while (element.parentElement !== null) {
      element = element.parentElement;
      if (predicate(element)) {
        return element;
      }
    }
    return null;
  }

  // Returns first child that matches the specified class and predicate.
  // TODO:
  // eslint-disable-next-line no-unused-vars
  function getFirstClass(parent, cls, predicate) {
    return findFirst(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one child element that matches the class name and
  // predicate, and returns it. Returns null if it is not found or not unique.
  function getUniqueClass(parent, cls, predicate) {
    return findUnique(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one child element that matches the class name,
  // and invokes the function on it. Logs a warning if there isn't exactly one.
  function withUniqueClass(parent, cls, predicate, f) {
    var result = getUniqueClass(parent, cls, predicate);
    if (result) {
      return f(result);
    } else {
      // TODO: This warning doesn't make it clear that the predicate could also
      // be the cause.
      warn("Couldn't find unique child with class", cls, 'instead got', result);
      return null;
    }
  }

  // Checks that there is only one child element that matches the tag and
  // predicate, and returns it. Returns null if it is not found or not unique.
  function getUniqueTag(parent, tag, predicate) {
    return findUnique(predicate, parent.getElementsByTagName(tag));
  }

  // Checks that there is only one child element that matches the tag, and
  // invokes the function on it. Logs a warning if there isn't exactly one.
  function withUniqueTag(parent, tag, predicate, f) {
    var result = getUniqueTag(parent, tag, predicate);
    if (result) {
      return f(result);
    } else {
      warn("Couldn't find unique child with tag", tag, 'instead got', result);
      return null;
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

  // Given a predicate, returns the first element that matches. If predicate is
  // null, then it is treated like 'unconditional'.
  function findFirst(predicate, array) {
    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (!predicate || predicate(element)) {
        return element;
      }
    }
    return null;
  }

  // Given a predicate, returns the only element that matches. If no elements
  // match, or multiple elements match, then nothing gets returned. If predicate
  // is null, then it is treated like 'unconditional'.
  function findUnique(predicate, array) {
    var result = null; for (var i = 0; i < array.length; i++) {var element = array[i];
      if (!predicate || predicate(element)) {
        if (result === null) {
          result = element;
        } else {
          debug("findUnique didn't find unique element because there are multiple results. Here are two:",
                result,
                element)
          // Not unique, so return null.
          return null;
        }
      }
    }
    return result;
  }

  /*****************************************************************************
   * Predicates (for use with get / with functions above)
   */

  // Predicate which always returns 'true'.
  function unconditional() {
    return true;
  }

  // Returns predicate which returns 'true' if text content matches wanted text.
  function matchingText(text) {
    return function(el) {
      return el.textContent === text;
    };
  }

  // Returns predicate which returns 'true' if text content doesn't match text.
  function notMatchingText(text) {
    return function(el) {
      return el.textContent !== text;
    };
  }

  // Returns predicate which returns 'true' if the element has the specified class.
  function matchingClass(cls) {
    return function(el) {
      return el.classList.contains(cls);
    };
  }

  // Predicate, returns 'true' if the element isn't hidden with 'display: none'.
  function notHidden(el) {
    return el.style.display !== 'none';
  }

  /*****************************************************************************
   * Allow loading todoist-shortcuts repeatedly in the terminal
   */

  (function() {
    if (window.oldTodoistShortcutsDisableActions) {
      var arr = window.oldTodoistShortcutsDisableActions;
      for (var i = 0; i < arr.length; i++) {
        arr[i]();
      }
    }
    window.oldTodoistShortcutsDisableActions = [];
  })();

  function onDisable(f) {
    window.oldTodoistShortcutsDisableActions.push(f);
  }

  /*****************************************************************************
   * Styling
   */

  // Static css styling.  This does the following:
  //
  // * Makes it so that the actions bar doesn't animate its opacity. This way,
  //   the bug worked around by topBarVisibilityHack is less apparent.
  addCss([
    '#' + ACTIONS_BAR_CLASS + ' {',
    '  opacity: 1 !important;',
    '}'
  ].join('\n'));

  // A CSS style element, dynamically updated by updateCursorStyle.
  var cursorStyle = addCss('');

  // This is unusual. Usually you would not dynamically generate CSS that uses
  // different IDs. However, this is a nice hack in this case, because todoist
  // frequently re-creates elements.
  function updateCursorStyle() {
    var selecter = getKeySelecter(cursorId, cursorIndent);
    cursorStyle.textContent = [
      selecter + ' {',
      '  border-left: 2px solid #4d90f0;',
      '  margin-left: -4px;',
      '}',
      selecter + ' .sel_checkbox_td {',
      '  padding-left: 2px;',
      '}',
      selecter + ' .arrow, ' + selecter + ' .drag_and_drop_handler {',
      '  margin-left: -16px;',
      '}'
    ].join('\n');
  }

  // See comment on 'getTaskById' for explanation
  function getKeySelecter(id, indent) {
    if (checkIsAgendaMode() && indent !== null) {
      return '#' + id + '.' + indent;
    } else {
      return '#' + id;
    }
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
  // eslint-disable-next-line no-undef
  var mousetrap = Mousetrap;

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  setCursorToFirstTask();
  registerMutationObserver();

  // Register key bindings
  (function() {
    for (var i = 0; i < bindings.length; i++) {
      if (bindings[i].length === 2) {
        mousetrap.bind(bindings[i][0], bindings[i][1]);
      } else {
        error('Improper binding entry at index', i, 'value is', bindings[i]);
      }
    }
  })();

  // Unregister key bindings when disabled.
  onDisable(function() {
    for (var i = 0; i < bindings.length; i++) {
      // eslint-disable-next-line no-undef
      mousetrap.unbind(bindings[i][0], bindings[i][1]);
    }
  });

  // Override some keybindings that interfere.  Specifically:
  //
  // * Ignore escape, because it deselects stuff, but we want to use it to close
  //   context menus and such.
  //
  // TODO: Is there a better way?
  setTimeout(function() {
    var oldOnkeydown = document.onkeydown;
    if (oldOnkeydown) {
      document.onkeydown = function(ev) {
        if (ev.keyCode !== 27) {
          /* TODO: This is an attempt at detecting when an task is inserted via
          enter. Use mutation observer instead?
          if (ev.keyCode === 13) {
            var oldTasks = getTasks();
            oldHandler(ev);
            var newTasks = getTasks();
            console.log("oldTasks", oldTasks.length, "newTasks", newTasks.length);
          } else {
          */
          oldOnkeydown(ev);
          // }
        }
      };
    } else {
      error('document keydown handler was not set.');
    }
  });
})();
