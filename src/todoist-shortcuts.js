// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/app*
// @include     http://todoist.com/app*
// @include     https://beta.todoist.com/app*
// @include     http://beta.todoist.com/app*
// @version     9
// @grant       none
// ==/UserScript==

// See issue #11 for why ItemSelecter is used (it is added to the global scope
// by Todoist).

/* global ItemSelecter */

(function() {
  'use strict';

  var TODOIST_SHORTCUTS_VERSION = 9;

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
    ['^', cursorFirst],
    ['$', cursorLast],
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
    // NOTE: 'x' selection is handled by fallbackHandler below.
    ['* a', selectAll],
    ['* n', deselectAll],
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    ['* 4', selectPriority('4')],
    ['* h', collapseAll],
    ['* l', expandAll],

    // Manipulation of selected tasks
    ['t', schedule],
    ['v', moveToProject],
    ['d', done],
    ['e', archive],
    ['#', deleteTasks],
    ['1', setPriority('1')],
    ['2', setPriority('2')],
    ['3', setPriority('3')],
    ['4', setPriority('4')],

    // Sorting
    ['r', sortByAssignee],
    ['s', sortByDate],
    ['p', sortByPriority],

    // Other
    ['u', undo],
    [['f', '/'], focusSearch],
    ['?', openShortcutsHelp],
    ['escape', closeContextMenus],
    ['fallback', fallbackHandler]
  ];

  // Scheduling keybindings (used when scheduler is open)
  var SCHEDULE_BINDINGS = [
    ['d', scheduleToday],
    ['t', scheduleTomorrow],
    ['w', scheduleNextWeek],
    ['m', scheduleNextMonth],
    ['r', unschedule],
    ['escape', closeContextMenus]
  ];

  function fallbackHandler(e) {
    if (e.key === 'x') {
      if (e.type === 'keydown') {
        selectPressed();
        return false;
      } else if (e.type === 'keyup') {
        selectReleased();
        return false;
      }
    }
    return true;
  }

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
  var WHAT_CURSOR_APPLIES_TO = 'all';

  // 'navigate' (g) attempts to assign keys to items based on their names. In
  // some case there might not be a concise labeling. This sets the limit on key
  // sequence length for things based on prefixes.
  var MAX_NAVIGATE_PREFIX = 2;

  // Set this to true to get more log output.
  var DEBUG = false;

  // Set this to true to get a UI message directly in the page when the Todoist
  // version number is newer than expected. When false, instead the mismatch
  // warning just appears in a submenu. Mostly intended for developers of
  // todoist-shortcuts, as the version bumps too often for it to be reasonable
  // to do releases of the extension.
  var NOISY_VERSION_CHECK = false;

  // Constants for various todoist ids, classes, and text. Non-exhaustive. TODO: make it exhaustive.
  var TODOIST_ROOT_ID = 'todoist_app';
  var AGENDA_VIEW_ID = 'agenda_view';
  var EDIT_CLICK_CLASS = 'content';
  var ACTIONS_BAR_CLASS = 'item_selecter';
  var PROJECT_COMPLETE_CLASS = 'ist_complete_select';
  var ARROW_CLASS = 'arrow';
  var CALENDAR_CLASS = 'minical_container';
  var EXPANDED_ARROW_CLASS = 'cmp_open_arrow_down';
  var COLLAPSED_ARROW_CLASS = 'cmp_open_arrow_right';

  var MI_SCHEDULE = 'menu_item_schedule';
  var MI_MOVE = 'menu_item_move';
  var MI_ARCHIVE = 'menu_item_archive';
  var MI_DUPLICATE = 'menu_item_duplicate';
  var MI_DELETE = 'menu_item_delete';
  var MI_ADD_LABEL = 'menu_item_add_label';
  var MI_REMOVE_LABEL = 'menu_item_remove_label';
  var MI_ADD_ABOVE = 'menu_item_add_above';
  var MI_ADD_BELOW = 'menu_item_add_below';
  var MI_EDIT = 'menu_item_edit';

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  var MORE_MENU_ITEMS =
    [MI_ARCHIVE, MI_DUPLICATE, MI_DELETE, MI_ADD_LABEL, MI_REMOVE_LABEL];
  var TASKMENU_ITEMS =
    [MI_ARCHIVE, MI_DUPLICATE, MI_DELETE, MI_EDIT];

  var TODOIST_SHORTCUTS_TIP = 'todoist_shortcuts_tip';
  var TODOIST_SHORTCUTS_TIP_TYPED = 'todoist_shortcuts_tip_typed';
  var TODOIST_SHORTCUTS_WARNING = 'todoist_shortcuts_warning';
  var TODOIST_SHORTCUTS_NAVIGATE = 'todoist_shortcuts_navigate';

  var TODOIST_SHORTCUTS_GITHUB = 'https://github.com/mgsloan/todoist-shortcuts';
  var TODOIST_TESTED_VERSION = 901;

  // This user script will get run on iframes and other todoist pages. Should
  // skip running anything if #todoist_app doesn't exist.
  var todoistRootDiv = document.getElementById(TODOIST_ROOT_ID);
  if (!todoistRootDiv) return;

  // Set on initialization to mousetrap instance.
  var mousetrap = null;

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
  // eslint-disable-next-line no-unused-vars
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
  function cursorDown() {
    modifyCursorIndex(checkIsAgendaMode(), function(ix) { return ix + 1; });
  }
  function cursorUp() {
    modifyCursorIndex(checkIsAgendaMode(), function(ix) { return ix - 1; });
  }

  // Move the cursor to first / last task.
  function cursorFirst() {
    setCursorToFirstTask(checkIsAgendaMode(), 'scroll');
  }
  function cursorLast() {
    setCursorToLastTask(checkIsAgendaMode(), 'scroll');
  }

  // Edit the task under the cursor.
  function edit() {
    withUniqueClass(getCursor(), EDIT_CLICK_CLASS, all, function(content) {
      content.dispatchEvent(new Event('mousedown'));
    });
  }

  // Toggles selection of the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  function toggleSelect() {
    var cursor = getCursor();
    if (cursor) {
      toggleSelectTask(cursor);
    } else {
      warn("No cursor, so can't toggle selection.");
    }
  }

  // Selects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  function select() {
    var cursor = getCursor();
    if (cursor) {
      selectTask(cursor);
    } else {
      warn("No cursor, so can't select.");
    }
  }

  // Deselects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  function deselect() {
    var cursor = getCursor();
    if (cursor) {
      deselectTask(cursor);
    } else {
      warn("No cursor, so can't deselect.");
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
      var mutateCursor = getCursorToMutate(isAgenda);
      if (mutateCursor) {
        withTaskMenu(isAgenda, mutateCursor, function(menu) {
          withUniqueClass(menu, 'cmp_scheduler_more', all, click);
        });
      } else {
        withId(ACTIONS_BAR_CLASS, function(parent) {
          withUniqueClass(parent, MI_SCHEDULE, all, click);
        });
      }
    }
  }

  // Click 'today' in schedule. Only does anything if schedule is open.
  function scheduleToday() {
    withCalendar('scheduleToday', function(calendar) {
      withUniqueClass(calendar, 'icon_today', notMatchingText('X'), click);
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
      withUniqueClass(calendar, 'icon_today', matchingText('X'), click);
    });
  }

  // Clicks 'Move to project' for the selection. If WHAT_CURSOR_APPLIES_TO is
  // 'all' or 'most', then instead applies to the cursor if there is no
  // selection.
  function moveToProject() {
    var isAgenda = checkIsAgendaMode();
    var mutateCursor = getCursorToMutate(isAgenda);
    if (mutateCursor) {
      clickTaskMenu(isAgenda, mutateCursor, MI_MOVE);
    } else {
      withId(ACTIONS_BAR_CLASS, function(parent) {
        withUniqueClass(parent, MI_MOVE, all, click);
      });
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
      var allTasks = getTasks('include-collapsed');
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
      clickTaskMenu(isAgenda, mutateCursor, MI_ARCHIVE);
    } else {
      clickMenu(moreMenu, MI_ARCHIVE);
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
      clickTaskMenu(isAgenda, mutateCursor, MI_DELETE);
    } else {
      clickMenu(moreMenu, MI_DELETE);
    }
  }

  // Toggles collapse / expand task under the cursor, if it has children.
  function toggleCollapse() {
    withUniqueClass(getCursor(), ARROW_CLASS, all, click);
  }

  // Collapses or expands task under the cursor, that have children. Does
  // nothing if it's already in the desired state.
  function collapse() { if (checkCursorExpanded()) { toggleCollapse(); } }
  function expand() { if (checkCursorCollapsed()) { toggleCollapse(); } }

  // Collapses or expands all tasks.
  function collapseAll() { repeatedlyClickArrows(EXPANDED_ARROW_CLASS); }
  function expandAll() { repeatedlyClickArrows(COLLAPSED_ARROW_CLASS); }

  // Clears all selections.
  function deselectAll() { ItemSelecter.deselectAll(); }

  // Selects all tasks, even those hidden by collapsing.
  function selectAll() {
    var allTasks = getTasks('include-collapsed');
    for (var i = 0; i < allTasks.length; i++) {
      selectTask(allTasks[i]);
    }
  }

  // Add a task above / below cursor. Unfortunately these options do not exist
  // in agenda mode, so in that case, instead it is added to the current
  // section.
  function addAbove() { addAboveOrBelow(MI_ADD_ABOVE); }
  function addBelow() { addAboveOrBelow(MI_ADD_BELOW); }

  // Click somewhere on the page that shouldn't do anything in particular except
  // closing context menus.
  function closeContextMenus() {
    click(document.body);
  }

  // Switches to a navigation mode, where navigation targets are annotated
  // with letters to press to click.
  function navigate() {
    withId('list_holder', function(listHolder) {
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];
      finishNavigate = registerMutationObserver(listHolder, function() {
        setupNavigate(listHolder);
      }, { childList: true, subtree: true });
      setupNavigate(listHolder);
    });
  }

  // Clicks quick add task button.  Would be better to use todoist's builtin
  // shortcut, but that logic is currently WIP and broken.
  function quickAddTask() {
    withId('quick_add_task_holder', click);
  }

  // Add new task to the bottom of the list.
  function addTaskBottom() { todoistShortcut('a'); }

  // Add new task to the top of the list.
  function addTaskTop() { todoistShortcut('A'); }

  // Focus the search bar.
  function focusSearch() { todoistShortcut('/'); }

  // Trigger undo by simulating a keypress.
  function undo() { todoistShortcut('u'); }

  // Trigger sort-by-date by simulating a keypress.
  function sortByDate() { todoistShortcut('s'); }

  // Trigger sort-by-priority by simulating a keypress.
  function sortByPriority() { todoistShortcut('p'); }

  // Trigger sort-by-assignee by simulating a keypress.
  function sortByAssignee() { todoistShortcut('r'); }

  // Open help documentation.
  function openShortcutsHelp() {
    window.open(
      TODOIST_SHORTCUTS_GITHUB + '/blob/v' +
      TODOIST_SHORTCUTS_VERSION + '/readme.md');
  }

  /** ***************************************************************************
   * Utilities for manipulating the UI
   */


  function toggleSelectTask(task) {
    ItemSelecter.toggle(task);
  }

  function selectTask(task) {
    if (!checkTaskIsSelected(task)) {
      ItemSelecter.toggle(task);
    }
  }

  function deselectTask(task) {
    if (checkTaskIsSelected(task)) {
      ItemSelecter.toggle(task);
    }
  }

  // Ensures that the specified task ids are selected (specified by a set-like
  // object).
  function setSelections(isAgenda, selections) {
    var allTasks = getTasks('include-collapsed');
    for (var i = 0; i < allTasks.length; i++) {
      var task = allTasks[i];
      var key = getTaskKey(isAgenda, task);
      if (selections[key]) {
        selectTask(task);
      } else {
        deselectTask(task);
      }
    }
  }

  // All MUTABLE. Only mutated by 'storeCursorContext'.
  var lastCursorTasks = [];
  var lastCursorIndex = -1;
  var lastCursorId = null;
  var lastCursorIndent = null;
  var lastCursorSection = null;
  var mouseGotMoved = false;
  var selectionMode = 'none';
  var wasEditing = false;

  function storeCursorContext(isAgenda, cursor, editing) {
    lastCursorTasks = getTasks();
    lastCursorIndex = lastCursorTasks.indexOf(cursor);
    if (lastCursorIndex < 0) {
      error('Invariant violation - couldn\'t find ', cursor, 'in', lastCursorTasks);
    }
    lastCursorId = cursor.id;
    lastCursorIndent = getTaskIndentClass(cursor);
    lastCursorSection = getSectionName(isAgenda, cursor);
    mouseGotMoved = false;
    wasEditing = editing;
    handleCursorMove(cursor);
    debug(
      'wrote down cursor context:',
      'id =', lastCursorId,
      'indent =', lastCursorIndent,
      'section =', lastCursorSection,
      'idx =', lastCursorIndex);
  }

  function handleMouseMove() {
    mouseGotMoved = true;
  }

  // FIXME: If the select key was very recently released on this task, then this
  // should not toggle the state.
  function selectPressed() {
    var cursor = getCursor();
    if (cursor) {
      if (checkTaskIsSelected(cursor)) {
        selectionMode = 'deselect';
      } else {
        selectionMode = 'select';
      }
    } else {
      selectionMode = 'select';
    }
    handleCursorMove(cursor);
  }

  function selectReleased() {
    selectionMode = 'none';
  }

  function handleCursorMove(cursor) {
    switch (selectionMode) {
    case 'none':
      break;
    case 'select':
      selectTask(cursor);
      break;
    case 'deselect':
      deselectTask(cursor);
      break;
    default:
      error('Invariant violated, unexpected selectionMode:', selectionMode);
    }
  }

  // If the cursor exists, set 'lastCursorTasks' / 'lastCursorIndex'. If it
  // doesn't exist, then use previously stored info to place it after its prior
  // location.
  function ensureCursor(content) {
    debug('ensuring cursor');
    var isAgenda = checkIsAgendaMode();
    // If there's an editor open to add a task, then set the cursor to the item
    // above.
    var manager = getUniqueClass(content, 'manager');
    if (manager) {
      var tasks = getTasks('no-collapsed', 'include-editors');
      var managerIndex = tasks.findIndex(function(task) {
        return task.classList.contains('manager');
      });
      if (managerIndex > 0) {
        storeCursorContext(isAgenda, tasks[managerIndex - 1], true);
      } else {
        error('There seems to be a task editor, but then couldn\'t find it.');
      }
      return;
    }
    var cursor = getCursorOrOnLeft();
    if (cursor === 'OnLeft') {
      debug('Cursor is in the sidebar, not updating task cursor.');
      return;
    }
    // Detect if the cursor has changed section. This can happen when the user
    // re-schedules it or moves it to a different project. I find it nicer if
    // the cursor doesn't follow the task for these moves, hence this logic.
    var changedSection = false;
    var currentSection = null;
    if (cursor && !wasEditing) {
      var cursorIndent = getTaskIndentClass(cursor);
      if (lastCursorId === cursor.id && lastCursorIndent === cursorIndent) {
        debug(
          'Cursor hasn\'t changed task:',
          'id =', cursor.id,
          'indent =', cursorIndent);
        currentSection = getSectionName(isAgenda, cursor);
        changedSection = currentSection !== lastCursorSection;
      } else if (!mouseGotMoved) {
        debug('Cursor changed without mouse moving. This can happen on scroll, so attempting to move it back to where it was.');
        var lastCursor = getTaskById(lastCursorId, lastCursorIndent);
        if (lastCursor) {
          setCursor(isAgenda, lastCursor, 'no-scroll');
          return;
        } else {
          warn('Expected to find last cursor position, but could\'nt find it.');
        }
      } else {
        debug('Cursor moved by the mouse');
        storeCursorContext(isAgenda, cursor, false);
        return;
      }
    }
    if (cursor && !changedSection) {
      storeCursorContext(isAgenda, cursor, false);
    } else {
      if (changedSection) {
        debug('cursor element changed section, finding new location');
      } else {
        debug('cursor element disappeared, finding new location');
      }
      restoreLastCursor(isAgenda);
    }
  }

  function restoreLastCursor(isAgenda) {
    var found = false;
    if (lastCursorIndex > 0) {
      if (wasEditing) {
        var task = getById(lastCursorTasks[lastCursorIndex].id);
        if (task) {
          var tasks = getTasks();
          var priorIndex = tasks.indexOf(task);
          if (priorIndex >= 0 && priorIndex < tasks.length - 1) {
            debug('found task that is probably the one that was previously being edited');
            found = true;
            setCursor(isAgenda, tasks[priorIndex + 1], 'no-scroll');
          }
        } else {
          warn('expected to still find task that was above the one being edited.');
        }
      } else {
        for (var i = lastCursorIndex; i < lastCursorTasks.length; i++) {
          var oldTask = lastCursorTasks[i];
          if (oldTask) {
            task = getById(oldTask.id);
            if (task) {
              debug(
                'found still-existing task that is',
                i - lastCursorIndex,
                'tasks after old cursor position, at',
                lastCursorIndex,
                ', setting cursor to it');
              found = true;
              setCursor(isAgenda, task, 'no-scroll');
              break;
            }
          }
        }
      }
    } else {
      warn('lastCursorIndex wasn\'t set yet');
    }
    if (!found) {
      debug('didn\'t find a particular task to select, so selecting last task');
      setCursorToLastTask(isAgenda, 'no-scroll');
    }
  }

  // Gets the name of the section that a task is in.
  function getSectionName(isAgenda, task) {
    var predicate =
        isAgenda
          ? or(matchingClass('section_overdue'), matchingClass('section_day'))
          : matchingClass('list_editor');
    var section = findParent(task, predicate);
    var result = null;
    if (section) {
      withUniqueClass(section, isAgenda ? 'subsection_header' : 'section_header', all, function(header) {
        result = header.textContent;
      });
    }
    if (!result) {
      error('Failed to find section name for', task);
    }
    return result;
  }

  var lastHash = null;

  function handlePageChange() {
    debug('handlePageChange');
    var currentHash = document.location.hash;
    if (lastHash !== currentHash) {
      var isAgenda = checkIsAgendaMode();
      lastHash = currentHash;
      debug('Setting cursor to first task after navigation');
      setCursorToFirstTask(isAgenda, 'scroll');
    }
  }

  // Registers mutation observers on elements that never get removed from the
  // DOM.  Run on initialization of todoist-shortcuts.
  function registerTopMutationObservers() {
    withId('editor', function(content) {
      debug('registering top level observer for', content);
      registerMutationObserver(content, handlePageChange);
      registerMutationObserver(content, function() {
        ensureCursor(content);
      }, { childList: true, subtree: true });
    });
    registerMutationObserver(document.body, updateKeymap);
  }

  function updateKeymap() {
    if (mousetrap) {
      if (checkCalendarOpen()) {
        debug('Setting keymap to schedule');
        mousetrap.switchKeymap('schedule');
      } else {
        debug('Setting keymap to default');
        mousetrap.switchKeymap('default');
      }
    }
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
          if (!getUniqueClass(menu, expectedItems[i])) {
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
      error('Couldn\'t find unique \'' + name + '\' menu element, found:', results);
      return null;
    }
  }

  // These are menus that are always in the DOM, but need to be located by text
  // matching their options.
  var moreMenu = findMenu('More...', MORE_MENU_ITEMS);
  var taskMenu = findMenu('task', TASKMENU_ITEMS, all, 2);
  var agendaTaskMenu = findMenu('agenda task', TASKMENU_ITEMS, function(el) { return el !== taskMenu; });

  function clickMenu(menu, cls) {
    withUniqueClass(menu, cls, all, function(container) {
      withUniqueTag(container, 'span', all, click);
    });
  }

  // Returns true if the node under the cursor has children and is collapsed.
  function checkCursorCollapsed() {
    return getUniqueClass(getCursor(), COLLAPSED_ARROW_CLASS);
  }

  // Returns true if the node under the cursor has children and is expanded.
  function checkCursorExpanded() {
    return getUniqueClass(getCursor(), EXPANDED_ARROW_CLASS);
  }

  // Click elements within the content which match the specified class.
  // Persistently clicks until the class can no longer be found. Used to
  // collapse / expand all items.
  function repeatedlyClickArrows(cls) {
    withId('content', function(content) {
      var clickedSomething = false;
      var doClick = function(el) {
        click(el);
        clickedSomething = true;
      };
      for (var i = 0; i < 100; i++) {
        withClass(content, cls, doClick);
        if (!clickedSomething) break;
        if (i === 99) {
          warn('iteratively clicked arrows 100 times but they didn\'t all toggle');
        }
      }
    });
  }

  // Opens up the task's contextual menu and clicks an item via text match.
  function clickTaskMenu(isAgenda, task, cls) {
    withTaskMenu(isAgenda, task, function(menu) {
      clickMenu(menu, cls);
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
        var cursorIndex = tasks.indexOf(cursor);
        var cursorIndent = getTaskIndentClass(cursor);
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
        var cursorIndex = tasks.indexOf(cursor);
        var cursorIndent = getTaskIndentClass(cursor);
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
  function addAboveOrBelow(menuCls) {
    var isAgenda = checkIsAgendaMode();
    var cursor = getCursor();
    if (isAgenda || cursor === null) {
      addToSectionContaining(isAgenda, cursor);
    } else {
      clickTaskMenu(isAgenda, cursor, menuCls);
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
      if (section.classList.contains('section_overdue')) {
        section = getFirstClass(document, 'section_day');
      }
      withUniqueClass(section, 'agenda_add_task', all, click);
    } else {
      withUniqueClass(section, 'action_add_item', all, click);
    }
  }

  function findParentSection(isAgenda, task) {
    if (isAgenda) {
      return findParent(task, or(matchingClass('section_day'), matchingClass('section_overdue')));
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
  function getTasks(includeCollapsed, includeEditors) {
    var shouldIncludeCollapsed = false;
    if (includeCollapsed === 'include-collapsed') {
      shouldIncludeCollapsed = true;
    } else if (includeCollapsed && includeCollapsed !== 'no-collapsed') {
      error('Unexpected value for includeCollapsed:', includeCollapsed);
      return [];
    }
    var shouldIncludeEditors = false;
    if (includeEditors === 'include-editors') {
      shouldIncludeEditors = true;
    } else if (includeEditors && includeEditors !== 'no-editors') {
      error('Unexpected value for includeEditors:', includeEditors);
      return [];
    }
    var results = [];
    withTag(document, 'li', function(item) {
      // Skip elements which don't correspond to tasks
      var classMatches =
        !item.classList.contains('reorder_item') &&
        (  item.classList.contains('task_item')
        || (item.classList.contains('manager') && shouldIncludeEditors)
        );
      // Skip nested tasks that are not visible (if includeCollapsed is not set).
      var visible = shouldIncludeCollapsed || notHidden(item);
      if (classMatches && visible) {
        results.push(item);
      }
    });
    return results;
  }

  // This applies the function to every selected task.
  function withSelectedTasks(f) {
    var tasks = getTasks('include-collapsed');
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
    var tasks = getTasks('include-collapsed');
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

  // MUTABLE. When set, this function should be called when navigate mode
  // finished.
  var finishNavigate = null;

  // MUTABLE. Current set of navigate options.
  var navigateOptions = {};

  // MUTABLE. Used to avoid infinite recursion of 'setupNavigate' due to it
  // being called on mutation of DOM that it mutates.
  var oldNavigateOptions = {};

  // MUTABLE. Keys the user has pressed so far.
  var navigateKeysPressed = "";

  // Assigns key bindings to sections like inbox / today / various projects.
  // These keybindings get displayed along the options.  This function should
  // be re-invoked every time the DOM refreshes, in order to ensure they are
  // displayed. It overrides the keyboard handler such that it temporarily
  // expects a key.
  function setupNavigate(listHolder) {
    document.body.classList.add(TODOIST_SHORTCUTS_NAVIGATE);
    debug('Creating navigation shortcut tips');
    try {
      var navigateItems = [];
      withTag(listHolder, 'li', function(li) {
        var key = null;
        var mustBeKeys = null;
        var text = null;
        if (getUniqueClass(li, 'cmp_filter_inbox')) {
          mustBeKeys = 'i';
        } else if (getUniqueClass(li, 'cmp_filter_today')) {
          mustBeKeys = 'g';
        } else if (getUniqueClass(li, 'cmp_filter_days')) {
          mustBeKeys = 'n';
        } else {
          withUniqueClass(li, 'name', all, function(nameElement) {
            withUniqueTag(nameElement, 'span', all, function(nameSpan) {
              text = preprocessItemText(nameSpan.textContent);
            });
          });
        }
        // Add some stable sequences for common text
        if (text === 'priority1') { mustBeKeys = 'p1'; }
        if (text === 'priority2') { mustBeKeys = 'p2'; }
        if (text === 'priority3') { mustBeKeys = 'p3'; }
        if (text === 'priority4') { mustBeKeys = 'p4'; }
        if (text === 'assignedtome') { mustBeKeys = 'am'; }
        if (text === 'assignedtoothers') { mustBeKeys = 'ao'; }
        if (text === 'viewall') { mustBeKeys = 'va'; }
        if (text === 'noduedate') { mustBeKeys = 'dn'; }
        if (mustBeKeys) {
          navigateItems.push({
            element: li,
            mustBeKeys: mustBeKeys,
            text: text
          });
        } else if (text) {
          navigateItems.push({
            element: li,
            text: text
          });
        } else {
          warn('Couldn\'t figure out text for', li);
        }
      });
      withClass(listHolder, 'panel_summary', function(summary) {
        var mustBeKeys = null;
        var dataTrackAttr = summary.attributes['data-track'];
        if (dataTrackAttr) {
          var dataTrack = dataTrackAttr.value;
          if (dataTrack === 'navigation|projects_panel') {
            mustBeKeys = 'tp';
          } else if (dataTrack === 'navigation|labels_panel') {
            mustBeKeys = 'tl';
          } else if (dataTrack === 'navigation|filters_panel') {
            mustBeKeys = 'tf';
          } else {
            warn('Unexpected dataTrack value:', dataTrack);
          }
        }
        if (mustBeKeys) {
          navigateItems.push({
            element: summary,
            mustBeKeys: mustBeKeys,
            keepGoing: true
          });
        }
      });
      navigateOptions = assignKeysToItems(navigateItems);
      var different = false;
      for (var key in navigateOptions) {
        var oldOption = oldNavigateOptions[key];
        if (!oldOption) {
          different = true;
          break;
        } else if (oldOption.element !== navigateOptions[key].element) {
          different = true;
          break;
        }
      }
      oldNavigateOptions = navigateOptions;
      // Avoid infinite recursion. See comment on oldNavigateOptions.
      if (different) {
        debug('Different set of navigation options, so re-setting them.');
      } else {
        debug('Same set of navigation options, so avoiding infinite recursion.');
        return;
      }
      navigateKeysPressed = "";
      if (rerenderTips()) {
        mousetrap.switchKeymap('navigate');
      }
    } catch (ex) {
      if (finishNavigate) { finishNavigate(); }
      removeOldTips();
      document.body.classList.remove(TODOIST_SHORTCUTS_NAVIGATE);
      throw ex;
    }
  }

  // Add in tips to tell the user what key to press.
  function rerenderTips() {
    removeOldTips();
    var renderedAny = false;
    for (var key in navigateOptions) {
      var prefix = key.slice(0, navigateKeysPressed.length);
      var rest = key.slice(navigateKeysPressed.length);
      if (prefix === navigateKeysPressed) {
        var option = navigateOptions[key];
        var el = option.element;
        if (!el) {
          error('Missing element for tip', key);
        } else {
          var div = document.createElement('div');
          if (prefix.length > 0) {
            var typed = document.createElement('div');
            typed.appendChild(document.createTextNode(prefix));
            typed.classList.add(TODOIST_SHORTCUTS_TIP_TYPED);
            div.appendChild(typed);
          }
          div.appendChild(document.createTextNode(rest));
          div.classList.add(TODOIST_SHORTCUTS_TIP);
          el.prepend(div);
          renderedAny = true;
        }
      }
    }
    return renderedAny;
  }

  // Lowercase and take only alphanumeric.
  function preprocessItemText(text) {
    var result = "";
    for (var i = 0; i < text.length; i++) {
      var char = text[i].toLowerCase();
      if (lowercaseCharIsAlphanum(char)) {
        result += char;
      }
    }
    return result;
  }

  function lowercaseCharIsAlphanum(char) {
    var code = char.charCodeAt(0);
    return (
      (code > 47 && code < 58) || // (0-9)
      (code > 96 && code < 123));  // (a-z)
  }

  var JUMP_KEYS = 'asdfghjklqwertyuiopzxcvbnm1234567890';

  // Assign keys to items based on their text.
  function assignKeysToItems(items) {
    var result = {};
    var item;
    var keys;
    var prefix;
    var prefixesUsed = {};
    // Ensure none of the results are prefixes or equal to this keysequence.
    var prefixNotAliased = function(ks) {
      for (var i = 1; i <= ks.length; i++) {
        if (result[ks.slice(0, i)]) {
          return false;
        }
      }
      return true;
    };
    var noAliasing = function(ks) {
      if (!prefixNotAliased(ks)) {
        return false;
      }
      // Ensure this is keysequence is not a prefix of any other keysequence.
      if (prefixesUsed[ks]) {
        return false;
      }
      return true;
    };
    var addResult = function(ks, x) {
      var noAlias = noAliasing(ks);
      if (noAlias) {
        result[ks] = x;
        for (var i = 1; i <= ks.length; i++) {
          prefixesUsed[ks.slice(0, i)] = true;
        }
      }
      return noAlias;
    };
    // Handle items with 'mustBeKeys' set.
    for (var i = 0; i < items.length; i++) {
      item = items[i];
      if (item.mustBeKeys) {
        keys = item.mustBeKeys.toLowerCase();
        if (addResult(keys, item)) {
          // Remove this from the list of items to process.
          items.splice(i, 1);
          i--;
        } else {
          warn('Overlap in mustBeKeys', keys);
        }
      }
    }
    // For each possible prefix length, assign when unambiguous.
    for (var l = 1; l <= MAX_NAVIGATE_PREFIX; l++) {
      var groups = {};
      for (var j = 0; j < items.length; j++) {
        item = items[j];
        prefix = item.text.slice(0, l);
        var group = groups[prefix];
        if (!group) {
          group = [];
          groups[prefix] = group;
        }
        group.push(j);
      }
      var unambiguous = [];
      for (keys in groups) {
        var groupItems = groups[keys];
        // Unambiguous prefix of non-aliasing sequence
        if (groupItems.length === 1 && noAliasing(keys)) {
          unambiguous.push(groupItems[0]);
        }
      }
      // sort backwards so that deletion works.
      unambiguous.sort(function(a, b) { return b - a; });
      for (var k = 0; k < unambiguous.length; k++) {
        var ix = unambiguous[k];
        item = items[ix];
        prefix = item.text.slice(0, l);
        if (addResult(prefix, item)) {
          items.splice(ix, 1);
        }
      }
    }
    // For the ones that didn't have unambiguous prefixes, try other character
    // suffixes.
    for (var p = MAX_NAVIGATE_PREFIX - 1; p >= 0; p--) {
      for (var m = 0; m < items.length; m++) {
        item = items[m];
        prefix = item.text.slice(0, MAX_NAVIGATE_PREFIX - 1);
        if (prefixNotAliased(prefix)) {
          for (var n = -1; n < JUMP_KEYS.length; n++) {
            if (n === -1) {
              if (prefix.length > 0) {
                // First, try doubling the last key, easiest to type.
                keys = prefix + prefix[prefix.length - 1];
              } else {
                continue;
              }
            } else {
              keys = prefix + JUMP_KEYS[n];
            }
            if (addResult(keys, item)) {
              items.splice(m, 1);
              m--;
              break;
            }
          }
        }
      }
    }
    // Finally, fallback on choosing arbitrary combinations of characters.
    for (var q = 0; q < items.length; q++) {
      item = items[q];
      var success = false;
      // TODO: Don't hardcode choosing one or two, instead follow MAX_NAVIGATE_PREFIX
      for (var r = 0; r < JUMP_KEYS.length; r++) {
        if (addResult(JUMP_KEYS[r], item)) {
          items.splice(q, 1);
          q--;
          success = true;
          break;
        }
      }
      if (success) {
        continue;
      }
      for (var s = 0; s < JUMP_KEYS.length; s++) {
        for (var t = -1; t < JUMP_KEYS.length; t++) {
          // Prefer doubling keys.
          var secondKey = t === -1 ? JUMP_KEYS[s] : JUMP_KEYS[t];
          if (addResult(JUMP_KEYS[s] + secondKey, item)) {
            items.splice(q, 1);
            q--;
            success = true;
            break;
          }
        }
        if (success) {
          break;
        }
      }
    }
    // That should have assigned keys to everything, but if there are many
    // similar number of options this case can happen.
    if (items.length !== 0) {
      warn('There must be many similar sidebar options, couldn\'t find keysequences for', items);
    }
    return result;
  }

  function handleNavigateKey(ev) {
    var keepGoing = false;
    if (ev.type === 'keydown') {
      try {
        // Space to scroll down.  Shift+space to scroll up.
        if (ev.key === 'Shift') {
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
        } else {
          var char = ev.key.toLowerCase();
          if (char.length === 1 && lowercaseCharIsAlphanum(char)) {
            navigateKeysPressed += char;
            var option = navigateOptions[navigateKeysPressed];
            if (option) {
              var el = option.element;
              var elToClick = el;
              var foldingSection = false;
              // If the user re-selects the same section they are already on,
              // toggle folding.
              var arrow = getUniqueClass(el, 'arrow');
              if (el.classList.contains('current')) {
                var prev = el.previousSibling;
                if (!prev || !prev.classList.contains('current')) {
                  if (arrow) {
                    elToClick = arrow;
                    foldingSection = true;
                  }
                }
              }
              if (!foldingSection && arrow) {
                if (getUniqueClass(arrow, 'cmp_open_arrow_right')) {
                  click(arrow);
                }
              }
              click(elToClick);
              // If we're just changing folding, then the user probably wants to
              // stay in navigation mode, so reset and rerender.
              if (option.keepGoing || foldingSection) {
                navigateKeysPressed = "";
                keepGoing = rerenderTips();
              }
            } else {
              keepGoing = rerenderTips();
            }
          }
        }
      } finally {
        if (!keepGoing) {
          // This is deferred, because the other key handlers may execute
          // after this one.
          setTimeout(function() {
            mousetrap.switchKeymap('default');
          });
          if (finishNavigate) { finishNavigate(); }
          removeOldTips();
          document.body.classList.remove(TODOIST_SHORTCUTS_NAVIGATE);
        }
      }
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
      var isTooOld = false;
      if (todoistVersion && todoistVersion < TODOIST_TESTED_VERSION) {
        isTooOld = true;
        warningPrefix =
          'Note: The version of todoist you are using, version ' +
          todoistVersion +
          ', is older than the version that ';
        warningSuffix =
          ' was tested with, version ' +
          TODOIST_TESTED_VERSION +
          '. Due to this mismatch, it might not behave as expected.';
      } else if (!todoistVersion || todoistVersion > TODOIST_TESTED_VERSION) {
        if (todoistVersion) {
          warningPrefix =
            'Note: The version of todoist you are using, version ' +
            todoistVersion +
            ', is newer than the version that ';
        } else {
          warningPrefix =
            'Note: The version of todoist you are using could not be detected, ' +
            'which probably means that it is new newer than the version that ';
        }
        warningSuffix =
          ' is tested with, version ' +
          TODOIST_TESTED_VERSION +
          '. Due to this mismatch, it might not behave as expected, though usually it will still work fine. Perhaps check for an updated version?';
      }
      if (warningPrefix && warningSuffix) {
        warn(warningPrefix, 'todoist-shortcuts', warningSuffix);
        var div = document.createElement('div');
        div.classList.add(TODOIST_SHORTCUTS_WARNING);
        div.appendChild(document.createTextNode(warningPrefix));
        var a = document.createElement('a');
        a.href = TODOIST_SHORTCUTS_GITHUB;
        a.appendChild(document.createTextNode('the todoist-shortcuts extension'));
        div.appendChild(a);
        div.appendChild(document.createTextNode(warningSuffix));
        if (isTooOld || NOISY_VERSION_CHECK) {
          document.getElementById('page_background').appendChild(div);
        } else {
          document.getElementById('last_synced').parentElement.appendChild(div);
        }
      }
    } catch (ex) {
      error('Exception while checking Todoist version', ex);
    }
  }

  /** ***************************************************************************
   * Task cursor
   */

  // Sets the cursor to the first task, if any exists.
  function setCursorToFirstTask(isAgenda, shouldScroll) {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(isAgenda, tasks[0], shouldScroll);
    }
  }

  // Sets the cursor to the last task, if any exists.
  function setCursorToLastTask(isAgenda, shouldScroll) {
    var tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(isAgenda, tasks[tasks.length - 1], shouldScroll);
    }
  }

  // Given the element for a task, set it as the current selection.
  function setCursor(isAgenda, task, shouldScroll) {
    if (task) {
      if (shouldScroll === 'scroll') {
        withId('top_bar', function(topBar) {
          verticalScrollIntoView(task, topBar.clientHeight, 0);
        });
      } else if (shouldScroll !== 'no-scroll') {
        error('Unexpected shouldScroll argument to setCursor:', shouldScroll);
      }
      storeCursorContext(isAgenda, task, false);
      task.dispatchEvent(new MouseEvent('mouseover'));
    }
  }

  // Returns the <li> element which corresponds to the current cursor.
  function getCursor() {
    var cursor = getCursorOrOnLeft();
    // Ignore when items on the left menu are hovered.
    return cursor === 'OnLeft' ? null : cursor;
  }

  // Returns the <li> element which corresponds to the current cursor. If the
  // cursor is currently hovering something on the left menu (project, label,
  // filter), then returns string 'OnLeft'.
  function getCursorOrOnLeft() {
    var cursor = findParent(getUniqueClass(document, 'drag_and_drop_handler'), matchingTag('LI'));
    // Ignore when items on the left menu are hovered.
    if (findParent(cursor, matchingId('left_menu'))) {
      return 'OnLeft';
    } else {
      return cursor;
    }
  }

  // A functional-ish idiom to reduce boilerplate.
  function modifyCursorIndex(isAgenda, f) {
    var tasks = getTasks();
    var cursor = getCursor();
    if (!cursor) {
      debug('modifyCursorIndex couldn\'t find cursor, so running restoreLastCursor');
      restoreLastCursor();
    }
    cursor = getCursor();
    if (!cursor) {
      warn('ensureCursor failed, so aborting modifyCursorIndex');
    } else {
      var cursorIndex = tasks.indexOf(getCursor());
      if (cursorIndex < 0) {
        error(
          'Invariant violation: couldn\'t find', cursor, 'in', tasks,
          ', so aborting modifyCursorIndex');
        return;
      }
      var newIndex = f(cursorIndex, tasks);
      if (newIndex < 0) {
        newIndex = 0;
      }
      if (newIndex >= tasks.length) {
        newIndex = tasks.length - 1;
      }
      setCursor(isAgenda, tasks[newIndex], 'scroll');
    }
  }

  function checkIsAgendaMode() {
    return getById(AGENDA_VIEW_ID) !== null;
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
  function verticalScrollIntoView(el, marginTop, marginBottom) {
    var rect = el.getBoundingClientRect();
    if (rect.top < marginTop || rect.bottom > window.innerHeight - marginBottom) {
      var top = rect.top + window.scrollY;
      // TODO: for very large tasks, this could end up with the whole task not
      // being in view.
      window.scrollTo(0, top - window.innerHeight / 2);
    }
  }

  // Alias for document.getElementById
  function getById(id) {
    return document.getElementById(id);
  }

  // Invokes the function for the matching id, or logs a warning.
  function withId(id, f) {
    if (arguments.length > 2) {
      error('Too many arguments passed to withId', arguments);
    }
    var el = getById(id);
    if (el) {
      return f(el);
    } else {
      warn('Couldn\'t find ID', id);
      return null;
    }
  }

  // Invokes the function for every child element that matches the class name.
  function withClass(parent, cls, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withClass', arguments);
    }
    var els = parent.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Invokes the function for every child element that matches a tag name.
  function withTag(parent, tag, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withTag', arguments);
    }
    var els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Finds a parentElement which matches the specified predicate. Returns null
  // if element is null.
  function findParent(element, predicate) {
    if (!element) return null;
    var el = element.parentElement;
    if (!el) return null;
    do {
      if (predicate(el)) {
        return el;
      }
      el = el.parentElement;
    } while (el);
    return null;
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
    var pred = checkedPredicate('findFirst', predicate ? predicate : all);
    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (pred(element)) {
        return element;
      }
    }
    return null;
  }

  // Given a predicate, returns the only element that matches. If no elements
  // match, or multiple elements match, then nothing gets returned. If predicate
  // is null, then it is treated like 'all'.
  function findUnique(predicate, array) {
    var pred = checkedPredicate('findUnique', predicate ? predicate : all);
    var result = null;
    for (var i = 0; i < array.length; i++) {
      var element = array[i];
      if (pred(element)) {
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

  // Returns predicate which returns 'true' if the element has the specified tag.
  function matchingTag(tag) {
    return function(el) {
      return el.tagName === tag;
    };
  }

  // Returns predicate which returns 'true' if the element has the specified id.
  function matchingId(id) {
    return function(el) {
      return el.id === id;
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
    return function(x) {
      return checkedPredicate('left side of and', p1)(x) &&
             checkedPredicate('right side of and', p2)(x);
    };
  }

  // Given two predicates, uses || to combine them.
  function or(p1, p2) {
    return function(x) {
      return checkedPredicate('left side of or', p1)(x) ||
             checkedPredicate('right side of or', p2)(x);
    };
  }

  function checkedPredicate(context, predicate) {
    return function(x) {
      var bool = predicate(x);
      if (typeof bool !== 'boolean') {
        // TODO: perhaps an exception would be better.
        error('In ' + context + ', expected boolean result from predicate. Instead got', bool);
      }
      return bool;
    };
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

  addCss([
    // Enables positioning of the tips.
    '#projects_list > li, li.filter {',
    '  position: relative;',
    '}',
    '',
    // TODO: I'd like to have these be to the left, but I think that would
    // require absolute positioning or similar.  They get clipped by overflow.
    '.' + TODOIST_SHORTCUTS_TIP + ' {',
    '  position: absolute;',
    '  margin-top: 4px;',
    '  margin-left: -40px;',
    '  font-family: monospace;',
    '  font-weight: normal;',
    '  font-size: 18px;',
    '  color: #dd4b39;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_TIP_TYPED + ' {',
    '  display: inline;',
    '  color: #aaa;',
    '}',
    '',
    '#top_filters .' + TODOIST_SHORTCUTS_TIP + ' {',
    '  margin-top: -4px;',
    '  margin-left: -20px;',
    '}',
    '',
    '.panel_summary .' + TODOIST_SHORTCUTS_TIP + ' {',
    '  margin-left: -28px;',
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
    '  width: 20em;',
    '  font-style: italic;',
    '  margin-top: 1em;',
    '}',
    '',
    // When it is hidden in the settings menu (default).
    '.version .' + TODOIST_SHORTCUTS_WARNING + ' {',
    '  position: static;',
    '}',
    '',
    'body.mini_version.' + TODOIST_SHORTCUTS_NAVIGATE + ' #left_menu {',
    '  left: 0;',
    '  bottom: 0;',
    '}'
  ].join('\n'));

  /*****************************************************************************
   * mousetrap v1.6.1 craig.is/killing/mice
   *
   * Forked version at https://github.com/mgsloan/mousetrap (see submodule)
   *
   * Minified via "uglifyjs --compress --mangle -- mousetrap.js | xclip"
   */
  /* eslint-disable */
!function(e,r,t){if(e){for(var a,i={8:"backspace",9:"tab",13:"enter",16:"shift",17:"ctrl",18:"alt",20:"capslock",27:"esc",32:"space",33:"pageup",34:"pagedown",35:"end",36:"home",37:"left",38:"up",39:"right",40:"down",45:"ins",46:"del",91:"meta",93:"meta",224:"meta"},n={106:"*",107:"+",109:"-",110:".",111:"/",186:";",187:"=",188:",",189:"-",190:".",191:"/",192:"`",219:"[",220:"\\",221:"]",222:"'"},c={"~":"`","!":"1","@":"2","#":"3",$:"4","%":"5","^":"6","&":"7","*":"8","(":"9",")":"0",_:"-","+":"=",":":";",'"':"'","<":",",">":".","?":"/","|":"\\"},s={option:"alt",command:"meta",return:"enter",escape:"esc",plus:"+",mod:/Mac|iPod|iPhone|iPad/.test(navigator.platform)?"meta":"ctrl"},o=1;o<20;++o)i[111+o]="f"+o;for(o=0;o<=9;++o)i[o+96]=o.toString();g.prototype.bind=function(e,t,n,r){return e=e instanceof Array?e:[e],this._bindMultiple.call(this,e,t,n,r),this},g.prototype.unbind=function(e,t,n){return this.bind.call(this,e,function(){},t,n)},g.prototype.trigger=function(e,t,n){var r=n||"default";return this._directMap[r][e+":"+t]&&this._directMap[r][e+":"+t]({},e),this},g.prototype.reset=function(e){var t=this;return e?(t._callbacks[e]={},t._directMap[e]={}):(t._callbacks={},t._directMap={}),t},g.prototype.switchKeymap=function(e){e&&e!==this._currentKeymap&&(this._resetSequences(),this._currentKeymap=e)},g.prototype.stopCallback=function(e,t){return!(-1<(" "+t.className+" ").indexOf(" mousetrap "))&&(!function e(t,n){return null!==t&&t!==r&&(t===n||e(t.parentNode,n))}(t,this.target)&&("INPUT"==t.tagName||"SELECT"==t.tagName||"TEXTAREA"==t.tagName||t.isContentEditable))},g.prototype.handleKey=function(){return this._handleKey.apply(this,arguments)},g.addKeycodes=function(e){for(var t in e)e.hasOwnProperty(t)&&(i[t]=e[t]);a=null},e.Mousetrap=g,"undefined"!=typeof module&&module.exports&&(module.exports=g),"function"==typeof define&&define.amd&&define(function(){return g})}function y(e,t,n){e.addEventListener?e.addEventListener(t,n,!1):e.attachEvent("on"+t,n)}function b(e){if("keypress"==e.type){var t=String.fromCharCode(e.which);return e.shiftKey||(t=t.toLowerCase()),t}return i[e.which]?i[e.which]:n[e.which]?n[e.which]:String.fromCharCode(e.which).toLowerCase()}function v(e){return"shift"==e||"ctrl"==e||"alt"==e||"meta"==e}function l(e,t,n){return n||(n=function(){if(!a)for(var e in a={},i)95<e&&e<112||i.hasOwnProperty(e)&&(a[i[e]]=e);return a}()[e]?"keydown":"keypress"),"keypress"==n&&t.length&&(n="keydown"),n}function _(e,t){var n,r,a,i,o=[];for(n="+"===(i=e)?["+"]:(i=i.replace(/\+{2}/g,"+plus")).split("+"),a=0;a<n.length;++a)r=n[a],s[r]&&(r=s[r]),t&&"keypress"!=t&&c[r]&&(r=c[r],o.push("shift")),v(r)&&o.push(r);return{key:r,modifiers:o,action:t=l(r,o,t)}}function g(e){var m=this;if(e=e||r,!(m instanceof g))return new g(e);m.target=e,m._callbacks={},m._directMap={},m._currentKeymap="default";var k={},l=!1,p=!1,f=!1;function h(e,t,n,r,a,i,o){var c,s,l,u,p=[],f=n.type,h=m._callbacks[r];if(!h)return[];if(!h[e])return[];for("keyup"==f&&v(e)&&(t=[e]),c=0;c<h[e].length;++c)if(s=h[e][c],(a||!s.seq||k[s.seq]==s.level)&&f==s.action&&("keypress"==f&&!n.metaKey&&!n.ctrlKey||(l=t,u=s.modifiers,l.sort().join(",")===u.sort().join(",")))){var d=!a&&s.combo==i,y=a&&s.seq==a&&s.level==o;(d||y)&&h[e].splice(c,1),p.push(s)}return p}function d(e,t,n,r){var a,i;m.stopCallback(t,t.target||t.srcElement,n,r)||!1===e(t,n)&&((i=t).preventDefault?i.preventDefault():i.returnValue=!1,(a=t).stopPropagation?a.stopPropagation():a.cancelBubble=!0)}function t(e){"number"!=typeof e.which&&(e.which=e.keyCode);var t,n,r=b(e);r&&("keyup"!=e.type||l!==r?m.handleKey(r,(n=[],(t=e).shiftKey&&n.push("shift"),t.altKey&&n.push("alt"),t.ctrlKey&&n.push("ctrl"),t.metaKey&&n.push("meta"),n),e):l=!1)}function u(e,t,n,r,a,i){var o=r||"default";if(m._callbacks[o]=m._callbacks[o]||{},m._directMap[o]=m._directMap[o]||{},m._directMap[o][e+":"+n]=t,"fallback"!==e){var c,s=(e=e.replace(/\s+/g," ")).split(" ");1<s.length?function(t,e,n,r,a){function i(e){return function(){f=e,++k[t]}}function o(e){d(n,e,t),"keyup"!==r&&(l=b(e)),setTimeout(m._resetSequences,10)}for(var c=k[t]=0;c<e.length;++c){var s=c+1===e.length?o:i(r||_(e[c+1]).action);u(e[c],s,r,a,t,c)}}(e,s,t,n,r):(c=_(e,n),m._callbacks[o][c.key]=m._callbacks[o][c.key]||[],h(c.key,c.modifiers,{type:c.action},o,a,e,i),m._callbacks[o][c.key][a?"unshift":"push"]({callback:t,modifiers:c.modifiers,action:c.action,seq:a,level:i,combo:e}))}else m._callbacks[o].fallback=[{callback:t,modifiers:[],action:n,seq:a,level:i,combo:e}]}m._resetSequences=function(e){e=e||{};var t,n=!1;for(t in k)e[t]?n=!0:k[t]=0;n||(f=!1)},m._handleKey=function(e,t,n){var r,a=h(e,t,n,m._currentKeymap),i={},o=0,c=!1,s=m._callbacks[m._currentKeymap];if(0===a.length&&s){var l=s.fallback;l&&a.push(l[0])}for(r=0;r<a.length;++r)a[r].seq&&(o=Math.max(o,a[r].level));for(r=0;r<a.length;++r)if(a[r].seq){if(a[r].level!=o)continue;c=!0,i[a[r].seq]=1,d(a[r].callback,n,a[r].combo,a[r].seq)}else c||d(a[r].callback,n,a[r].combo);var u="keypress"==n.type&&p;n.type!=f||v(e)||u||m._resetSequences(i),p=c&&"keydown"==n.type},m._bindMultiple=function(e,t,n,r){for(var a=0;a<e.length;++a)u(e[a],t,n,r)},y(e,"keypress",t),y(e,"keydown",t),y(e,"keyup",t)}}("undefined"!=typeof window?window:null,"undefined"!=typeof window?document:null);
  /* eslint-enable */

  // Tell eslint that "Mousetrap" is now a global.
  /* global Mousetrap */

  /*****************************************************************************
   * Mousetrap utilities
   */

  function callBinding(f) {
    return function() {
      var result = f.apply(null, arguments);
      // Default to stopping propagation.
      return result === true;
    };
  }

  function registerKeybindings(keymap, binds) {
    for (var i = 0; i < binds.length; i++) {
      if (binds[i].length === 2) {
        // eslint-disable-next-line no-undefined
        mousetrap.bind(binds[i][0], callBinding(binds[i][1]), undefined, keymap);
      } else {
        // eslint-disable-next-line no-undefined
        error('Improper binding entry at index', i, 'value is', binds[i]);
      }
    }
  }

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  checkTodoistVersion();
  handlePageChange();
  registerTopMutationObservers();

  setTimeout(function() {
    // Remove todoist's global keyboard handler.
    if (!window.originalTodoistKeydown) { window.originalTodoistKeydown = document.onkeydown; }
    if (!window.originalTodoistKeyup) { window.originalTodoistKeyup = document.onkeyup; }
    if (!window.originalTodoistKeypress) { window.originalTodoistKeypress = document.onkeypress; }
    // Call global keyboard handler only for escape.
    function sometimesCallOriginal(f) {
      return function(ev) {
        // Escape key is useful for exiting dialogs and other input boxes, so
        // should also use old todoist handler.
        if (ev.keyCode === 27) {
          f.apply(document, ev);
        }
      };
    }
    document.onkeydown = sometimesCallOriginal(window.originalTodoistKeydown);
    document.onkeyup = sometimesCallOriginal(window.originalTodoistKeyup);
    document.onkeypress = sometimesCallOriginal(window.originalTodoistKeypress);

    mousetrap = new Mousetrap(document);

    // Register key bindings
    registerKeybindings('default', KEY_BINDINGS);
    registerKeybindings('schedule', SCHEDULE_BINDINGS);
    registerKeybindings('navigate', [['fallback', handleNavigateKey]]);

    // Reset mousetrap on disable
    onDisable(function() { mousetrap.reset(); });

    // Register mousemove handler
    document.addEventListener('mousemove', handleMouseMove);
    onDisable(function() {
      document.removeEventListener('mousemove', handleMouseMove);
    });
  });
})();
