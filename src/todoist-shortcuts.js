// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/app*
// @include     http://todoist.com/app*
// @version     3
// @grant       none
// ==/UserScript==

(function() {
  'use strict';

  // Here's where the keybindings get specified. Of course, feel free to modify
  // this list, or modify this script in general.
  var KEY_BINDINGS = [

    // Add tasks
    ['q', quickAddTask],
    ['a', addTaskBottom],
    ['A', addTaskTop],

    // Navigation
    [['j', 'down'], cursorDown],
    [['k', 'up'], cursorUp],
    [['h', 'left'], collapse],
    [['l', 'right'], expand],
    ['g', navigate],

    // Manipulation of tasks at cursor
    ['enter', edit],
    ['O', addAbove],
    ['o', addBelow],
    [['J', 'shift+down'], moveDown],
    [['K', 'shift+up'], moveUp],
    [['H', 'shift+left'], moveOut],
    [['L', 'shift+right'], moveIn],

    // Selection
    ['x', toggleSelect],
    ['* a', selectAll],
    ['* n', deselectAll],
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    ['* 4', selectPriority('4')],

    // Manipulation of selected tasks
    ['t', ifThenElse(checkCalendarOpen, scheduleTomorrow, schedule)],
    ['m', moveToProject],
    ['d', done],
    ['e', archive],
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

    // Other
    ['u', undo],
    [['f', '/'], focusSearch],
    ['?', openShortcutsHelp],
    ['escape', closeContextMenus]
  ];

  // Which selection-oriented commands to apply to the cursor if there is no
  // selection. A few possible values:
  //
  // * "none" - never apply selection oriented commands to the cursor
  //
  // * "most" - apply to all commands that are easy to manually undo (everything
  //   but done / archive / delete)
  //
  // * "all" (default) - apply to all selection-oriented commands
  //
  var WHAT_CURSOR_APPLIES_TO = 'most';

  // Set this to true to get more log output.
  var DEBUG = false;

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
  var DELETE_TASK_TEXT = 'Delete task';
  var ADD_ABOVE_TEXT = 'Add task above';
  var ADD_BELOW_TEXT = 'Add task below';

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  var MORE_MENU_ITEMS =
    [ARCHIVE_TEXT, 'Duplicate', DELETE_TEXT, 'Add label', 'Remove label'];
  var TASKMENU_ITEMS =
    [ARCHIVE_TASK_TEXT, MOVE_TEXT, DELETE_TASK_TEXT];

  var TODOIST_SHORTCUTS_TIP = 'todoist_shortcuts_tip';
  var TODOIST_SHORTCUTS_WARNING = 'todoist_shortcuts_warning';

  var TODOIST_SHORTCUTS_GITHUB = 'https://github.com/mgsloan/todoist-shortcuts';
  var TODOIST_TESTED_VERSION = 889;

  // This user script will get run on iframes and other todoist pages. Should
  // skip running anything if #todoist_app doesn't exist.
  var todoistRootDiv = document.getElementById(TODOIST_ROOT_ID);
  if (!todoistRootDiv) return;

  /*****************************************************************************
   * Action combiners
   */

  // Take multiple actions (functions that take no arguments), and run them in
  // sequence.
  // eslint-disable-next-line no-unused-vars
  function sequence(actions) {
    return function() {
      for (var i = 0; i < actions.length; i++) {
        actions[i]();
      }
    };
  }

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
    withUniqueClass(getCursor(), EDIT_CLICK_CLASS, all, function(content) {
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

  // Clicks the 'schedule' link when tasks are selected.  If
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the
  // cursor if there is no selection.
  function schedule() {
    // Only open calendar if it isn't already open. This allows 't' to also be
    // used for selecting 'tomorrow'.
    if (getUniqueClass(document, CALENDAR_CLASS)) {
      debug('Not opening schedule because it is already open.');
    } else {
      var isAgenda = checkIsAgendaMode();
      var mutateCursor = getCursorToMutate();
      if (mutateCursor) {
        withTaskMenu(isAgenda, mutateCursor, function(menu) {
          withUniqueClass(menu, 'cmp_scheduler_more', all, click);
        });
      } else {
        withId(ACTIONS_BAR_CLASS, function(parent) {
          clickLink(parent, SCHEDULE_TEXT);
        });
      }
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
      withUniqueClass(calendar, 'cmp_scheduler_tomorrow', all, click);
    });
  }

  // Click 'next week' in schedule. Only does anything if schedule is open.
  function scheduleNextWeek() {
    withCalendar('scheduleNextWeek', function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_next_week', all, click);
    });
  }

  // Click 'next month' in schedule. Only does anything if schedule is open.
  function scheduleNextMonth() {
    withCalendar('scheduleNextMonth', function(calendar) {
      withUniqueClass(calendar, 'cmp_scheduler_month', all, click);
    });
  }

  // Click 'no due date' in schedule. Only does anything if schedule is open.
  function unschedule() {
    withCalendar('unschedule', function(calendar) {
      withUniqueClass(calendar, 'today_icon', matchingText('X'), click);
    });
  }

  // Clicks 'Move to project' for the selection. If WHAT_CURSOR_APPLIES_TO is
  // 'all' or 'most', then instead applies to the cursor if there is no
  // selection.
  function moveToProject() {
    var isAgenda = checkIsAgendaMode();
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskMenu(isAgenda, mutateCursor, MOVE_TEXT);
    } else {
      withId(ACTIONS_BAR_CLASS, function(parent) { clickLink(parent, MOVE_TEXT); });
    }
    // The keyboard shortcut used to invoke this also ends up in the completion
    // box. I thought stopPropagation would fix this, but it doesn't. So, empty
    // the completion input.
    setTimeout(function() { fillProjectInput(''); });
  }

  // Fills in the text of the project selection completion.
  function fillProjectInput(text) {
    withUniqueClass(document, PROJECT_COMPLETE_CLASS, all, function(complete) {
      withUniqueTag(complete, 'input', all, function(input) {
        input.value = text;
      });
    });
  }

  // Sets the priority of the selected tasks to the specified level. If
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the
  // cursor if there is no selection.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function setPriority(level) {
    return function() {
      var isAgenda = checkIsAgendaMode();
      var mutateCursor = getCursorToMutate(isAgenda);
      if (mutateCursor) {
        withTaskMenu(isAgenda, mutateCursor, function(menu) {
          clickPriorityMenu(isAgenda, menu, level);
        });
      } else {
        withUniqueClass(document, 'priority_menu', all, function(menu) {
          clickPriorityMenu(isAgenda, menu, level);
        });
      }
    };
  }

  // Adds tasks matching the specified priority level to the current selection,
  // even if they are hidden by collapsing.
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
          selected[getTaskKey(isAgenda, task)] = true;
          modified = true;
        }
      }
      if (modified) {
        setSelections(isAgenda, selected);
      }
    };
  }

  // Archive selected tasks. This seems to be similar to marking a task
  // complete.  The main variation in behavior between this and 'done' is that
  // for nested tasks, 'done' keeps them in the list but checks them off. Note
  // that this appears to be the same thing as marking a task complete.
  //
  // If WHAT_CURSOR_APPLIES_TO is 'all', then instead applies to the cursor if
  // there is no selection.
  function archive() {
    var isAgenda = checkIsAgendaMode();
    var mutateCursor = getCursorToMutate(isAgenda, 'dangerous');
    if (mutateCursor) {
      clickTaskMenu(isAgenda, mutateCursor, ARCHIVE_TASK_TEXT);
    } else {
      clickMenu(moreMenu, ARCHIVE_TEXT);
    }
  }

  // Mark all the tasks as completed. If WHAT_CURSOR_APPLIES_TO is 'all', then
  // instead applies to the cursor if there is no selection.
  function done() {
    var mutateCursor = getCursorToMutate(checkIsAgendaMode(), 'dangerous');
    if (mutateCursor) {
      clickTaskDone(mutateCursor);
    } else {
      // For some reason, only one task can be marked once at a time. So, the
      // timeout hack.  Means that the user will see intermediate UI updates,
      // but hey, it works.
      withSelectedTasks(function(task) {
        setTimeout(function() { clickTaskDone(task); });
      });
    }
  }

  // Delete selected tasks. Todoist will prompt for deletion. Since todoist
  // prompts, this is not treated as a 'dangerous' action.  As such, if
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the cursor if
  // there is no selection.
  function deleteTasks() {
    var isAgenda = checkIsAgendaMode();
    var mutateCursor = getCursorToMutate(isAgenda);
    if (mutateCursor) {
      clickTaskMenu(isAgenda, mutateCursor, DELETE_TASK_TEXT);
    } else {
      clickMenu(moreMenu, DELETE_TEXT);
    }
  }

  // Toggles collapse / expand task under the cursor, if it has children.
  function toggleCollapse() {
    withUniqueClass(getCursor(), ARROW_CLASS, all, click);
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

  // Add a task above / below cursor. Unfortunately these options do not exist
  // in agenda mode, so in that case, instead it is added to the current
  // section.
  function addAbove() { addAboveOrBelow(ADD_ABOVE_TEXT); }
  function addBelow() { addAboveOrBelow(ADD_BELOW_TEXT); }

  // Click somewhere on the page that shouldn't do anything in particular except
  // closing context menus.
  function closeContextMenus() {
    click(document.body);
  }

  // Switches to a navigation mode, where navigation targets are annotated
  // with letters to press to click.
  function navigate() {
    withId('projects_list', function(projectsUl) {
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];
      var finished = function() {};
      finished = registerMutationObserver(projectsUl, function() {
        setupNavigate(projectsUl, finished);
      }, { childList: true, subtree: true });
      setupNavigate(projectsUl, finished);
    });
  }

  // Clicks quick add task button.  Would be better to use todoist's builtin
  // shortcut, but that logic is currently WIP and broken.
  function quickAddTask() {
    withId('quick_add_task_holder', click);
  }

  // Add new task to the bottom of the list.
  function addTaskBottom() {
    todoistShortcut('a');
  }

  // Add new task to the top of the list.
  function addTaskTop() {
    todoistShortcut('A');
  }

  // Focus the search bar.
  function focusSearch() {
    todoistShortcut('/');
  }

  // Trigger undo by simulating a keypress.
  function undo() {
    todoistShortcut('u');
  }

  // Open help documentation.
  function openShortcutsHelp() {
    window.open(TODOIST_SHORTCUTS_GITHUB + '/blob/master/readme.md');
  }


  /** ***************************************************************************
   * Utilities for manipulating the UI
   */

  // MUTABLE.
  var lastShiftClicked = null;

  // MUTABLE.
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
    lastShiftClicked = task.id;
    lastShiftClickedIndent = getTaskIndentClass(task);
  }

  // Selects all tasks that have the specified id.
  function selectTaskId(id) {
    var isAgenda = checkIsAgendaMode();
    var selected = getSelectedTaskKeys(isAgenda);
    withClass(document, id, function(task) {
      selected[getTaskKey(isAgenda, task)] = true;
    });
    setSelections(isAgenda, selected);
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
  function setSelections(isAgenda, selections) {
    var startTime = Date.now();
    var allTasks = selectAllInternal();
    // Then deselect all of the things that shouldn't be selected.
    for (var i = 0; i < allTasks.length; i++) {
      var task = allTasks[i];
      var key = getTaskKey(isAgenda, task);
      if (!selections[key] && checkTaskIsSelected(task)) {
        shiftClickTask(task);
      }
    }
    debug('setSelections timing:', Date.now() - startTime);
  }

  // MUTABLE.
  var lastCursorTasks = [];

  // MUTABLE.
  var lastCursorIndex = [];

  // If the cursor exists, set 'lastCursorTasks' / 'lastCursorIndex'. If it
  // doesn't exist, then use previously stored info to place it after its prior
  // location.
  function ensureCursor(content) {
    // If there's an editor open to modify or add a task, then set the cursor
    // to the item above.
    var manager = getUniqueClass(content, 'manager');
    if (manager && manager.previousElementSibling) {
      setCursor(manager.previousElementSibling, 'no-scroll');
    }
    if (getCursor()) {
      debug('wrote down cursor context');
      lastCursorTasks = getTasks();
      lastCursorIndex = getCursorIndex(lastCursorTasks);
    } else {
      debug('cursor element disappeared, finding new location');
      var found = false;
      for (var i = lastCursorIndex; i < lastCursorTasks.length; i++) {
        var oldTask = lastCursorTasks[i];
        if (oldTask) {
          var task = getId(oldTask.id);
          if (task) {
            debug('found still-existing task that was after old cursor, setting cursor to it');
            found = true;
            setCursor(task, 'scroll');
            break;
          }
        }
      }
      if (!found) {
        debug('didn\'t find a particular task to select, so selecting last task');
        setCursorToLastTask('scroll');
      }
    }
  }

  var lastHash = null;

  function handleNavigation() {
    debug('handleNavigation');
    var currentHash = document.location.hash;
    if (lastHash !== currentHash) {
      lastHash = currentHash;
      setCursorToFirstTask('scroll');
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
          debug('Detected that top bar isn\'t visible when it should be.  Attempting workaround.');
          shiftClickTask(last);
          shiftClickTask(last);
          if (getId(ACTIONS_BAR_CLASS)) {
            debug('Workaround successful!');
          } else {
            warn('Workaround failed...');
          }
        } else {
          warn('Actions bar isn\'t visible even though there are selections, and last clicked task is gone.');
        }
      }
    }
  }

  // Registers mutation observers on elements that never get removed from the
  // DOM.  Run on initialization of todoist-shortcuts.
  function registerTopMutationObservers() {
    registerMutationObserver(document.body, topBarVisibilityHack);
    withId('editor', function(content) {
      debug('registering top level observer for', content);
      registerMutationObserver(content, handleNavigation);
      registerMutationObserver(content, function() {
        ensureCursor(content);
      }, { childList: true, subtree: true });
    });
  }

  // Registers a mutation observer that just observes modifications to its
  // child list.
  function registerMutationObserver(el, f, optionalOpts) {
    var opts = optionalOpts ? optionalOpts : { childList: true };
    var observer = new MutationObserver(f);
    observer.observe(el, opts);
    return onDisable(function() { observer.disconnect(); });
  }

  // For some reason todoist clears the selections even after applying things
  // like priority changes. This restores the selections.
  function withRestoredSelections(isAgenda, f) {
    var oldSelections = getSelectedTaskKeys();
    try {
      f();
    } finally {
      setSelections(isAgenda, oldSelections);
    }
  }

  // Finds a <a> element with the specified text and clicks it.
  function clickLink(parent, text) {
    withUniqueTag(parent, 'a', matchingText(text), click);
  }

  // Finds a menu element. These do not have any unique class or ID, so instead
  // need to do it by looking at text content of the options.
  function findMenu(name, expectedItems, predicate0, expectedCount0) {
    var predicate = predicate0 ? predicate0 : all;
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
  var taskMenu = findMenu('task', TASKMENU_ITEMS, all, 2);
  var agendaTaskMenu = findMenu('agenda task', TASKMENU_ITEMS, function(el) { return el !== taskMenu; });

  function clickMenu(menu, text) {
    if (menu) {
      withUniqueTag(menu, 'span', matchingText(text), click);
    } else {
      error('Can\'t perform action due to not finding menu element.');
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
  function clickTaskMenu(isAgenda, task, text) {
    withTaskMenu(isAgenda, task, function(menu) {
      clickMenu(menu, text);
    });
  }

  function withTaskMenu(isAgenda, task, f) {
    withUniqueTag(task, 'div', matchingClass('menu'), function(openMenu) {
      var menu = isAgenda ? agendaTaskMenu : taskMenu;
      if (hidden(menu)) {
        click(openMenu);
      } else {
        // If it's already visible, it might be for the wrong task.
        click(openMenu);
        // If it hides after clicking, then it was already associated with the
        // right task, click it again.
        if (hidden(menu)) {
          click(openMenu);
        }
      }
      f(menu);
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

  // Simulate a key press with todoist's global handlers.
  function todoistShortcut(options0) {
    var options = typeof options0 === 'string' ? { key: options0 } : options0;
    var ev = new Event('keydown');
    for (var o in options) { ev[o] = options[o]; }
    window.originalTodoistKeydown.apply(document, ev);
    ev = new Event('keyup');
    for (o in options) { ev[o] = options[o]; }
    window.originalTodoistKeyup.apply(document, ev);
    ev = new Event('keypress');
    for (o in options) { ev[o] = options[o]; }
    window.originalTodoistKeypress.apply(document, ev);
  }

  // Indent task.
  function moveIn() {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda) {
      warn('Indenting task does not work in agenda mode.');
    } else if (!cursor) {
      warn('No cursor to indent.');
    } else {
      dragTaskOver(cursor, function() {
        return {
          destination: cursor,
          horizontalOffset: 28,
          verticalOffset: 0
        };
      });
    }
  }

  // Dedent task.
  function moveOut() {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda) {
      warn('Dedenting task does not work in agenda mode.');
    } else if (!cursor) {
      warn('No cursor to dedent.');
    } else {
      dragTaskOver(cursor, function() {
        return {
          destination: cursor,
          horizontalOffset: -28,
          verticalOffset: 0
        };
      });
    }
  }

  // Move task up, maintaining its indent level and not swizzling any nested
  // structures.
  function moveUp() {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda) {
      warn('Moving task up does not work in agenda mode (yet).');
    } else if (!cursor) {
      warn('No cursor to move up.');
    } else {
      dragTaskOver(cursor, function() {
        var tasks = getTasks();
        var cursorIndex = getCursorIndex(tasks);
        for (var i = cursorIndex - 1; i >= 0; i--) {
          var task = tasks[i];
          var indent = getTaskIndentClass(task);
          if (indent === cursorIndent) {
            return {
              destination: task,
              horizontalOffset: 0,
              verticalOffset: cursor.clientHeight / -3
            };
          } else if (indent < cursorIndent) {
            warn('Refusing to dedent task to move it up.');
            return null;
          }
        }
        warn('Couldn\'t find task above cursor to move it above.');
        return null;
      });
    }
  }

  // Move task down, maintaining its indent level and not swizzling any nested
  // structures.
  function moveDown() {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda) {
      warn('Moving task down does not work in agenda mode (yet).');
    } else if (!cursor) {
      warn('No cursor to move down.');
    } else {
      dragTaskOver(cursor, function() {
        var tasks = getTasks();
        var cursorIndex = getCursorIndex(tasks);
        var lastQualifyingTask = null;
        for (var i = cursorIndex + 1; i < tasks.length; i++) {
          var task = tasks[i];
          var indent = getTaskIndentClass(task);
          // Logic here is a bit tricky.  The first time we encounter a task
          // at the same indent level, this is the subtree we want to move
          // past.  So, set lastQualifyingTask to non-null and keep track of
          // the last one.  After that, when we encounter something at a
          // lesser or equal indent to cursorIndent, we want to place it after
          // the last one.
          if (!lastQualifyingTask) {
            if (indent === cursorIndent) {
              lastQualifyingTask = task;
            } else if (indent < cursorIndent) {
              warn('Refusing to dedent task to move it down.');
              return null;
            }
          } else if (indent <= cursorIndent) {
            break;
          } else {
            lastQualifyingTask = task;
          }
        }
        if (lastQualifyingTask) {
          return {
            destination: lastQualifyingTask,
            horizontalOffset: 0,
            verticalOffset: cursor.clientHeight / 3
          };
        } else {
          warn('Couldn\'t find task below cursor to move it below.');
          return null;
        }
      });
    }
  }

  var dragInProgress = false;

  function dragTaskOver(sourceTask, findDestination) {
    var sourceY = sourceTask.offsetTop;
    if (dragInProgress) {
      warn('Not executing drag because one is already in progress.');
    } else {
      dragInProgress = true;
      try {
        withDragHandle(sourceTask, function(el, x, y) {
          var result = findDestination();
          if (result) {
            var deltaX = result.horizontalOffset;
            var deltaY = result.destination.offsetTop - sourceY + result.verticalOffset;
            animateDrag(el, x, y, x + deltaX, y + deltaY, function() { dragInProgress = false; });
          } else {
            dragInProgress = false;
          }
        }, function() { dragInProgress = false; });
      } catch (ex) {
        dragInProgress = false;
        throw ex;
      }
    }
  }

  function withDragHandle(task, f, finished) {
    var isAgenda = checkIsAgendaMode();
    var key = getTaskKey(isAgenda, task);
    task.dispatchEvent(new Event('mouseover'));
    try {
      var handler = getUniqueClass(task, 'drag_and_drop_handler');
      if (handler) {
        var x = handler.offsetLeft - window.scrollX;
        var y = handler.offsetTop - window.scrollY;
        f(handler, x, y);
      } else {
        // FIXME: Sometimes this triggers, particularly when move up / move
        // down key is held down with repeat.  Tried some hacks to resolve,
        // but nothing seems to work well.
        warn('Couldn\'t find drag_and_drop_handler.');
        finished();
      }
    } finally {
      withTaskByKey(key, function(el) {
        el.dispatchEvent(new Event('mouseout'));
      });
    }
  }

  function animateDrag(el, sx, sy, tx, ty, finished) {
    var startParams = mkMouseParams(sx, sy);
    el.dispatchEvent(new MouseEvent('mousedown', startParams));
    var startTime = Date.now();
    var duration = 100;
    var maxFrames = 10;
    // NOTE: Animating this may seem overkill, but doing a direct move didn't
    // work reliably.  This also makes it clearer what's happening.
    var dragLoop = function() {
      var alpha = (Date.now() - startTime) / duration;
      if (alpha >= 1) {
        var params = mkMouseParams(tx, ty);
        el.dispatchEvent(new MouseEvent('mousemove', params));
        el.dispatchEvent(new MouseEvent('mouseup', params));
        finished();
      } else {
        params = mkMouseParams(lerp(sx, tx, alpha), lerp(sy, ty, alpha));
        el.dispatchEvent(new MouseEvent('mousemove', params));
        setTimeout(dragLoop, duration / maxFrames);
      }
    };
    dragLoop();
  }

  function lerp(s, t, a) {
    return s * (1 - a) + t * a;
  }

  function mkMouseParams(x, y) {
    return {
      bubbles: true,
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y
    };
  }

  function clickTaskDone(task) {
    withUniqueClass(task, 'ist_checkbox', all, click);
  }

  // Common code implementing addAbove / addBelow.
  function addAboveOrBelow(menuText) {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda || cursor === null) {
      addToSectionContaining(isAgenda, cursor);
    } else {
      clickTaskMenu(isAgenda, cursor, menuText);
    }
  }

  // Clicks the "Add Task" button within the section that contains the specified
  // task.
  function addToSectionContaining(isAgenda, task) {
    var section = null;
    if (task) {
      section = findParentSection(isAgenda, task);
    } else if (isAgenda) {
      section = getFirstClass(document, 'section_day');
    } else {
      section = getFirstClass(document, 'project_editor_instance');
    }
    if (!section) {
      error('Couldn\'t find section for task', task);
      return;
    }
    if (isAgenda) {
      withUniqueClass(section, 'agenda_add_task', all, click);
    } else {
      withUniqueClass(section, 'action_add_item', all, click);
    }
  }

  function findParentSection(isAgenda, task) {
    if (isAgenda) {
      return findParent(task, matchingClass('section_day'));
    } else {
      return findParent(task, matchingClass('project_editor_instance'));
    }
  }

  var SHOULD_MUTATE_CURSOR = WHAT_CURSOR_APPLIES_TO === 'all' || WHAT_CURSOR_APPLIES_TO === 'most';
  var SHOULD_UNSAFE_MUTATE_CURSOR = WHAT_CURSOR_APPLIES_TO === 'all';

  // This function is used by commands that can be applied to both selections
  // and the cursor. It returns the cursor task under the following conditions:
  //
  // * The cursor exists, and there are no selections
  //
  // * The WHAT_CURSOR_APPLIES_TO setting allows for it.
  function getCursorToMutate(isAgenda, danger) {
    var cursor = getCursor();
    // TODO: Something more efficient than finding all selections if we just
    // want to know if there are any.
    if (cursor && isEmptyMap(getSelectedTaskKeys(isAgenda))) {
      // eslint-disable-next-line no-undefined
      if (danger === undefined) {
        if (SHOULD_MUTATE_CURSOR) {
          return cursor;
        }
      } else if (danger === 'dangerous') {
        if (SHOULD_UNSAFE_MUTATE_CURSOR) {
          return cursor;
        }
      } else {
        error('Unexpected 2nd argument to getCursorToMutate.  Expected undefined or "dangerous", but got:', danger);
      }
    }
    return null;
  }

  function clickPriorityMenu(isAgenda, menu, level) {
    withUniqueClass(menu, 'cmp_priority' + level, all, function(img) {
      withRestoredSelections(isAgenda, function() { click(img); });
    });
  }

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
        var key = getTaskKey(isAgenda, task);
        results[key] = true;
      }
    }
    return results;
  }

  // Get key used for the cursor, in the getSelectedTaskKeys map.
  function getTaskKey(isAgenda, task) {
    if (isAgenda === true) {
      return task.id + ' ' + getTaskIndentClass(task);
    } else if (isAgenda === false) {
      return task.id;
    } else {
      error('getTaskKey called with wrong number of arguments');
      return null;
    }
  }

  // eslint-disable-next-line no-unused-vars
  function makeTaskKey(isAgenda, id, indent) {
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

  // MUTABLE. Used to avoid infinite recursion of 'setupNavigate' due to it
  // being called on mutation of DOM that it mutates.
  var oldNavigateOptions = [];

  // Assigns key bindings to sections like inbox / today / various projects.
  // These keybindings get displayed along the options.  This function should
  // be re-invoked every time the DOM refreshes, in order to ensure they are
  // displayed. It overrides the keyboard handler such that it temporarily
  // expects a key.
  function setupNavigate(projectsUl, finished) {
    debug('Creating navigation shortcut tips');
    try {
      // Jump keys optimized to be close to homerow.
      var jumpkeys = Array.from('asdfghjkl' + 'qwertyuiop' + 'zxcvbnm' + '123467890');
      var options = {
        'i': maybeParent(getUniqueClass(document, 'cmp_filter_inbox', all, click)),
        't': maybeParent(getUniqueClass(document, 'cmp_filter_today', all, click)),
        'n': maybeParent(getUniqueClass(document, 'cmp_filter_days', all, click))
      };
      withTag(projectsUl, 'li', function(projectLi) {
        if (notHidden(projectLi)) {
          var key = null;
          // Take a key from the jumpkeys list that isn't already used.
          while (key === null && jumpkeys.length > 0) {
            var checkKey = jumpkeys.shift();
            if (!(checkKey in options)) {
              key = checkKey;
            }
          }
          options[key] = projectLi;
        }
      });
      var different = false;
      for (var key in options) {
        if (oldNavigateOptions[key] !== options[key]) {
          different = true;
        }
      }
      oldNavigateOptions = options;
      // Avoid infinite recursion. See comment on oldNavigateOptions.
      if (different) {
        debug('Different set of navigation options, so re-setting them.');
      } else {
        debug('Same set of navigation options, so avoiding infinite recursion.');
        return;
      }
      removeOldTips();
      // Add in tips to tell the user what key to press.
      for (key in options) {
        var el = options[key];
        if (!el) {
          error('Missing element for key', key);
        } else {
          var div = document.createElement('div');
          div.appendChild(document.createTextNode(key));
          div.classList.add(TODOIST_SHORTCUTS_TIP);
          el.appendChild(div);
        }
      }
      overrideKeyDown = function(ev) {
        var keepGoing = false;
        try {
          var li = options[ev.key];
          if (li) {
            click(li);
          // Space to scroll down.  Shift+space to scroll up.
          } else if (ev.key === 'Shift') {
            keepGoing = true;
          } else if (ev.key === ' ') {
            keepGoing = true;
            withId('left_menu', function(leftMenu) {
              if (ev.shiftKey) {
                leftMenu.scrollBy(0, leftMenu.clientHeight / -2);
              } else {
                leftMenu.scrollBy(0, leftMenu.clientHeight / 2);
              }
            });
          } else if (ev.keyCode !== 27) {
            // If the user pressed something other than "escape", warn about
            // not finding a jump target.
            warn('No navigation handler for ', ev);
          }
        } finally {
          if (!keepGoing) {
            // This is deferred, because the other key handlers may execute
            // after this one.
            setTimeout(function() { overrideKeyDown = null; });
            finished();
            removeOldTips();
          }
        }
      };
    } catch (ex) {
      finished();
      removeOldTips();
      throw ex;
    }
  }

  // Remove old tips if any still exist.
  function removeOldTips() {
    // FIXME: I can't quite explain this, but for some reason, querying the
    // list that matches the class name doesn't quite work.  So instead find
    // and remove until they are all gone.
    var toDelete = [];
    do {
      for (var i = 0; i < toDelete.length; i++) {
        var el = toDelete[i];
        el.parentElement.removeChild(el);
      }
      toDelete = document.getElementsByClassName(TODOIST_SHORTCUTS_TIP);
    } while (toDelete.length > 0);
  }

  function checkTodoistVersion() {
    try {
      var el = getUniqueClass(document, 'version');
      var todoistVersion = null;
      if (el) {
        var stripped = stripPrefix('Version', el.textContent);
        if (stripped) {
          todoistVersion = parseInt(stripped.trim(), 10);
        }
      }
      var warningPrefix = null;
      var warningSuffix = null;
      if (todoistVersion && todoistVersion < TODOIST_TESTED_VERSION) {
        warningPrefix =
          'Note: The version of todoist you are using is older than the version that ';
        warningSuffix =
          ' was tested with, version ' +
          TODOIST_TESTED_VERSION +
          '. Due to this mismatch, it might not behave as expected.';
      } else if (!todoistVersion || todoistVersion > TODOIST_TESTED_VERSION) {
        warningPrefix =
          'Note: The version of todoist you are using is newer than the version that ';
        warningSuffix =
          ' is tested with, version ' +
          TODOIST_TESTED_VERSION +
          '. Due to this mismatch, it might not behave as expected. Perhaps check for an updated version?';
      }
      if (warningPrefix && warningSuffix) {
        warn(warningPrefix, 'todoist-shortcuts', warningSuffix);
        var div = document.createElement('div');
        div.classList.add(TODOIST_SHORTCUTS_WARNING);
        div.appendChild(document.createTextNode(warningPrefix));
        var a = document.createElement('a');
        a.href = TODOIST_SHORTCUTS_GITHUB;
        a.appendChild(document.createTextNode('todoist-shortcuts'));
        div.appendChild(a);
        div.appendChild(document.createTextNode(warningSuffix));
        document.getElementById('page_background').appendChild(div);
      }
    } catch (ex) {
      error('Exception while checking Todoist version', ex);
    }
  }

  /** ***************************************************************************
   * Task cursor
   */

  // The id of the task that the cursor is on. MUTABLE.
  var cursorId = null;

  // The indent class of the task that the cursor is on. See 'getTaskById' for
  // detailed explanation. MUTABLE.
  var cursorIndent = null;

  // Class used on the single task that the cursor is on.
  var CURSOR_CLASS = 'userscript_cursor';

  // Sets the cursor to the first task, if any exists.
  function setCursorToFirstTask(shouldScroll) {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[0], shouldScroll);
    }
  }

  // Sets the cursor to the last task, if any exists.
  function setCursorToLastTask(shouldScroll) {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[tasks.length - 1], shouldScroll);
    }
  }

  // Given the element for a task, set it as the current selection.
  function setCursor(task, shouldScroll) {
    withClass(document, CURSOR_CLASS, function(oldCursor) {
      oldCursor.classList.remove(CURSOR_CLASS);
    });
    if (task) {
      cursorId = task.id;
      cursorIndent = getTaskIndentClass(task);
      updateCursorStyle();
      if (shouldScroll === 'scroll') {
        verticalScrollIntoView(task);
      } else if (shouldScroll !== 'no-scroll') {
        error('Unexpected shouldScroll argument to setCursor:', shouldScroll);
      }
    } else {
      cursorId = null;
    }
  }

  // Given a list of task elements (yielded by getTasks), returns the index
  // that corresponds to cursorId / cursorIndent.
  function getCursorIndex(tasks) {
    if (cursorId) {
      return getTaskIndex(checkIsAgendaMode(), tasks, cursorId, cursorIndent);
    } else {
      return null;
    }
  }

  // Returns index of task in list, identified by id and indent.
  function getTaskIndex(isAgenda, tasks, id, indent) {
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (task.id === id &&
          (!isAgenda || task.classList.contains(indent))) {
        return i;
      }
    }
    return null;
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
    setCursor(tasks[newIndex], 'scroll');
  }

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

  function error() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    args.push('Please report this as an issue to http://github.com/mgsloan/todoist-shortcuts');
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
      // TODO: for very large tasks, this could end up with the whole task not
      // being in view.
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
      warn('Couldn\'t find ID', id);
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

  // Invokes the function for every child element that matches a tag name.
  function withTag(parent, tag, f) {
    var els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Finds a parentElement which matches the specified predicate.
  function findParent(element, predicate) {
    var el = element;
    while (el.parentElement !== null) {
      el = el.parentElement;
      if (predicate(el)) {
        return el;
      }
    }
    return null;
  }

  // Gets parentElement attribute.  Returns null if element is null.
  function maybeParent(element) {
    return element ? element.parentElement : null;
  }

  // Returns first child that matches the specified class and predicate.
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
      warn('Couldn\'t find unique child with class', cls, 'and matching predicate, instead got', result);
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
      warn('Couldn\'t find unique child with tag', tag, 'instead got', result);
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
  // null, then it is treated like 'all'.
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
  // is null, then it is treated like 'all'.
  function findUnique(predicate, array) {
    var result = null;
    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (!predicate || predicate(element)) {
        if (result === null) {
          result = element;
        } else {
          debug('findUnique didn\'t find unique element because there are multiple results. Here are two:', result, element);
          // Not unique, so return null.
          return null;
        }
      }
    }
    return result;
  }

  // Returns string with prefix removed.  Returns null if prefix doesn't
  // match.
  function stripPrefix(prefix, string) {
    var found = string.slice(0, prefix.length);
    if (found === prefix) {
      return string.slice(prefix.length);
    } else {
      return null;
    }
  }

  // Simulate a mouse click.
  function click(el) {
    el.dispatchEvent(new Event('mousedown'));
    el.dispatchEvent(new Event('mouseup'));
    el.click();
  }

  /*****************************************************************************
   * Predicates (for use with get / with functions above)
   */

  // Predicate which always returns 'true'.
  function all() {
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

  // Predicate, returns 'true' if the element is hidden with 'display: none'.
  function hidden(el) {
    return el.style.display === 'none';
  }

  // Predicate, returns 'true' if the element isn't hidden with 'display: none'.
  function notHidden(el) {
    return el.style.display !== 'none';
  }

  // Given two predicates, uses && to combine them.
  // eslint-disable-next-line no-unused-vars
  function and(p1, p2) {
    return function(x) { return p1(x) && p2(x); };
  }

  // Given two predicates, uses || to combine them.
  // eslint-disable-next-line no-unused-vars
  function or(p1, p2) {
    return function(x) { return p1(x) || p2(x); };
  }

  /*****************************************************************************
   * Allow loading todoist-shortcuts repeatedly in the terminal
   */

  (function() {
    if (window.oldTodoistShortcutsDisableActions) {
      var arr = window.oldTodoistShortcutsDisableActions;
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] !== null) {
          arr[i]();
        }
      }
    }
    window.oldTodoistShortcutsDisableActions = [];
  })();

  // Registers an action to execute when another version of this script is
  // loaded.  Returns a function to run this action and remove it from the
  // cleanup actions.
  //
  // TODO: slight inefficiency in the usage here.  Would be good to not have
  // the list always grow.
  function onDisable(f) {
    var ix = window.oldTodoistShortcutsDisableActions.length;
    window.oldTodoistShortcutsDisableActions.push(f);
    return function() {
      window.oldTodoistShortcutsDisableActions[ix] = null;
      f();
    };
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
    '}',
    '',
    // Enables positioning of the tips.
    '#projects_list > li, li.filter {',
    '  position: relative;',
    '}',
    '',
    // TODO: I'd like to have these be to the left, but I think that would
    // require absolute positioning or similar.  They get clipped by overflow.
    '.' + TODOIST_SHORTCUTS_TIP + ' {',
    '  position: absolute;',
    '  top: 0.25em;',
    '  right: 0;',
    '  font-weight: normal;',
    '  font-size: 150%;',
    '  color: #dd4b39;',
    '}',
    '',
    '#page_background {',
    '  position: relative;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_WARNING + ' {',
    '  position: absolute;',
    '  bottom: 0.5em;',
    '  right: 0.5em;',
    '  width: 30em;',
    '  font-style: italic;',
    '}'
  ].join('\n'));

  // A CSS style element, dynamically updated by updateCursorStyle. MUTABLE.
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
      // FIXME: This is intended to make the drag and drop handler not move
      // when the cursor is on it.  Seems to have broken.  There is also a
      // tricky case when something is a nested task parent.
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

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  checkTodoistVersion();
  handleNavigation();
  registerTopMutationObservers();

  var overrideKeyDown = null;

  setTimeout(function() {
    // Remove todoist's global keyboard handler.
    //
    // FIXME: Writing these down seems to have fixed some uses of escape.
    // However, even so, when in the move-to-project dialog, escape does not
    // cancel it properly.  It would be nice if escape closed it.
    if (!window.originalTodoistKeydown) { window.originalTodoistKeydown = document.onkeydown; }
    if (!window.originalTodoistKeyup) { window.originalTodoistKeyup = document.onkeyup; }
    if (!window.originalTodoistKeypress) { window.originalTodoistKeypress = document.onkeypress; }
    document.onkeydown = function() {};
    document.onkeyup = function() {};
    document.onkeypress = function() {};

    // eslint-disable-next-line no-undef
    var mousetrap = new Mousetrap(document);

    // Register key bindings
    (function() {
      for (var i = 0; i < KEY_BINDINGS.length; i++) {
        if (KEY_BINDINGS[i].length === 2) {
          mousetrap.bind(KEY_BINDINGS[i][0], (
            // eslint-disable-next-line no-loop-func
            function(f) {
              return function() {
                if (!overrideKeyDown) {
                  f();
                }
              };
            })(KEY_BINDINGS[i][1])
          );
        } else {
          error('Improper binding entry at index', i, 'value is', KEY_BINDINGS[i]);
        }
      }
    })();

    // Unregister key bindings when disabled.
    onDisable(function() {
      for (var i = 0; i < KEY_BINDINGS.length; i++) {
        // eslint-disable-next-line no-undef
        mousetrap.unbind(KEY_BINDINGS[i][0], KEY_BINDINGS[i][1]);
      }
    });

    // TODO I think something like the following should work instead, registered
    // to the escape key handler. But it doesn't work, so instead there is this
    // workaround.
    //
    // todoistShortcut({ key: 'Escape', keyAscii: 27, keyCode: 27, which: 27, code: 'Escape' });

    function sometimesCallOriginal(f) {
      return function(ev) {
        if (!overrideKeyDown) {
          // Escape key is useful for exiting dialogs and other input boxes, so
          // should also use old todoist handler.
          if (ev.keyCode === 27) {
            f.apply(document, ev);
          }
        }
      };
    }

    function handleKeyDown(ev) {
      if (overrideKeyDown) {
        overrideKeyDown(ev);
      } else {
        sometimesCallOriginal(window.originalTodoistKeydown)(ev);
      }
    }

    document.addEventListener('keydown', handleKeyDown, false);
    document.addEventListener('keyup', sometimesCallOriginal(window.originalTodoistKeyup), false);
    document.addEventListener('keypress', sometimesCallOriginal(window.originalTodoistKeypress), false);
  });
})();
