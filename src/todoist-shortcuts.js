// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/app*
// @include     http://todoist.com/app*
// @include     https://beta.todoist.com/app*
// @include     http://beta.todoist.com/app*
// @version     61
// @grant       none
// ==/UserScript==

// See issue #11 for why ItemSelecter is used (it is added to the global scope
// by Todoist).

/* global ItemSelecter, svgs */

(function() {
  'use strict';

  var TODOIST_SHORTCUTS_VERSION = 61;

  // Set this to true to get more log output.
  var DEBUG = false;

  // Cursor navigation.
  //
  // Note that modifying these will not affect the cursor motion bindings in
  // 'handleBulkMoveKey'.
  var CURSOR_BINDINGS = [
    [['j', 'down'], cursorDown],
    [['k', 'up'], cursorUp],
    [['h', 'left'], cursorLeft],
    [['l', 'right'], cursorRight],
    ['^', cursorFirst],
    ['$', cursorLast],
    ['{', cursorUpSection],
    ['}', cursorDownSection]
  ];

  // Here's where the keybindings get specified. Of course, feel free to modify
  // this list, or modify this script in general.
  var KEY_BINDINGS = [].concat(CURSOR_BINDINGS, [

    // Add tasks
    // (see originalHandler) ['q', quickAddTask],
    // (see originalHandler) ['a', addTaskBottom],
    // (see originalHandler) ['shift+a', addTaskTop],

    // Navigation
    ['g', navigate],
    ['G', navigateToTask],
    ['`', nextTopSection],
    ['shift+`', prevTopSection],

    // Manipulation of tasks at cursor
    ['enter', edit],
    ['shift+enter', follow],
    ['shift+o', addAbove],
    ['o', addBelow],
    ['c', comment],
    [['shift+j', 'shift+down'], moveDown],
    [['shift+k', 'shift+up'], moveUp],
    [['shift+h', 'shift+left'], moveOut],
    [['shift+l', 'shift+right'], moveIn],

    // Selection
    ['x', toggleSelect],
    ['* a', selectAll],
    ['* n', deselectAll],
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    [['* 4', '* 0'], selectPriority('4')],
    ['* h', collapseAll],
    ['* l', expandAll],

    // Manipulation of selected tasks
    ['t', schedule],
    ['shift+t', scheduleText],
    ['d', done],
    ['e', archive],
    ['#', deleteTasks],
    ['&', duplicateTasks],
    ['v', moveToProject],
    [['y', '@'], openLabelMenu],
    ['1', setPriority('1')],
    ['2', setPriority('2')],
    ['3', setPriority('3')],
    [['4', '0'], setPriority('4')],
    ['shift+c', togglButton],

    // Sorting
    ['s', sortByDate],
    // (see originalHandler) ['p', sortByPriority],
    // (see originalHandler) ['n', sortByName],
    // (see originalHandler) ['r', sortByAssignee],

    // Bulk reschedule / move mode
    ['* t', bulkSchedule],
    ['* v', bulkMove],

    // Other

    // TODO: Once #67 is resolved, the definition of undo() should be
    // reverted to what it was, and the binding for 'u' should not be
    // overridden here.
    [['u', 'z', 'ctrl+z'], undo],

    // (see originalHandler) [['f', '/'], focusSearch],
    ['?', openHelpModal],
    ['ctrl+s', sync],

    // See https://github.com/mgsloan/todoist-shortcuts/issues/30
    // ['i', importFromTemplate],

    ['fallback', originalHandler]
  ]);
  var DEFAULT_KEYMAP = 'default';

  // Build cursor movement bindings that can be used in schedule mode
  var SCHEDULE_CURSOR_BINDINGS = [];
  for (var cix = 0; cix < CURSOR_BINDINGS.length; cix++) {
    var binding = CURSOR_BINDINGS[cix];
    var action = sequence([closeContextMenus, binding[1], schedule]);
    SCHEDULE_CURSOR_BINDINGS.push([binding[0], action]);
  }

  // Scheduling keybindings (used when scheduler is open)
  var SCHEDULE_BINDINGS = [].concat(SCHEDULE_CURSOR_BINDINGS, [
    ['c', scheduleToday],
    ['d', oldScheduleTodayBindingDeprecated],
    ['t', scheduleTomorrow],
    ['w', scheduleNextWeek],
    ['m', scheduleNextMonth],
    ['s', scheduleSuggested],
    ['r', unschedule],
    ['escape', closeContextMenus],
    ['fallback', schedulerFallback]
  ]);
  var SCHEDULE_KEYMAP = 'schedule';

  // Bulk schedule mode keybindings
  var BULK_SCHEDULE_BINDINGS = [].concat(SCHEDULE_BINDINGS, [
    [['v', 'alt+v'], sequence([exitBulkSchedule, bulkMove])],
    ['escape', exitBulkSchedule],
    ['fallback', originalHandler]
  ]);
  var BULK_SCHEDULE_KEYMAP = 'bulk_schedule';

  // Bulk move keybindings
  //
  // These can't be handled by mousetrap, because they need to be triggered
  // while an input is focused. See 'handleBulkMoveKey' below.
  var BULK_MOVE_BINDINGS = [['fallback', originalHandler]];
  var BULK_MOVE_KEYMAP = 'bulk_move';

  var SMART_SCHEDULER_BINDINGS = [
    ['enter', smartSchedulerUpdate],
    ['fallback', originalHandler]
  ];
  var SMART_SCHEDULER_KEYMAP = 'smart_scheduler';

  function smartSchedulerUpdate() {
    withUniqueClass(document, 'SmartSchedule', all, function(smartScheduler) {
      withUniqueClass(smartScheduler, 'submit_btn', all, click);
    });
  }

  function handleBulkMoveKey(ev) {
    if (ev.keyCode === 27 && ev.type === 'keydown') {
      exitBulkMove();
      closeContextMenus();
    } else if (ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      if (!ev.shiftKey) {
        if (ev.key === 't') {
          // alt+t -> switch to bulk schedule mode
          exitBulkMove();
          bulkSchedule();
          return false;
        } else if (ev.key === 'j' || ev.keyCode === 40) {
          // alt-j or alt-down -> move cursor down
          return wrapBulkMoveCursorChange(cursorDown);
        } else if (ev.key === 'k' || ev.keyCode === 38) {
          // alt-k or alt-up-> move cursor up
          return wrapBulkMoveCursorChange(cursorUp);
        } else if (ev.key === 'h' || ev.keyCode === 37) {
          // alt-h or alt-left-> move cursor lef
          return wrapBulkMoveCursorChange(cursorLeft);
        } else if (ev.key === 'h' || ev.keyCode === 39) {
          // alt-l or alt-right -> move cursor right
          return wrapBulkMoveCursorChange(cursorRight);
        }
      }
      if (ev.key === '^') {
        // alt-^ -> move cursor to first item
        return wrapBulkMoveCursorChange(cursorFirst);
      } else if (ev.key === '$') {
        // alt-^ -> move cursor to first item
        return wrapBulkMoveCursorChange(cursorLast);
      } else if (ev.key === '{') {
        // alt-{ -> move cursor up section
        return wrapBulkMoveCursorChange(cursorUpSection);
      } else if (ev.key === '{') {
        // alt-{ -> move cursor up section
        return wrapBulkMoveCursorChange(cursorDownSection);
      }
    }
    return true;
  }

  function wrapBulkMoveCursorChange(f) {
    closeContextMenus();
    f();
    moveToProject();
    return false;
  }

  // Navigation mode uses its own key handler.
  var NAVIGATE_BINDINGS = [['fallback', handleNavigateKey]];
  var NAVIGATE_KEYMAP = 'navigate';

  // Keymap used when there is a floating window
  var POPUP_BINDINGS = [['fallback', originalHandler]];
  var POPUP_KEYMAP = 'popup';

  function originalHandler(ev) {
    if (ev.type === 'keydown') {
      return window.originalTodoistKeydown.apply(document, [ev]);
    } else if (ev.type === 'keyup') {
      return window.originalTodoistKeyup.apply(document, [ev]);
    } else if (ev.type === 'keypress') {
      return window.originalTodoistKeypress.apply(document, [ev]);
    }
    return true;
  }

  function schedulerFallback(ev) {
    var scheduler = findScheduler();
    if (scheduler) {
      // The idea here is that backspace or delete will clear and
      // focus the date entry box. Enter will just focus it.
      if (ev.type === 'keydown' &&
          (ev.code === 'Backspace' ||
           ev.code === 'Delete' ||
           ev.code === 'Enter')) {
        withUniqueClass(scheduler, SCHEDULER_INPUT_CLASS, all, function(inputDiv) {
          withUniqueTag(inputDiv, 'input', all, function(inputEl) {
            if (ev.code !== 'Enter') {
              inputEl.value = '';
            }
            inputEl.focus();
          });
        });
        return false;
      } else {
        return originalHandler(ev);
      }
    } else {
      warn('Expected to find scheduler, but it wasn\'t found.');
      return originalHandler(ev);
    }
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

  // Constants for various todoist ids, classes, and text. Non-exhaustive. TODO: make it exhaustive.
  var TODOIST_ROOT_ID = 'todoist_app';
  var AGENDA_VIEW_ID = 'agenda_view';
  var MOVE_TO_PROJECT_ID = 'GB_window';
  var BACKGROUND_ID = 'page_background';
  var TASK_CONTENT_CLASS = 'content';
  var ACTIONS_BAR_CLASS = 'item_selecter';
  var PROJECT_COMPLETE_CLASS = 'ist_complete_select';
  var ARROW_CLASS = 'arrow';
  var EXPANDED_ARROW_CLASS = 'down';
  var COLLAPSED_ARROW_CLASS = 'right';
  var SCHEDULER_CLASS = 'scheduler';
  var SCHEDULER_ACTION_CLASS = 'scheduler_action';
  var SCHEDULER_INPUT_CLASS = 'scheduler-input';

  var MI_SCHEDULE = 'menu_item_schedule';
  var MI_MOVE = 'menu_item_move';
  var MI_ARCHIVE = 'menu_item_archive';
  var MI_DUPLICATE = 'menu_item_duplicate';
  var MI_DELETE = 'menu_item_delete';
  var MI_DELETE_SEL = 'sel_delete_task';
  var MI_ADD_ABOVE = 'menu_item_add_above';
  var MI_ADD_BELOW = 'menu_item_add_below';
  var MI_EDIT = 'menu_item_edit';

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  var MORE_MENU_ITEMS =
    [MI_ARCHIVE, MI_DUPLICATE, MI_DELETE];
  var TASKMENU_ITEMS =
    [MI_ARCHIVE, MI_DUPLICATE, MI_DELETE_SEL, MI_EDIT];

  var TODOIST_SHORTCUTS_TIP = 'todoist_shortcuts_tip';
  var TODOIST_SHORTCUTS_TIP_TYPED = 'todoist_shortcuts_tip_typed';
  var TODOIST_SHORTCUTS_WARNING = 'todoist_shortcuts_warning';
  var TODOIST_SHORTCUTS_NAVIGATE = 'todoist_shortcuts_navigate';
  var TODOIST_SHORTCUTS_HELP = 'todoist_shortcuts_help';
  var TODOIST_SHORTCUTS_HELP_CONTAINER = 'todoist_shortcuts_help_container';

  var TODOIST_SHORTCUTS_GITHUB = 'https://github.com/mgsloan/todoist-shortcuts';

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
    modifyCursorIndex(function(ix) { return ix + 1; });
  }
  function cursorUp() {
    modifyCursorIndex(function(ix) { return ix - 1; });
  }

  // Move the cursor to first / last task.
  function cursorFirst() {
    setCursorToFirstTask('scroll');
  }
  function cursorLast() {
    setCursorToLastTask('scroll');
  }

  function cursorUpSection() {
    var cursor = getCursor();
    var section = getSection(cursor);
    var firstTask = getFirstTaskInSection(section);
    if (firstTask && !sameElement(cursor)(firstTask)) {
      // Not on first task, so move the cursor.
      setCursor(firstTask, 'scroll');
    } else {
      // If already on the first task of this section, then select first task of
      // prior populated section, if any exists.
      section = section.previousSibling;
      for (; section; section = section.previousSibling) {
        firstTask = getFirstTaskInSection(section);
        if (firstTask) {
          setCursor(firstTask, 'scroll');
          return;
        }
      }
    }
  }

  function cursorDownSection() {
    var cursor = getCursor();
    var curSection = getSection(cursor);
    var section = curSection;
    section = section.nextSibling;
    for (; section; section = section.nextSibling) {
      var firstTask = getFirstTaskInSection(section);
      if (firstTask) {
        setCursor(firstTask, 'scroll');
        return;
      }
    }
    // If execution has reached this point, then we must already be on the last
    // section.
    var lastTask = getLastTaskInSection(curSection);
    warn(lastTask);
    if (lastTask) {
      setCursor(lastTask, 'scroll');
    }
  }

  // Edit the task under the cursor.
  function edit() {
    withUniqueClass(getCursor(), TASK_CONTENT_CLASS, all, click);
  }

  // Follow the first link of the task under the cursor.
  function follow() {
    withUniqueClass(getCursor(), TASK_CONTENT_CLASS, all, function(content) {
      var link = getFirstClass(content, 'ex_link');
      if (link) {
        click(link);
      } else {
        info('Didn\'t find a link to click.');
      }
    });
  }

  // Toggles selection of the task focused by the cursor.
  function toggleSelect() {
    var cursor = getCursor();
    if (cursor) {
      toggleSelectTask(cursor);
    } else {
      info("No cursor, so can't toggle selection.");
    }
  }

  // Selects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  function select() {
    var cursor = getCursor();
    if (cursor) {
      selectTask(cursor);
    } else {
      info("No cursor, so can't select.");
    }
  }

  // Deselects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  function deselect() {
    var cursor = getCursor();
    if (cursor) {
      deselectTask(cursor);
    } else {
      info("No cursor, so can't deselect.");
    }
  }

  // Clicks the 'schedule' link when tasks are selected.  If
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the
  // cursor if there is no selection.
  function schedule() {
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskSchedule(mutateCursor);
      blurSchedulerInput();
      if (inBulkScheduleMode) {
        bulkScheduleCursorChanged();
      }
    } else {
      withId(ACTIONS_BAR_CLASS, function(parent) {
        withUniqueClass(parent, MI_SCHEDULE, all, click);
        blurSchedulerInput();
      });
    }
  }

  // Edits the task under the cursor and focuses the textual representation of
  // when the task is scheduled. Only works for the cursor, not for the
  // selection.
  function scheduleText() {
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskSchedule(mutateCursor);
    } else {
      withId(ACTIONS_BAR_CLASS, function(parent) {
        withUniqueClass(parent, MI_SCHEDULE, all, click);
      });
    }
  }

  // Click 'today' in schedule. Only does anything if schedule is open.
  function scheduleToday() {
    withScheduler(
      'scheduleToday',
      function(scheduler) {
        withUniqueTag(scheduler, 'button', matchingAttr('data-track', 'scheduler|date_shortcut_today'), click);
      });
  }

  // Click 'tomorrow' in schedule. Only does anything if schedule is open.
  function scheduleTomorrow() {
    withScheduler(
      'scheduleTomorrow',
      function(scheduler) {
        withUniqueTag(scheduler, 'button', matchingAttr('data-track', 'scheduler|date_shortcut_tomorrow'), click);
      });
  }

  // Click 'next week' in schedule. Only does anything if schedule is open.
  function scheduleNextWeek() {
    withScheduler(
      'scheduleNextWeek',
      function(scheduler) {
        withUniqueTag(scheduler, 'button', matchingAttr('data-track', 'scheduler|date_shortcut_nextweek'), click);
      });
  }

  // Click 'next month' in schedule. Only does anything if schedule is open.
  function scheduleNextMonth() {
    withScheduler(
      'scheduleNextMonth',
      function() {
        error('schedule next month no longer supported with new Todoist scheduler.');
      });
  }

  // Click 'suggested' in schedule. Only does anything if schedule is open.
  function scheduleSuggested() {
    withScheduler(
      'scheduleSuggested',
      function(scheduler) {
        var suggested = getUniqueTag(scheduler, 'div', matchingAttr('data-track', 'scheduler|date_shortcut_suggested'));
        if (suggested) {
          click(suggested);
        } else {
          var smartScheduler = getUniqueTag(scheduler, 'div', matchingAttr('data-track', 'scheduler|date_shortcut_smartscheduler'));
          if (smartScheduler) {
            click(smartScheduler);
          } else {
            withUniqueTag(scheduler, 'button', matchingAttr('data-track', 'scheduler|date_shortcut_postpone'), click);
          }
        }
      });
  }

  // Click 'no due date' in schedule. Only does anything if schedule is open.
  function unschedule() {
    withScheduler(
      'unschedule',
      function(scheduler) {
        withUniqueTag(scheduler, 'button', matchingAttr('data-track', 'scheduler|date_shortcut_nodate'), click);
      });
  }

  // Clicks 'Move to project' for the selection. If WHAT_CURSOR_APPLIES_TO is
  // 'all' or 'most', then instead applies to the cursor if there is no
  // selection.
  function moveToProject() {
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskMenu(mutateCursor, MI_MOVE);
      if (inBulkMoveMode) {
        bulkMoveCursorChanged();
      }
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
  function fillProjectInput(txt) {
    withUniqueClass(document, PROJECT_COMPLETE_CLASS, all, function(complete) {
      withUniqueTag(complete, 'input', all, function(input) {
        input.value = txt;
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
      var mutateCursor = getCursorToMutate();
      if (mutateCursor) {
        withTaskMenu(mutateCursor, function(menu) {
          clickPriorityMenu(menu, level);
        });
      } else {
        withUniqueClass(document, 'priority_menu', all, function(menu) {
          clickPriorityMenu(menu, level);
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
      var allTasks = getTasks('include-collapsed');
      var classToMatch = 'priority_' + actualLevel;
      var selected = getSelectedTaskKeys();
      var modified = false;
      for (var i = 0; i < allTasks.length; i++) {
        var task = allTasks[i];
        if (task.classList.contains(classToMatch)) {
          selected[getTaskKey(task)] = true;
          modified = true;
        }
      }
      if (modified) {
        setSelections(selected);
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
    var mutateCursor = getCursorToMutate('dangerous');
    if (mutateCursor) {
      clickTaskMenu(mutateCursor, MI_ARCHIVE);
    } else {
      clickMenu(getMoreMenu(), MI_ARCHIVE);
    }
  }

  // Mark all the tasks as completed. If WHAT_CURSOR_APPLIES_TO is 'all', then
  // instead applies to the cursor if there is no selection.
  function done() {
    var mutateCursor = getCursorToMutate('dangerous');
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
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskMenu(mutateCursor, MI_DELETE_SEL);
    } else {
      clickMenu(getMoreMenu(), MI_DELETE);
    }
  }

  function duplicateTasks() {
    var mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskMenu(mutateCursor, MI_DUPLICATE);
    } else {
      clickMenu(getMoreMenu(), MI_DUPLICATE);
    }
  }

  // Opens the label toggling menu.
  function openLabelMenu() {
    if (isEmptyMap(getSelectedTaskKeys())) {
      select();
    }
    withId(ACTIONS_BAR_CLASS, function(parent) {
      withUniqueClass(parent, 'item_action', all, click);
    });
    setTemporarySelectionsClass('ist_complete_select');
  }

  // If toggl-button extension is in use, clicks the toggl-button
  // element in the task.
  function togglButton() {
    withUniqueClass(getCursor(), 'toggl-button', all, click);
  }

  // Toggles collapse / expand of a task, if it has children.
  function toggleCollapse(task) {
    withUniqueClass(task ? task : getCursor(), ARROW_CLASS, all, click);
  }

  // Collapse cursor. If it is already collapsed, select and collapse parent.
  function cursorLeft() {
    if (checkTaskExpanded(getCursor())) {
      toggleCollapse();
    } else {
      selectAndCollapseParent();
    }
  }

  // Expand cursor and move down.
  function cursorRight() {
    if (checkTaskCollapsed(getCursor())) {
      toggleCollapse();
      cursorDown();
    }
  }

  // Collapses or expands task under the cursor, that have children. Does
  // nothing if it's already in the desired state.

  function collapse(task0) {
    var task = task0 ? task0 : getCursor();
    if (checkTaskExpanded(task)) {
      toggleCollapse(task);
    }
  }
  // eslint-disable-next-line no-unused-vars
  function expand(task0) {
    var task = task0 ? task0 : getCursor();
    if (checkTaskCollapsed(task)) {
      toggleCollapse(task);
    }
  }

  // Move selection to parent project.
  function selectAndCollapseParent() {
    var cursor = getCursor();
    var tasks = getTasks();
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (task === cursor) {
        for (var j = i; j >= 0; j--) {
          task = tasks[j];
          if (getUniqueClass(task, EXPANDED_ARROW_CLASS)) {
            setCursor(task, 'scroll');
            toggleCollapse(task);
            break;
          }
          // If we hit the top level, then stop looking for a parent.
          if (getIndentClass(task) === 'indent_1') {
            break;
          }
        }
        break;
      }
    }
  }

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

  // Add a comment to the current task.
  function comment() { withUniqueClass(getCursor(), 'note_icon', all, click); }

  // Click somewhere on the page that shouldn't do anything in particular except
  // closing context menus.  Also clicks 'Cancel' on any task adding.
  function closeContextMenus() {
    click(document.body);
    withClass(document, 'manager', function(manager) {
      var cancelBtn = getUniqueClass(manager, 'cancel');
      click(cancelBtn);
    });
    // Close windows with close buttons, particularly move-to-project
    withClass(document, 'GB_window', function(gbw) {
      withClass(gbw, 'close', function(close) {
        withTag(close, 'div', click);
      });
    });
    // Close todoist-shortcuts' modals
    withClass(document, 'ts-modal-close', click);
  }

  // Switches to a navigation mode, where navigation targets are annotated
  // with letters to press to click.
  function navigate() {
    withId('list_holder', function(listHolder) {
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];
      var unregisterListener = registerMutationObserver(listHolder, function() {
        setupNavigate(listHolder);
      }, { childList: true, subtree: true });
      finishNavigate = function() {
        unregisterListener();
        finishNavigate = null;
      };
      setupNavigate(listHolder);
    });
  }

  // When viewing something other than a project, and the current task has a
  // project associated with it, jumps to the project and reselects the task.
  //
  // When viewing a project, and the current task has a time associated with
  // it that is within the next 7 days, then it jumps to "next 7 days" and
  // reselects the task.
  function navigateToTask() {
    var cursor = getCursor();
    if (viewMode === 'project') {
      var dateSpan = getUniqueClass(cursor, 'date');
      if (dateSpan) {
        if ( matchingClass('date_future')(dateSpan) ||
             matchingClass('date_overdue')(dateSpan) ) {
          withId('top_filters', function(topFilters) {
            withUniqueTag(topFilters, 'li', matchingAttr('data-track', 'navigation|next_7_days'), function(nextSeven) {
              // Set a variable that will be read by 'handlePageChange',
              // which will tell it to select this task.
              selectAfterNavigate = getTaskId(cursor);
              click(nextSeven);
            });
          });
        } else {
          info('Not switching to "Next 7 days", because this task is not scheduled there.');
        }
      } else {
        info('Not switching to "Next 7 days", because this task is not scheduled.');
      }
    } else {
      withUniqueClass(cursor, 'project_item', matchingClass('clickable'), function(projectEl) {
        // Set a variable that will be read by 'handlePageChange', which will
        // tell it to select this task.
        selectAfterNavigate = getTaskId(cursor);
        click(projectEl);
      });
    }
  }

  // Cycles down through top sections (inbox / today / next 7 days + favorites).
  function nextTopSection() {
    withTopFilters(function(topItems, current) {
      // If on the last item, or no item, select the first item.
      if (current >= topItems.length - 1 || current < 0) {
        topItems[0].click();
      // Otherwise, select the next item.
      } else {
        topItems[current + 1].click();
      }
    });
  }

  // Cycles up through top sections (inbox / today / next 7 days + favorites).
  function prevTopSection() {
    withTopFilters(function(topItems, current) {
      // If on the first item, or no item, select the last item.
      if (current <= 0) {
        topItems[topItems.length - 1].click();
      // Otherwise, select the previous item.
      } else {
        topItems[current - 1].click();
      }
    });
  }

  // Clicks quick add task button.  Would be better to use todoist's builtin
  // shortcut, but that logic is currently WIP and broken.
  function quickAddTask() {
    withId('quick_add_task_holder', click);
  }

  // Trigger undo by simulating a keypress.
  function undo() {
    // TODO: not using this approach due to https://github.com/mgsloan/todoist-shortcuts/issues/67
    //
    // todoistShortcut({ key: 'u', charCode: 117 });
    //
    // I believe this approach was superior because it worked even
    // after the todo link disappeared.
    var undoLink = getById('undo_link');
    if (undoLink) {
      click(undoLink);
    } else {
      info('Couldn\'t find undo link.',
        'Once issue #67 is fixed in Todoist (upstream),',
        'I believe visibility of undo link will not be necessary.');
    }
  }

  // Trigger sort by date by clicking a menu item.
  function sortByDate() {
    withUniqueTag(document, 'td', matchingAttr('data-track', 'project|actions_sort_by_date'), click);
  }

  // Open help documentation.
  function openHelpModal() {
    var modal = getUniqueClass(document, TODOIST_SHORTCUTS_HELP);
    if (modal === null) {
      createHelpModal();
      modal = getUniqueClass(document, TODOIST_SHORTCUTS_HELP);
    }
    modal.style.display = 'inline-block';
  }

  // Create DOM nodes for help documentation.
  function createHelpModal() {
    // Remove old help modals, if any.
    withClass(document, TODOIST_SHORTCUTS_HELP, function(x) { x.parentElement.removeChild(x); });
    // Create new help modal.
    var header = element('h1', '', text('Keyboard shortcuts'));
    var docsLink = element('a', '', text('Full todoist-shortcuts documentation'));
    docsLink.setAttribute('href', TODOIST_SHORTCUTS_GITHUB + '/blob/v' + TODOIST_SHORTCUTS_VERSION + '/readme.md');
    var originalLink = element('a', '', text('Original Todoist keyboard shortcuts documentation'));
    originalLink.setAttribute('href', 'https://get.todoist.help/hc/en-us/articles/205063212');
    var sheetsLink = element('a', '', text('Printable shortcuts guide (displayed below)'));
    sheetsLink.setAttribute('href', 'https://docs.google.com/spreadsheets/d/1AGh85HlDze19bWpCa2OTErv9xc7grmMOMRV9S2OS7Xk');
    var linksList = element('ul', '', element('li', '', docsLink), element('li', '', originalLink), element('li', '', sheetsLink));
    var iframe = element('iframe');
    iframe.setAttribute('src', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5jkiI07g9XoeORQrOQUlAwY4uqJkBDkm-zMUK4WuaFvca0BJ0wPKEM5dw6RgKtcSN33PsZPKiN4G4/pubhtml?gid=0&amp;single=true&amp;widget=true&amp;headers=false');
    iframe.setAttribute('scrolling', 'no');
    var container = div(TODOIST_SHORTCUTS_HELP_CONTAINER, linksList, iframe);
    var modal = createModal(div('', header, container));
    modal.classList.add(TODOIST_SHORTCUTS_HELP);
    modal.style.display = 'none';
  }

  // Click "import from template" in project menu
  // eslint-disable-next-line no-unused-vars
  function importFromTemplate() {
    withClass(document, 'menu_item', function(tr) {
      withUniqueTag(tr, 'td', matchingAttr('data-track', 'project|actions_import_from_template'), function(foundItem) {
        click(foundItem);
        var foundInput = null;
        withClass(document, 'file_input_container', function(container) {
          withTag(container, 'input', function(input) {
            foundInput = input;
          });
        });
        if (foundInput) {
          click(foundInput);
        } else {
          warn('Could not find input to click for file input.');
        }
      });
    });
  }

  function sync() {
    withUniqueTag(document, 'td', matchingAttr('data-track', 'navigation|gear_sync'), click);
  }

  function oldScheduleTodayBindingDeprecated() {
    var link = element('a', null, text('this GitHub discussion'));
    link.href = 'https://github.com/mgsloan/todoist-shortcuts/issues/52';
    link.style.color = '';
    notifyUser(
      span(null,
        text('The scheduler shortcut for selecting "Today" has been changed to '),
        span('ts-note-key', text('c')),
        text('.'),
        element('br', null),
        text('You pressed the old scheduler shortcut for this, '),
        span('ts-note-key', text('d')),
        text(', but it now just displays this message.'),
        element('br', null),
        text('See '),
        link,
        text(' for the reasoning behind this change.')));
  }

  /*****************************************************************************
  * Bulk schedule
  */

  // MUTABLE. Is 'true' if we're in bulk schedule mode.
  var inBulkScheduleMode = false;
  var nextBulkScheduleKey = null;

  function bulkSchedule() {
    deselectAll();
    var cursor = getCursor();
    if (cursor) {
      inBulkScheduleMode = true;
      nextBulkScheduleKey = getTaskKey(cursor);
      updateKeymap();
      oneBulkSchedule(cursor);
    } else {
      info('Can\'t bulk schedule if there\'s no cursor task.');
    }
  }

  // TODO(new-scheduler): Exiting doesn't work immediately - visits an
  // extra item.
  function exitBulkSchedule() {
    inBulkScheduleMode = false;
    nextBulkScheduleKey = null;
    updateKeymap();
    closeContextMenus();
  }

  // NOTE: This is called internally, not intended for use as keybinding action.
  function oneBulkSchedule() {
    if (!nextBulkScheduleKey) {
      debug('Exiting bulk schedule mode because there is nothing left to schedule.');
      exitBulkSchedule();
      return;
    }
    var curBulkScheduleTask = getTaskByKey(nextBulkScheduleKey);
    if (!curBulkScheduleTask) {
      warn('Exiting bulk schedule mode because it couldn\'t find', nextBulkScheduleKey);
      exitBulkSchedule();
      return;
    }
    setCursor(curBulkScheduleTask, 'scroll');
    bulkScheduleCursorChanged();
    clickTaskSchedule(curBulkScheduleTask);
    blurSchedulerInput();
  }

  function bulkScheduleCursorChanged() {
    var cursor = getCursor();
    if (cursor) {
      var tasks = getTasks();
      var nextBulkScheduleTask =
          getNextCursorableTask(tasks, getTaskKey(cursor));
      if (nextBulkScheduleTask) {
        nextBulkScheduleKey = getTaskKey(nextBulkScheduleTask);
        return;
      }
    }
    nextBulkScheduleKey = null;
  }

  /*****************************************************************************
  * Bulk move
  */

  // MUTABLE. Is 'true' if we're in bulk move mode.
  var inBulkMoveMode = false;
  var nextBulkMoveKey = null;

  function bulkMove() {
    deselectAll();
    var cursor = getCursor();
    if (cursor) {
      inBulkMoveMode = true;
      nextBulkMoveKey = getTaskKey(cursor);
      updateKeymap();
      oneBulkMove();
    } else {
      info('Can\'t bulk move if there\'s no cursor task.');
    }
  }

  // eslint-disable-next-line no-unused-vars
  function skipBulkMove() {
    if (nextBulkMoveKey) {
      // Closing the calendar will make it open the next.
      closeContextMenus();
    } else {
      exitBulkMove();
    }
  }

  function exitBulkMove() {
    inBulkMoveMode = false;
    updateKeymap();
    closeContextMenus();
  }

  // NOTE: This is called internally, not intended for use as keybinding action.
  function oneBulkMove() {
    if (!nextBulkMoveKey) {
      debug('Exiting bulk move mode because there is nothing left to move.');
      exitBulkMove();
      return;
    }
    var curBulkMoveTask = getTaskByKey(nextBulkMoveKey);
    if (!curBulkMoveTask) {
      warn('Exiting bulk move mode because it couldn\'t find', nextBulkMoveKey);
      exitBulkMove();
      return;
    }
    setCursor(curBulkMoveTask, 'scroll');
    bulkMoveCursorChanged();
    clickTaskMenu(curBulkMoveTask, MI_MOVE);
  }

  function bulkMoveCursorChanged() {
    var cursor = getCursor();
    if (cursor) {
      var tasks = getTasks();
      var nextBulkMoveTask =
          getNextCursorableTask(tasks, getTaskKey(cursor));
      if (nextBulkMoveTask) {
        nextBulkMoveKey = getTaskKey(nextBulkMoveTask);
        return;
      }
    }
    nextBulkScheduleKey = null;
  }

  /*****************************************************************************
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
  function setSelections(selections) {
    var allTasks = getTasks('include-collapsed');
    for (var i = 0; i < allTasks.length; i++) {
      var task = allTasks[i];
      var key = getTaskKey(task);
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
  var wasEditing = false;

  function storeCursorContext(cursor, tasks, index, editing) {
    lastCursorTasks = tasks;
    lastCursorIndex = index;
    lastCursorId = getTaskId(cursor);
    lastCursorIndent = getIndentClass(cursor);
    lastCursorSection = getSectionName(cursor);
    mouseGotMoved = false;
    wasEditing = editing;
    debug(
      'wrote down cursor context:',
      'id =', lastCursorId,
      'indent =', lastCursorIndent,
      'section =', lastCursorSection,
      'idx =', lastCursorIndex);
  }

  function storeNormalContext(cursor) {
    var tasks = getTasks();
    var index = tasks.indexOf(cursor);
    if (index < 0) {
      error('Invariant violation - couldn\'t find ', cursor, 'in', tasks);
    }
    storeCursorContext(cursor, tasks, index, false);
  }

  function storeEditingContext(cursor, index) {
    storeCursorContext(cursor, getTasks(), index, true);
  }

  function handleMouseMove(ev) {
    if (ev.isTrusted) {
      mouseGotMoved = true;
    } else {
      // Synthetic mouse move events are generated when dragging
      // tasks.
      debug('handleMouseMove ignoring synthetic mouse move event.');
    }
  }

  function handleMouseOver(ev) {
    if (ev.isTrusted) {
      try {
        var hoveredTask = findParent(ev.target, matchingClass('task_item'));
        if (mouseGotMoved && hoveredTask) {
          debug('Due to mouse hover, setting cursor');
          setCursor(hoveredTask, 'no-scroll');
        }
      } finally {
        mouseGotMoved = false;
      }
    } else {
      // Synthetic mouse move events are generated when dragging
      // tasks.
      debug('handleMouseOver ignoring synthetic mouse hover event.');
    }
  }

  // If the cursor exists, set 'lastCursorTasks' / 'lastCursorIndex'. If it
  // doesn't exist, then use previously stored info to place it after its prior
  // location.
  function ensureCursor(content) {
    // If there's an editor open to add a task, then set the cursor to the item
    // above.
    var manager = getUniqueClass(content, 'manager');
    if (manager) {
      var tasks = getTasks('include-collapsed', 'include-editors');
      var managerIndex = tasks.findIndex(function(task) {
        return task.classList.contains('manager');
      });
      debug('there is an active editor, with index', managerIndex);
      if (managerIndex > 0) {
        storeEditingContext(tasks[managerIndex - 1], true);
      } else if (managerIndex < 0) {
        error('There seems to be a task editor, but then couldn\'t find it.');
      }
      return;
    }
    debug('Checking if cursor still exists:', lastCursorId, lastCursorIndent);
    var cursor = getCursor();
    // Detect if the cursor has changed section. This can happen when the user
    // re-schedules it or moves it to a different project. I find it nicer if
    // the cursor doesn't follow the task for these moves, hence this logic.
    var changedSection = false;
    var currentSection = null;
    if (cursor && !wasEditing) {
      var cursorId = getTaskId(cursor);
      var cursorIndent = getIndentClass(cursor);
      if (lastCursorId === cursorId && lastCursorIndent === cursorIndent) {
        currentSection = getSectionName(cursor);
        debug(
          'Cursor hasn\'t changed task:',
          'currentSection = ', currentSection,
          'lastCursorSection = ', lastCursorSection,
          'id =', cursorId,
          'indent =', cursorIndent);
        changedSection = currentSection !== lastCursorSection;
      }
    }
    if (cursor && !changedSection) {
      if (wasEditing) {
        // This invocation is to handle the circumstance where the user inserts
        // a task, moving the task list. The task under the mouse then gets
        // hovered, even if the mouse wasn't moved, which erroneously changes
        // the cursor.
        debug('Was just editing, and mouse didn\'t move, so restoring the cursor to last position');
        restoreLastCursor();
      } else {
        debug('Found normal cursor, so storing its context');
        storeNormalContext(cursor);
      }
    } else {
      if (changedSection) {
        debug('cursor element changed section, finding new location');
      } else {
        debug('cursor element disappeared, finding new location');
      }
      restoreLastCursor();
    }
  }

  function restoreLastCursor() {
    var found = false;
    var tasks = null;
    if (lastCursorIndex >= 0) {
      if (wasEditing) {
        var task = getById(lastCursorId);
        if (task) {
          debug('found task that is probably the one that was previously being edited');
          found = true;
          setCursor(task, 'no-scroll');
        } else {
          warn('expected to find task that was being edited.');
        }
      } else {
        for (var i = lastCursorIndex; i < lastCursorTasks.length; i++) {
          var oldTask = lastCursorTasks[i];
          if (oldTask) {
            var oldTaskId = getTaskId(oldTask);
            task = getById(oldTaskId);
            if (task) {
              var taskSection = getSectionName(task);
              // Don't jump back to the same task if it moved changed section.
              if (i !== lastCursorIndex || taskSection === lastCursorSection) {
                debug(
                  'found still-existing task that is',
                  i - lastCursorIndex,
                  'tasks after old cursor position, at',
                  lastCursorIndex,
                  ', setting cursor to it');
                found = true;
                setCursor(task, 'no-scroll');
                break;
              } else {
                debug('disappeared due to changing section, finding new location');
              }
            }
          }
        }
      }
    } else {
      debug('lastCursorIndex wasn\'t set yet');
    }
    if (!found) {
      debug('didn\'t find a particular task to select.');
      if (!tasks) {
        tasks = getTasks();
      }
      if (lastCursorIndex < tasks.length - lastCursorIndex) {
        debug('selecting first task, because it\'s nearer to lastCursorIndex.');
        setCursorToFirstTask('no-scroll');
      } else {
        debug('selecting last task, because it\'s nearer to lastCursorIndex.');
        setCursorToLastTask('no-scroll');
        if (!getCursor()) {
          // This can happen if the last task is a nested sub-project.
          debug('failed to set the cursor to last task, so setting to first');
          setCursorToFirstTask('no-scroll');
        }
      }
    }
  }

  // Gets the name of the section that a task is in.
  function getSectionName(task) {
    var section = getSection(task);
    var result = null;
    if (section) {
      var header = getUniqueClass(section, 'section_header');
      if (!header) {
        header = getUniqueClass(section, 'subsection_header');
      }
      if (header) {
        result = header.textContent;
      }
    }
    if (!result) {
      error('Failed to find section name for', task);
    }
    return result;
  }

  function getSection(task) {
    var predicate;
    if (stripPrefix('agenda', viewMode)) {
      predicate = or(or(or(
        matchingClass('section_overdue'),
        matchingClass('section_day')),
      matchingId(AGENDA_VIEW_ID)),
      // View all filter looks like agenda view, but really has
      // multiple project list editors.
      matchingClass('list_editor'));
    } else if (viewMode === 'project') {
      predicate = matchingClass('list_editor');
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
    var section = findParent(task, predicate);
    if (section && (viewMode === 'project')) {
      section = section.parentElement;
      if (!section.classList.contains('project_editor_instance')) {
        error('Expected', section, 'to have class project_editor_instance');
        return null;
      }
    }
    return section;
  }

  function getFirstTaskInSection(section) {
    return getFirstClass(section, 'task_item', not(matchingClass('reorder_item')));
  }

  function getLastTaskInSection(section) {
    return getLastClass(section, 'task_item', not(matchingClass('reorder_item')));
  }

  // MUTABLE. Stores the last page hash, to detect page changes.
  var lastHash = null;

  // MUTABLE. If set, then the specified task ID will be selected after
  // navigation.
  var selectAfterNavigate = null;

  function handlePageChange() {
    var currentHash = document.location.hash;
    if (lastHash !== currentHash) {
      debug('handlePageChange');
      updateViewMode();
      lastHash = currentHash;
      debug('Setting cursor to first task after navigation');
      if (selectAfterNavigate) {
        var newEl = getTaskById(selectAfterNavigate, 'ignore-indent');
        if (newEl) {
          setCursor(newEl, 'scroll');
        } else {
          warn('Couldn\'t find cursored task after switching to its project');
        }
        selectAfterNavigate = null;
      } else {
        // The reason for 'no-scroll' here is so that Todoist can
        // navigate to a particular task - see #42.  Ideally in this
        // case, the cursor would also be placed on the task.
        // Unfortunately after some poking around I couldn't figure out
        // how to implement this - I couldn't easily get a debugger
        // paused while the task is flashing yellow.
        setCursorToFirstTask('no-scroll');
      }
    }
  }

  // Registers mutation observers on elements that never get removed from the
  // DOM.  Run on initialization of todoist-shortcuts.
  function registerTopMutationObservers() {
    withId('content', function(content) {
      registerMutationObserver(content, handlePageChange);
      registerMutationObserver(content, function(mutations) {
        if (dragInProgress) {
          debug('ignoring mutations since drag is in progress:', mutations);
          return;
        }
        // Ignore mutations from toggl-button extension
        var filtered = mutations.filter(function(mutation) {
          if (mutation.target.classList.contains('toggl-button')) {
            return false;
          }
          if (mutation.addedNodes.length === 0 &&
              mutation.removedNodes.length === 1 &&
              mutation.removedNodes[0].classList &&
              mutation.removedNodes[0].classList.contains('drag_and_drop_handler')) {
            return false;
          }
          if (mutation.addedNodes.length === 1 &&
              mutation.removedNodes.length === 0 &&
              mutation.addedNodes[0].classList &&
              mutation.addedNodes[0].classList.contains('drag_and_drop_handler')) {
            return false;
          }
          return true;
        });
        if (filtered.length > 0) {
          debug('ensuring cursor due to mutations:', mutations);
          ensureCursor(content);
        }
      }, { childList: true, subtree: true });
    });
    registerMutationObserver(document.body, handleBodyChange);
  }

  function handleBodyChange() {
    calendarVisibilityMayHaveChanged();
    conditionallyClearTempSelections();
  }

  function calendarVisibilityMayHaveChanged() {
    var nextTask;
    updateKeymap();
    if (inBulkScheduleMode) {
      if (!checkSchedulerOpen()) {
        if (nextBulkScheduleKey) {
          nextTask = getTaskByKey(nextBulkScheduleKey);
          if (nextTask) {
            debug('Calendar is closed in bulk schedule mode, so scheduling next task.');
            oneBulkSchedule();
          } else {
            error('Could not find next task for bulk schedule.');
            exitBulkSchedule();
          }
        } else {
          debug('Bulk schedule done because there\'s no next task.');
          exitBulkSchedule();
        }
      }
    }
    if (inBulkMoveMode) {
      if (!checkMoveToProjectOpen()) {
        if (nextBulkMoveKey) {
          nextTask = getTaskByKey(nextBulkMoveKey);
          if (nextTask) {
            debug('Move-to-project is closed in bulk move mode, so scheduling next task.');
            setCursor(nextTask, 'no-scroll');
            oneBulkMove();
          } else {
            error('Could not find next task for bulk move.');
            exitBulkMove();
          }
        } else {
          debug('Bulk move done because there\'s no next task.');
          exitBulkMove();
        }
      }
    }
  }

  // If this class disappears from the DOM, then remove the selections.
  var temporarySelectionsClass = null;

  function setTemporarySelectionsClass(cls) {
    var results = document.getElementsByClassName(cls);
    if (results.length > 0) {
      temporarySelectionsClass = cls;
    } else {
      error('Attempted to set temporary selections class to something that doesn\'t exist.');
    }
  }

  function conditionallyClearTempSelections() {
    if (temporarySelectionsClass) {
      var results = document.getElementsByClassName(temporarySelectionsClass);
      if (results.length === 0) {
        deselectAll();
        temporarySelectionsClass = null;
      }
    }
  }

  function updateKeymap() {
    if (mousetrap) {
      var popupWindow = getUniqueClass(document, 'GB_window');
      if (popupWindow) {
        var smartScheduler = getUniqueClass(popupWindow, 'SmartSchedule');
        if (smartScheduler) {
          switchKeymap(SMART_SCHEDULER_KEYMAP);
        } else {
          switchKeymap(POPUP_KEYMAP);
        }
      } else if (inBulkScheduleMode) {
        switchKeymap(BULK_SCHEDULE_KEYMAP);
      } else if (inBulkMoveMode) {
        switchKeymap(BULK_MOVE_KEYMAP);
      } else if (finishNavigate) {
        switchKeymap(NAVIGATE_KEYMAP);
      } else if (checkSchedulerOpen()) {
        switchKeymap(SCHEDULE_KEYMAP);
      } else {
        switchKeymap(DEFAULT_KEYMAP);
      }
    }
  }

  function switchKeymap(keymap) {
    debug('Setting keymap to', keymap);
    mousetrap.switchKeymap(keymap);
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
  //
  // eslint-disable-next-line no-unused-vars
  function withRestoredSelections(f) {
    var oldSelections = getSelectedTaskKeys();
    try {
      f();
    } finally {
      setSelections(oldSelections);
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
  var moreMenu;
  var taskMenu;
  var agendaTaskMenu;

  function getMoreMenu() {
    if (moreMenu) {
      return moreMenu;
    } else {
      moreMenu = findMenu('More...', MORE_MENU_ITEMS);
      return moreMenu;
    }
  }

  function getTaskMenu() {
    if (taskMenu) {
      return taskMenu;
    } else {
      taskMenu = findMenu('task', TASKMENU_ITEMS, all, 2);
      return taskMenu;
    }
  }

  function getAgendaTaskMenu() {
    if (agendaTaskMenu) {
      return agendaTaskMenu;
    } else {
      getTaskMenu();
      agendaTaskMenu = findMenu('agenda task', TASKMENU_ITEMS, function(el) { return el !== taskMenu; });
      return agendaTaskMenu;
    }
  }

  function clickMenu(menu, cls) {
    withUniqueClass(menu, cls, all, function(container) {
      withUniqueClass(container, 'menu_label', all, click);
    });
  }

  // Returns true if the task has children and is collapsed.
  function checkTaskCollapsed(task) {
    return getUniqueClass(task, COLLAPSED_ARROW_CLASS);
  }

  // Returns true if the task has children and is expanded.
  function checkTaskExpanded(task) {
    return getUniqueClass(task, EXPANDED_ARROW_CLASS);
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
  function clickTaskMenu(task, cls) {
    withTaskMenu(task, function(menu) {
      clickMenu(menu, cls);
    });
  }

  function withTaskMenu(task, f) {
    withUniqueTag(task, 'div', matchingClass('menu'), function(openMenu) {
      var menu;
      if (stripPrefix('agenda', viewMode)) {
        menu = getAgendaTaskMenu();
      } else if (viewMode === 'project') {
        menu = getTaskMenu();
      } else {
        error('Unexpected viewMode:', viewMode);
        return;
      }
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

  function checkMoveToProjectOpen() {
    return getById(MOVE_TO_PROJECT_ID) !== null;
  }

  function checkSchedulerOpen() {
    return findScheduler() !== null;
  }

  function findScheduler() {
    return getUniqueClass(document, SCHEDULER_CLASS);
  }

  function withScheduler(name, f) {
    var scheduler = findScheduler();
    if (scheduler) {
      f(scheduler);
    } else {
      warn('Not performing action', name, 'because scheduler is not open');
    }
  }

  // Simulate a key press with todoist's global handlers.
  // eslint-disable-next-line no-unused-vars
  function todoistShortcut(options0) {
    var options = typeof options0 === 'string' ? { key: options0 } : options0;
    var ev = new Event('keydown');
    for (var o in options) { ev[o] = options[o]; }
    window.originalTodoistKeydown.apply(document, [ev]);
    ev = new Event('keyup');
    for (o in options) { ev[o] = options[o]; }
    window.originalTodoistKeyup.apply(document, [ev]);
    ev = new Event('keypress');
    for (o in options) { ev[o] = options[o]; }
    window.originalTodoistKeypress.apply(document, [ev]);
  }

  // Indent task.
  function moveIn() {
    var cursor = getCursor();
    if (viewMode === 'agenda_reorder') {
      info('Indenting task does not work in agenda_reorder mode.');
    } else if (viewMode === 'agenda_no_reorder') {
      info('Indenting task does not work in agenda_no_reorder mode.');
    } else if (viewMode === 'project') {
      if (!cursor) {
        info('No cursor to indent.');
      } else {
        dragTaskOver(cursor, false, function() {
          return {
            destination: cursor,
            horizontalOffset: 40,
            verticalOffset: 0
          };
        });
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Dedent task.
  function moveOut() {
    var cursor = getCursor();
    if (viewMode === 'agenda_reorder') {
      info('Dedenting task does not work in agenda_reorder mode.');
    } else if (viewMode === 'agenda_no_reorder') {
      info('Dedenting task does not work in agenda_no_reorder mode.');
    } else if (viewMode === 'project') {
      if (!cursor) {
        info('No cursor to dedent.');
      } else if (getIndentClass(cursor) === 'indent_1') {
        // See https://github.com/mgsloan/todoist-shortcuts/issues/39
        info('Task is already at indent level 1, so not dedenting');
      } else {
        dragTaskOver(cursor, false, function() {
          return {
            destination: cursor,
            horizontalOffset: -40,
            verticalOffset: 0
          };
        });
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Move task up, maintaining its indent level and not swizzling any nested
  // structures.
  function moveUp() {
    var cursor = getCursor();
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else if (viewMode === 'agenda_no_reorder') {
      info('Moving task up does not work in filter mode.');
    } else if (viewMode === 'project' || viewMode === 'agenda_reorder') {
      if (!cursor) {
        info('No cursor to move up.');
      } else {
        if (getSectionName(cursor) === 'OverdueReschedule overdue') {
          info('Can\'t move cursor up in overdue section');
          return;
        }
        // Collapse nested tasks before moving it - see
        // https://github.com/mgsloan/todoist-shortcuts/issues/29#issuecomment-426121307
        collapse(cursor);
        dragTaskOver(cursor, false, function() {
          var tasks = getTasks();
          var cursorIndex = tasks.indexOf(cursor);
          var cursorIndent = getIndentClass(cursor);
          for (var i = cursorIndex - 1; i >= 0; i--) {
            var task = tasks[i];
            var indent = getIndentClass(task);
            if (indent === cursorIndent) {
              // Less glitchy if destination is collapsed
              collapse(task);
              return {
                destination: task,
                horizontalOffset: 0,
                verticalOffset: 0
              };
            } else if (indent < cursorIndent) {
              info('Refusing to dedent task to move it up.');
              return null;
            }
          }
          info('Couldn\'t find task above cursor to move it above.');
          return null;
        });
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Move task down, maintaining its indent level and not swizzling any nested
  // structures.
  function moveDown() {
    var cursor = getCursor();
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else if (viewMode === 'agenda_no_reorder') {
      info('Moving task down does not work in filter mode.');
    } else if (viewMode === 'project' || viewMode === 'agenda_reorder') {
      if (!cursor) {
        info('No cursor to move down.');
      } else {
        if (getSectionName(cursor) === 'OverdueReschedule overdue') {
          info('Can\'t move cursor down in overdue section');
          return;
        }
        // Collapse nested tasks before moving it - see
        // https://github.com/mgsloan/todoist-shortcuts/issues/29#issuecomment-426121307
        collapse(cursor);
        dragTaskOver(cursor, true, function() {
          var tasks = getTasks();
          var cursorIndex = tasks.indexOf(cursor);
          var cursorIndent = getIndentClass(cursor);
          var lastQualifyingTask = null;
          for (var i = cursorIndex + 1; i < tasks.length; i++) {
            var task = tasks[i];
            var indent = getIndentClass(task);
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
                info('Refusing to dedent task to move it down.');
                return null;
              }
            } else if (indent <= cursorIndent) {
              break;
            } else {
              lastQualifyingTask = task;
            }
          }
          if (lastQualifyingTask) {
            // Less glitchy if destination is collapsed
            collapse(lastQualifyingTask);
            return {
              destination: lastQualifyingTask,
              horizontalOffset: 0,
              verticalOffset: -cursor.clientHeight
            };
          } else {
            info('Couldn\'t find task below cursor to move it below.');
            return null;
          }
        });
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  var dragInProgress = false;
  var suppressDrag = false;

  function dragStart() {
    dragInProgress = true;
    suppressDrag = true;
    window.scrollBy = function() {
      debug('Ignored Todoist scrollBy during task drag:', arguments);
    };
  }

  function dragDone(task) {
    dragInProgress = false;
    // Suppress subsequent drags for 50ms, otherwise glitches occur.
    setTimeout(function() { suppressDrag = false; }, 0);
    window.scrollBy = window.originalTodoistScrollBy;
    if (!task || task.classList.contains('on_drag')) {
      warn('didn\'t find spot to drop for drag and drop, so cancelling');
      closeContextMenus();
    }
  }

  function dragTaskOver(sourceTask, isBelow, findDestination) {
    var sourceY = offset(sourceTask).y;
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else {
      try {
        dragStart();
        scrollTaskIntoView(sourceTask);
        var result = findDestination();
        withDragHandle(sourceTask, function(el, x, y) {
          if (result) {
            var deltaX = result.horizontalOffset;
            var deltaY = offset(result.destination).y - sourceY + result.verticalOffset;
            if (isBelow) {
              deltaY += result.destination.clientHeight;
            }
            animateDrag(el, x, y, x + deltaX, y + deltaY,
              function() { dragDone(sourceTask); });
          } else {
            dragDone(sourceTask);
          }
        }, dragDone);
      } catch (ex) {
        dragDone(sourceTask);
        throw ex;
      }
    }
  }

  function withDragHandle(task, f, finished) {
    var key = getTaskKey(task);
    task.dispatchEvent(new Event('mouseover'));
    try {
      var handler = getUniqueClass(task, 'drag_and_drop_handler');
      if (handler) {
        var handlerOffset = offset(handler);
        var x = handlerOffset.x + handler.offsetWidth / 2 - window.scrollX - 3;
        var y = handlerOffset.y + handler.offsetHeight / 2 - window.scrollY - 4;
        f(handler, x, y);
      } else {
        // FIXME: Sometimes this triggers, particularly when move up / move
        // down key is held down with repeat.  Tried some hacks to resolve,
        // but nothing seems to work well.
        info('Couldn\'t find drag_and_drop_handler.');
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
    var duration = 100;
    var frameCount = 5;
    var currentFrame = 0;
    // NOTE: Animating this may seem overkill, but doing a direct move didn't
    // work reliably.  This also makes it clearer what's happening.
    var dragLoop = function() {
      var alpha = currentFrame / frameCount;
      currentFrame++;
      if (alpha >= 1) {
        var params = mkMouseParams(tx, ty);
        el.dispatchEvent(new MouseEvent('mousemove', params));
        el.dispatchEvent(new MouseEvent('mouseup', params));
        finished();
      } else {
        params = mkMouseParams(coslerp(sx, tx, alpha), coslerp(sy, ty, alpha));
        el.dispatchEvent(new MouseEvent('mousemove', params));
        setTimeout(dragLoop, duration / frameCount);
      }
    };
    setTimeout(dragLoop, duration / frameCount);
  }

  function lerp(s, e, t) {
    return s * (1 - t) + e * t;
  }

  // Using cosine interpolation, since it seems to result in more reliable and
  // potentially nicer looking drag behavior.
  // See http://paulbourke.net/miscellaneous/interpolation/
  function coslerp(s, e, t) {
    return lerp(s, e, (1 - Math.cos(t * Math.PI)) / 2);
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

  function clickTaskSchedule(task) {
    var dueDateControls = getUniqueClass(task, 'due_date_controls');
    if (dueDateControls) {
      // For scheduled and unscheduled tasks, both of these elements
      // exist, but only one will cause the scheduler to open.
      withUniqueClass(dueDateControls, 'date', all, click);
      withClass(dueDateControls, SCHEDULER_ACTION_CLASS, click);
    } else {
      withClass(task, SCHEDULER_ACTION_CLASS, click);
    }
  }

  function blurSchedulerInput() {
    setTimeout(function() {
      var scheduler = findScheduler();
      if (scheduler) {
        withTag(scheduler, 'input', function(el) {
          el.blur();
        });
      } else {
        error('Expected to find scheduler after opening it.');
      }
    }, 0);
  }

  function clickTaskDone(task) {
    withUniqueClass(task, 'ist_checkbox', all, click);
  }

  // Common code implementing addAbove / addBelow.
  function addAboveOrBelow(menuCls) {
    var cursor = getCursor();
    if (stripPrefix('agenda', viewMode) || cursor === null) {
      addToSectionContaining(cursor);
    } else if (viewMode === 'project') {
      clickTaskMenu(cursor, menuCls);
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Clicks the "Add Task" button within the section that contains the specified
  // task.
  function addToSectionContaining(task) {
    var section = null;
    if (viewMode === 'agenda_no_reorder') {
      // TODO: This works well in labels, but may be a bit unexpected in filters
      // like "Priority 1", since quick add will not adjust the task such that
      // it ends up in the filter.
      quickAddTask();
      return;
    } else if (task) {
      section = findParentSection(task);
    } else if (stripPrefix('agenda', viewMode)) {
      section = getFirstClass(document, 'section_day');
    } else {
      section = getFirstClass(document, 'project_editor_instance');
    }
    if (!section) {
      error('Couldn\'t find section for task', task);
      return;
    }
    if (viewMode === 'agenda_reorder') {
      if (section.classList.contains('section_overdue')) {
        section = getFirstClass(document, 'section_day');
      }
      withUniqueClass(section, 'agenda_add_task', all, click);
    } else {
      withUniqueClass(section, 'action_add_item', all, click);
    }
  }

  function findParentSection(task) {
    if (viewMode === 'agenda_reorder') {
      return findParent(task, or(matchingClass('section_day'), matchingClass('section_overdue')));
    } else if (viewMode === 'agenda_no_reorder') {
      // Only one section in filter mode, and its header is directly under the
      // agenda_view div.
      return getById(AGENDA_VIEW_ID);
    } else if (viewMode === 'project') {
      return findParent(task, matchingClass('project_editor_instance'));
    } else {
      error('Unexpected value of viewMode:', viewMode);
      return null;
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
  function getCursorToMutate(danger) {
    var cursor = getCursor();
    // TODO: Something more efficient than finding all selections if we just
    // want to know if there are any.
    if (cursor && isEmptyMap(getSelectedTaskKeys())) {
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

  function clickPriorityMenu(menu, level) {
    withUniqueClass(menu, 'icon_priority_' + level, all, function(img) {
      // See https://github.com/mgsloan/todoist-shortcuts/issues/32
      // withRestoredSelections(function() { click(img); });
      click(img);
    });
  }

  function notifyUser(msg) {
    withId('app_holder', function(appHolder) {
      var close = div('ts-note-close');
      close.innerHTML = svgs['sm1/close_small.svg'];
      var note =
          div('ts-note',
            div('ts-note-content',
              span('ts-note-prefix', text('Message from todoist-shortcuts: ')),
              element('br', null),
              typeof msg === 'string' ? text(msg) : msg),
            close);
      appHolder.appendChild(note);
      var closeFunc = function() { appHolder.removeChild(note); };
      close.onclick = closeFunc;
      setTimeout(closeFunc, 10000);
    });
  }

  function createModal(msg) {
    var modal;
    withId('app_holder', function(appHolder) {
      var close = div('ts-modal-close');
      close.innerHTML = svgs['sm1/close_small.svg'];
      var content = div('ts-modal-content', typeof msg === 'string' ? text(msg) : msg);
      modal = div('ts-modal', content, close);
      appHolder.appendChild(modal);
      close.onclick = function() { modal.style.display = 'none'; };
    });
    return modal;
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
    withId('content', function(content) {
      withTag(content, 'li', function(item) {
        // Skip elements which don't correspond to tasks
        var classMatches =
          !item.classList.contains('reorder_item') &&
          (  item.classList.contains('task_item')
          || (item.classList.contains('manager') && shouldIncludeEditors)
          );
        // Skip nested tasks that are not visible (if includeCollapsed is not set).
        var visible = shouldIncludeCollapsed || !hidden(item);
        if (classMatches && visible) {
          results.push(item);
        }
      });
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
  function getSelectedTaskKeys() {
    var results = {};
    var tasks = getTasks('include-collapsed');
    for (var i = 0; i < tasks.length; i++) {
      var task = tasks[i];
      if (checkTaskIsSelected(task)) {
        var key = getTaskKey(task);
        results[key] = true;
      }
    }
    return results;
  }

  // Get key used for the cursor, in the getSelectedTaskKeys map.
  function getTaskKey(task) {
    if (stripPrefix('agenda', viewMode)) {
      return getTaskId(task) + ' ' + getIndentClass(task);
    } else if (viewMode === 'project') {
      return getTaskId(task);
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
  }

  // eslint-disable-next-line no-unused-vars
  function makeTaskKey(id, indent) {
    if (stripPrefix('agenda', viewMode)) {
      return id + ' ' + indent;
    } else if (viewMode === 'project') {
      return id;
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
  }

  function checkTaskIsSelected(task) {
    return task.classList.contains('selected');
  }

  function getTaskId(task) {
    if (task.id) {
      return task.id;
    } else {
      var idViaClass = findUnique(isItemClass, task.classList);
      if (idViaClass) {
        // Debug log since I still don't understand quite why this
        // happens - seems to occur when moving tasks.
        debug('Encountered curious case where task has item_ class but no id');
        return idViaClass;
      } else {
        error('Couldn\'t find id for task', task);
        return null;
      }
    }
  }

  function isItemClass(cls) {
    return cls.startsWith('item_');
  }

  function getIndentClass(task) {
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
    if (stripPrefix('agenda', viewMode)) {
      // In agenda mode, can't rely on uniqueness of ids. So, search for
      // matching 'indent'. Turns out todoist also uses the ids as classes.
      var els = document.getElementsByClassName(id);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (indent === 'ignore-indent') {
          return el;
        } else if (!indent) {
          error('getTaskById called in agenda mode but with no indent value.');
          return el;
        } else if (el.classList.contains(indent)) {
          return el;
        }
      }
      return null;
    } else if (viewMode === 'project') {
      return document.getElementById(id);
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
  }

  // Gets the next task the cursor can be moved to, after the specified task.
  function getNextCursorableTask(tasks, currentKey) {
    for (var i = 0; i < tasks.length; i++) {
      if (getTaskKey(tasks[i]) === currentKey) {
        for (var j = i + 1; j < tasks.length; j++) {
          var task = tasks[j];
          return task;
        }
      }
    }
    return null;
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
  var navigateKeysPressed = '';

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
        var mustBeKeys = null;
        var txt = null;
        var initials = null;
        if (matchingAttr('data-track', 'navigation|inbox')(li)) {
          mustBeKeys = 'i';
        } else if (matchingAttr('data-track', 'navigation|today')(li)) {
          mustBeKeys = 'g';
        } else if (matchingAttr('data-track', 'navigation|next_7_days')(li)) {
          mustBeKeys = 'n';
        } else if (li.classList.contains('favorite_item')) {
          withUniqueClass(li, 'item_content', all, function(content) {
            withUniqueChild(content, matchingTag('span'), function(nameSpan) {
              txt = preprocessItemText(nameSpan.textContent);
              initials = getItemInitials(nameSpan.textContent);
            });
          });
        } else {
          withUniqueClass(li, 'name', all, function(nameElement) {
            withUniqueChild(nameElement, matchingTag('span'), function(nameSpan) {
              txt = preprocessItemText(nameSpan.textContent);
              initials = getItemInitials(nameSpan.textContent);
            });
          });
        }
        // Add some stable sequences for common text
        if (txt === 'priority1') { mustBeKeys = 'p1'; }
        if (txt === 'priority2') { mustBeKeys = 'p2'; }
        if (txt === 'priority3') { mustBeKeys = 'p3'; }
        if (txt === 'priority4') { mustBeKeys = 'p4'; }
        if (txt === 'assignedtome') { mustBeKeys = 'am'; }
        if (txt === 'assignedtoothers') { mustBeKeys = 'ao'; }
        if (txt === 'viewall') { mustBeKeys = 'va'; }
        if (txt === 'noduedate') { mustBeKeys = 'dn'; }
        if (mustBeKeys) {
          navigateItems.push({
            element: li,
            mustBeKeys: mustBeKeys,
            text: txt,
            initials: initials
          });
        } else if (txt) {
          navigateItems.push({
            element: li,
            text: txt,
            initials: initials
          });
        } else {
          error('Couldn\'t figure out text for', li);
        }
      });
      withClass(listHolder, 'expansion_panel__toggle', function(summary) {
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
            error('Unexpected dataTrack value:', dataTrack);
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
      navigateKeysPressed = '';
      if (!rerenderTips() && finishNavigate) {
        finishNavigate();
      }
      updateKeymap();
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
          var tip = div(TODOIST_SHORTCUTS_TIP, text(rest));
          if (prefix.length > 0) {
            tip.prepend(div(TODOIST_SHORTCUTS_TIP_TYPED, text(prefix)));
          }
          el.prepend(tip);
          renderedAny = true;
        }
      }
    }
    return renderedAny;
  }

  // Lowercase and take only alphanumeric.
  function preprocessItemText(txt) {
    var result = '';
    for (var i = 0; i < txt.length; i++) {
      var char = txt[i];
      var lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlphanum(lowerChar)) {
        result += lowerChar;
      }
    }
    return result;
  }

  // Lowercase and get initials.
  function getItemInitials(txt) {
    var result = '';
    for (var i = 0; i < txt.length; i++) {
      var char = txt[i];
      var lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlphanum(lowerChar) &&
        (i === 0 || txt[i - 1] === ' ' || lowerChar !== char)) {
        result += lowerChar;
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
    var addViaKeyFunc = function(mode, f) {
      var groups = {};
      for (var j = 0; j < items.length; j++) {
        keys = f(items[j]);
        if (keys) {
          var group = groups[keys];
          if (!group) {
            group = [];
            groups[keys] = group;
          }
          group.push(j);
        }
      }
      var qualifying = [];
      for (keys in groups) {
        if (noAliasing(keys)) {
          var groupItems = groups[keys];
          var qualifies = false;
          if (mode === 'no-shortening') {
            qualifies = true;
          } else if (mode === 'try-shortening') {
            // Prefer shortened key sequences if they are unambiguous.
            for (var sl = MAX_NAVIGATE_PREFIX - 1; sl > 0; sl--) {
              var shortened = keys.slice(0, sl);
              if (noAliasing(shortened)) {
                var found = true;
                for (var otherKeys in groups) {
                  if (otherKeys !== keys && otherKeys.slice(0, sl) !== shortened) {
                    found = false;
                    break;
                  }
                }
                if (found) {
                  keys = shortened;
                  break;
                }
              } else {
                break;
              }
            }
            // Still allow ambiguous assignments, even if there is no
            // shortening.
            qualifies = true;
          } else {
            error('Invariant violation: unexpected mode in addViaKeyFunc');
          }
          if (qualifies) {
            qualifying.push([keys, groupItems[0]]);
          }
        }
      }
      // sort backwards so that deletion works.
      qualifying.sort(function(a, b) { return b[1] - a[1]; });
      for (var k = 0; k < qualifying.length; k++) {
        keys = qualifying[k][0];
        var ix = qualifying[k][1];
        item = items[ix];
        if (addResult(keys, item)) {
          items.splice(ix, 1);
        }
      }
    };
    // Handle items with 'mustBeKeys' set.
    addViaKeyFunc('no-shortening', function(it) { return it.mustBeKeys; });
    // When initials are at least MAX_NAVIGATE_PREFIX in length, prefer
    // assigning those.
    addViaKeyFunc('no-shortening', function(it) {
      var initials = it.initials;
      if (initials.length >= MAX_NAVIGATE_PREFIX) {
        return initials.slice(0, MAX_NAVIGATE_PREFIX);
      } else {
        return null;
      }
    });
    // Attempt to use prefix as the key sequence.
    addViaKeyFunc('try-shortening', function(it) {
      return it.text.slice(0, MAX_NAVIGATE_PREFIX);
    });
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
      info('There must be many similar sidebar options, couldn\'t find keysequences for', items);
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
        } else if (ev.keyCode === 38) {
          // Up arrow to scroll up a little bit.
          keepGoing = true;
          withId('left_menu', function(leftMenu) {
            leftMenu.scrollBy(0, -40);
          });
        } else if (ev.keyCode === 40) {
          // Down arrow to scroll down a little bit.
          keepGoing = true;
          withId('left_menu', function(leftMenu) {
            leftMenu.scrollBy(0, 40);
          });
        } else {
          var char = ev.key.toLowerCase();
          if (char.length === 1 && lowercaseCharIsAlphanum(char)) {
            navigateKeysPressed += char;
            var option = navigateOptions[navigateKeysPressed];
            if (option) {
              var el = option.element;
              keepGoing = option.keepGoing;
              // If the user is selecting a section like projects / labels /
              // filters, then close the other sections.
              if (el.classList.contains('expansion_panel__toggle')) {
                withId('list_holder', function(listHolder) {
                  withClass(listHolder, 'expansion_panel__toggle', function(ps) {
                    var isExpanded = ps.attributes['aria-expanded'].value === 'true';
                    if (!sameElement(el)(ps) && isExpanded) {
                      ps.click();
                    }
                  });
                });
              }
              // Ensure that the item is visible - first, uncollapsing
              // the outer section.
              var collapseParent = findParent(el, matchingClass('collapse'));
              if (collapseParent && !matchingClass('collapse--entered')(collapseParent)) {
                var collapseHeader = collapseParent.previousSibling;
                if (collapseHeader) {
                  withUniqueClass(collapseHeader, 'expansion_panel__toggle', click);
                } else {
                  warn('Expected to find section collapse header, but did\'nt');
                }
              }
              // Second, uncollapse all of the project's parents.
              var priorIndent = getIndentClass(el);
              var arrowsToClick = [];
              for ( var elAbove = el.previousSibling
                ; elAbove
                ; elAbove = elAbove.previousSibling
              ) {
                var curIndent = getIndentClass(elAbove);
                if (curIndent < priorIndent) {
                  priorIndent = curIndent;
                  var arr = getUniqueClass(elAbove, 'arrow');
                  if (arr && arr.classList.contains(COLLAPSED_ARROW_CLASS)) {
                    arrowsToClick.unshift(arr);
                  } else if (elAbove.style.display === 'none') {
                    warn('Expected to find collapsed task, but got', elAbove);
                  }
                }
                // If we've reached a visible list item, we're done uncollapsing.
                if (elAbove.style.display !== 'none') {
                  break;
                }
              }
              for (var i = 0; i < arrowsToClick.length; i++) {
                click(arrowsToClick[i]);
              }
              // Uncollapse the target project, if necessary.
              var arrow = getUniqueClass(el, 'arrow');
              if (arrow) {
                // If the user re-selects the same project they are already on,
                // toggle folding.
                if (el.classList.contains('current')) {
                  var prev = el.previousSibling;
                  if (!prev || !prev.classList.contains('current')) {
                    click(arrow);
                    keepGoing = true;
                  }
                // If the user selects a collapsed project, toggle folding.
                } else if (arrow.classList.contains(COLLAPSED_ARROW_CLASS)) {
                  click(arrow);
                  keepGoing = true;
                }
              }
              click(el);
              // Scroll the task into view, if needed. The delay is
              // to give time to the uncollapsing.
              setTimeout(function() { el.scrollIntoViewIfNeeded(); }, 300);
              // If we're just changing folding, then the user probably wants to
              // stay in navigation mode, so reset and rerender.
              if (keepGoing) {
                navigateKeysPressed = '';
                keepGoing = rerenderTips();
              }
            } else {
              keepGoing = rerenderTips();
            }
          }
        }
      } finally {
        if (!keepGoing) {
          if (finishNavigate) { finishNavigate(); }
          // This is deferred, because the other key handlers may execute
          // after this one.
          setTimeout(function() {
            updateKeymap();
          });
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

  // Run a function on the array of top filters, along with the index of the
  // currently selected one, if any.
  function withTopFilters(f) {
    withId('top_filters', function(topFilters) {
      var topItems = topFilters.getElementsByTagName('li');
      var current = -1;
      for (var i = 0; i < topItems.length; i++) {
        if (matchingClass('current')(topItems[i])) {
          current = i;
          break;
        }
      }
      f(topItems, current);
    });
  }

  /** ***************************************************************************
   * Task cursor
   */

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
    if (task) {
      if (shouldScroll === 'scroll') {
        scrollTaskIntoView(task);
      } else if (shouldScroll !== 'no-scroll') {
        error('Unexpected shouldScroll argument to setCursor:', shouldScroll);
      }
      storeNormalContext(task);
      updateCursorStyle();
    } else {
      error('Null task passed to setCursor');
    }
  }

  function scrollTaskIntoView(task) {
    withId('top_bar', function(topBar) {
      verticalScrollIntoView(task, topBar.clientHeight, 0);
    });
  }

  // Returns the <li> element which corresponds to the current cursor.
  function getCursor() {
    return getTaskById(lastCursorId, lastCursorIndent);
  }

  // A functional-ish idiom to reduce boilerplate.
  function modifyCursorIndex(f) {
    var tasks = getTasks();
    var cursor = getCursor();
    if (!cursor) {
      debug('modifyCursorIndex couldn\'t find cursor, so running restoreLastCursor');
      restoreLastCursor();
      cursor = getCursor();
    }
    if (!cursor) {
      info('Couldn\'t find cursor, so selecting first task.');
      setCursorToFirstTask('scroll');
    } else {
      var cursorIndex = tasks.indexOf(cursor);
      if (cursorIndex < 0) {
        error(
          'Invariant violation: couldn\'t find', cursor, 'in', tasks,
          ', so aborting modifyCursorIndex');
        return;
      }
      var newIndex = f(cursorIndex, tasks);
      if (newIndex < 0) {
        info('Can\'t move cursor before first task');
        newIndex = 0;
      }
      if (newIndex >= tasks.length) {
        info('Can\'t move cursor after last task');
        newIndex = tasks.length - 1;
      }
      var newCursor = tasks[newIndex];
      if (newCursor) {
        setCursor(newCursor, 'scroll');
      }
    }
  }

  // This function detects which mode Todoist's view is in, since each behaves a
  // bit differently.  In particular:
  //
  // * filter mode does not have drag handles, and so a custom cursor is
  //   rendered.
  function getViewMode() {
    var agendaView = getById(AGENDA_VIEW_ID);
    if (agendaView === null) {
      return 'project';
    } else {
      var reorderItem = getFirstClass(agendaView, 'reorder_item');
      if (reorderItem) {
        // Custom filters like "today & p1" result in an agenda view
        // that looks like it might be reorderable. These cases seem
        // to have the "is_filtered" class on the items list, so if
        // this is present, don't use the drag handle for the
        // cursor. See
        // https://github.com/mgsloan/todoist-shortcuts/commit/4b563f76610a717a8659d5974ae00958fb1e1344#commitcomment-30618923
        if (reorderItem.parentElement && matchingClass('is_filtered')(reorderItem.parentElement)) {
          return 'agenda_no_reorder';
        } else {
          return 'agenda_reorder';
        }
      } else {
        return 'agenda_no_reorder';
      }
    }
  }

  // MUTABLE. Should always correspond to getViewMode result, as it is updated
  // on load and on some dom mutation.
  var viewMode = null;

  function updateViewMode() {
    viewMode = getViewMode();
    debug('viewMode = ', viewMode);
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

  // Used to notify about an issue that's expected to sometimes occur during
  // normal operation.
  function info() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    args.push('(this is fine)');
    // eslint-disable-next-line no-console
    console.log.apply(null, args);
  }

  function warn() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    args.push('\n' + getStack());
    // eslint-disable-next-line no-console
    console.warn.apply(null, args);
  }

  function error() {
    var args = [].slice.call(arguments);
    args.unshift('todoist-shortcuts:');
    args.push(getStack());
    args.push('Please report this as an issue to http://github.com/mgsloan/todoist-shortcuts');
    // eslint-disable-next-line no-console
    console.error.apply(null, arguments);
  }

  // https://stackoverflow.com/a/41586311/1164871
  function getStack() {
    try {
      throw new Error();
    } catch (e) {
      return e.stack;
    }
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
    var oy = offset(el).y;
    var cy = oy - window.scrollY;
    var h = el.offsetHeight;
    if (cy < marginTop || cy + h > window.innerHeight - marginBottom) {
      // TODO: for very large tasks, this could end up with the whole task not
      // being in view.
      window.scrollTo(0, oy - window.innerHeight / 2);
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

  // Invokes the function for every descendant element that matches
  // the class name.
  function withClass(parent, cls, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withClass', arguments);
    }
    var els = parent.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Invokes the function for every descendant element that matches a
  // tag name.
  function withTag(parent, tag, f) {
    if (arguments.length > 3) {
      error('Too many arguments passed to withTag', arguments);
    }
    var els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Finds a parentElement which matches the specified
  // predicate. Returns null if element is null.
  function findParent(el0, predicate) {
    if (!el0) return null;
    var el = el0.parentElement;
    if (!el) return null;
    do {
      if (predicate(el)) {
        return el;
      }
      el = el.parentElement;
    } while (el);
    return null;
  }

  // Returns first descendant that matches the specified class and
  // predicate.
  function getFirstClass(parent, cls, predicate) {
    return findFirst(predicate, parent.getElementsByClassName(cls));
  }

  // Returns last descendant that matches the specified class and
  // predicate.
  function getLastClass(parent, cls, predicate) {
    return findLast(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one descendant element that matches the class name and
  // predicate, and returns it. Returns null if it is not found or not unique.
  function getUniqueClass(parent, cls, predicate) {
    return findUnique(predicate, parent.getElementsByClassName(cls));
  }

  // Checks that there is only one descendant element that matches the
  // class name, and invokes the function on it. Logs a warning if
  // there isn't exactly one.
  function withUniqueClass(parent, cls, predicate, f) {
    var result = getUniqueClass(parent, cls, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with class', cls, 'and matching predicate, instead got', result);
      return null;
    }
  }

  // Checks that there is only one descendant element that matches the
  // tag and predicate, and returns it. Returns null if it is not
  // found or not unique.
  function getUniqueTag(parent, tag, predicate) {
    return findUnique(predicate, parent.getElementsByTagName(tag));
  }

  // Checks that there is only one descendant element that matches the
  // tag, and invokes the function on it. Logs a warning if there
  // isn't exactly one.
  function withUniqueTag(parent, tag, predicate, f) {
    var result = getUniqueTag(parent, tag, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique descendant with tag', tag, 'and passing predicate');
      return null;
    }
  }

  // Given a predicate, returns a value if there is a unique child
  // which matches it.
  function getUniqueChild(parent, predicate) {
    return findUnique(predicate, parent.children);
  }

  // Checks that there is only one child element that matches the
  // predicate, and invokes the function on it. Logs a warning if
  // there isn't exactly one.
  function withUniqueChild(parent, predicate, f) {
    var result = getUniqueChild(parent, predicate);
    if (result) {
      return f(result);
    } else {
      warn('Couldn\'t find unique child and passing predicate');
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
      var el = array[i];
      if (pred(el)) {
        return el;
      }
    }
    return null;
  }

  // Given a predicate, returns the last element that matches. If predicate is
  // null, then it is treated like 'all'.
  function findLast(predicate, array) {
    var pred = checkedPredicate('findLast', predicate ? predicate : all);
    for (var i = array.length - 1; i >= 0; i--) {
      var el = array[i];
      if (pred(el)) {
        return el;
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
      var el = array[i];
      if (pred(el)) {
        if (result === null) {
          result = el;
        } else {
          debug('findUnique didn\'t find unique element because there are multiple results. Here are two:', result, el);
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
    var options = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mousedown', options));
    el.dispatchEvent(new MouseEvent('mouseup', options));
    el.dispatchEvent(new MouseEvent('click', options));
  }

  // Sum offsetTop / offsetLeft of all offsetParent to compute x / y.
  function offset(el) {
    var x = 0;
    var y = 0;
    var cur = el;
    while (cur) {
      x += cur.offsetLeft;
      y += cur.offsetTop;
      cur = cur.offsetParent;
    }
    return {x: x, y: y};
  }

  /*****************************************************************************
   * Predicates (for use with get / with functions above)
   */

  // Predicate which always returns 'true'.
  function all() {
    return true;
  }

  // Returns predicate which returns 'true' if text content matches wanted text.
  // eslint-disable-next-line no-unused-vars
  function matchingText(txt) {
    return function(el) {
      return el.textContent === txt;
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
      return el.tagName.toLowerCase() === tag;
    };
  }

  // Returns predicate which returns 'true' if the element has the specified id.
  function matchingId(id) {
    return function(el) {
      return el.id === id;
    };
  }

  // Returns predicate which returns 'true' if the element has the specified attribute.
  function matchingAttr(k, v) {
    return function(el) {
      var attr = el.attributes[k];
      if (attr) {
        return attr.value === v;
      } else {
        return false;
      }
    };
  }

  // Predicate, returns 'true' if the element is hidden with 'display: none'.
  function hidden(el) {
    return el.style.display === 'none';
  }

  // Inverts the result of a predicate.
  function not(p) {
    return function(x) {
      return !p(x);
    };
  }

  function sameElement(el1) {
    return function(el2) {
      // eslint-disable-next-line eqeqeq
      return el1 == el2;
    };
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
   * Utilities for creating elements
   */

  function text(x) {
    return document.createTextNode(x);
  }

  function span() {
    var args = [].slice.call(arguments);
    args.unshift('span');
    return element.apply(null, args);
  }

  function div() {
    var args = [].slice.call(arguments);
    args.unshift('div');
    return element.apply(null, args);
  }

  function element(t, cls) {
    var el = document.createElement(t);
    if (cls) {
      el.classList.add(cls);
    }
    for (var i = 2; i < arguments.length; i++) {
      el.appendChild(arguments[i]);
    }
    return el;
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

  function updateBackgroundColor() {
    withId(BACKGROUND_ID, function(background) {
      try {
        var todoistBackgroundColor =
          background.computedStyleMap().get('background-color').toString();
        debug('Background color is', todoistBackgroundColor);
        addCss([
          '.' + TODOIST_SHORTCUTS_TIP + ' {',
          // Since the tips overlap expand / collapse arrows, set
          // background.
          '  background-color: ' + todoistBackgroundColor + ';',
          '}'
        ]);
      } catch (e) {
        error('Failed to figure out background color:', e);
      }
    });
  }
  updateBackgroundColor();
  // Sometimes there's a lag for the theme to update, so re-query it
  // after 5 seconds.
  setTimeout(updateBackgroundColor, 5000);

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
    '  margin-left: -22px;',
    '  width: 22px;',
    '  font-family: monospace;',
    '  font-weight: normal;',
    '  font-size: 18px;',
    '  color: #dd4b39;',
    // Ensure that these get displayed over other UI. See issue#34
    '  z-index: 2147483647;',
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
    '.expansion_panel__toggle .' + TODOIST_SHORTCUTS_TIP + ' {',
    '  margin-top: -1px;',
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
    '@media (max-width: 750px) {',
    '  body.' + TODOIST_SHORTCUTS_NAVIGATE + ' #left_menu {',
    '    left: 0;',
    '    bottom: 0;',
    '  }',
    '}',
    '',
    // Based directly on Todoist's .notifier
    '.ts-note, .ts-modal {',
    '  position: fixed;',
    '  min-height: 22px;',
    '  background-color: #4c4c4d;',
    '  right: 24px;',
    '  bottom: 24px;',
    '  border-radius: 3px;',
    '  z-index: 19000;',
    '  -webkit-transition: opacity .25s ease-in;',
    '  transition: opacity .25s ease-in;',
    '  -webkit-box-shadow: rgba(0,0,0,0.156863) 0 2px 3px 0, rgba(0,0,0,0.0588235) 0 1px 10px 0, rgba(0,0,0,0.0196078) 0 4px 6px 0;',
    '  box-shadow: rgba(0,0,0,0.156863) 0 2px 3px 0, rgba(0,0,0,0.0588235) 0 1px 10px 0, rgba(0,0,0,0.0196078) 0 4px 6px 0;',
    '  max-width: 90%;',
    '}',
    '',
    '.ts-modal {',
    '  left: 10%;',
    '  width: 80%;',
    '  top: 10%;',
    '  overflow: auto;',
    '}',
    '',
    '.ts-note-content, .ts-modal-content {',
    '  padding: 12px 30px;',
    '  display: block;',
    '  margin-top: 1px;',
    '  color: #fff;',
    '  line-height: 1.75em;',
    '}',
    '',
    '.ts-note-prefix {',
    '  color: #de4c4a;',
    '}',
    '',
    '.ts-note a, .ts-modal a {',
    '  color: #de4c4a;',
    '}',
    '',
    '.ts-note-key {',
    '  color: #f59c53;',
    '  border: 1px solid #ccc;',
    '  padding: 0.1em;',
    '  font-size: 150%;',
    '}',
    '',
    '.ts-note-close, .ts-modal-close {',
    '  position: absolute;',
    '  top: 5px;',
    '  right: 5px;',
    '  color: #282828;',
    '  cursor: pointer;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_HELP + ' {',
    '  text-align: center;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_HELP_CONTAINER + ' {',
    '  display: inline-block;', // Causes centering due to text-align above.
    '  width: 100em;',
    '  height: 70em;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_HELP_CONTAINER + ' iframe {',
    '  width: 100%;',
    '  height: 100%;',
    '}',
    '',
    '.' + TODOIST_SHORTCUTS_HELP + ' ul {',
    '  text-align: initial;',
    '  font-size: 150%;',
    '  line-height: 150%;',
    '}'
  ].join('\n'));

  // A CSS style element, dynamically updated by updateCursorStyle. MUTABLE.
  var cursorStyle = addCss('');

  // This is unusual. Usually you would not dynamically generate CSS that uses
  // different IDs. However, this is a nice hack in this case, because todoist
  // frequently re-creates elements.
  function updateCursorStyle() {
    var selecter = getKeySelecter(lastCursorId, lastCursorIndent);
    cursorStyle.textContent = [
      selecter + ' {',
      '  border-left: 2px solid #4073d6;',
      '  margin-left: -4px;',
      '}',
      selecter + ' .sel_checkbox_td {',
      '  padding-left: 2px;',
      '}',
      selecter + ' .drag_and_drop_handler {',
      '  margin-left: -21px;',
      '}',
      // TODO: There seems to be a todoist typo in the class name
      // here, so including a non-typoed one in case they fix this
      // (margin vs marigin).
      selecter + ' .drag_and_drop_handler.extra_arrow_marigin, ' + selecter + ' .drag_and_drop_handler.extra_arrow_margin {',
      '  margin-left: -37px;',
      '}',
      selecter + ' .arrow {',
      '  margin-left: -25px;',
      '}'
    ].join('\n');
  }

  // See comment on 'getTaskById' for explanation
  function getKeySelecter(id, indent) {
    if (stripPrefix('agenda', viewMode) && indent !== null) {
      return '#' + id + '.' + indent;
    } else if (viewMode === 'project') {
      return '#' + id;
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
  }

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
        error('Improper binding entry at index', i, 'value is', binds[i]);
      }
    }
  }

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  handlePageChange();
  registerTopMutationObservers();
  updateViewMode();

  setTimeout(function() {
    // Remove todoist's global keyboard handler.
    if (!window.originalTodoistKeydown) { window.originalTodoistKeydown = document.onkeydown; }
    if (!window.originalTodoistKeyup) { window.originalTodoistKeyup = document.onkeyup; }
    if (!window.originalTodoistKeypress) { window.originalTodoistKeypress = document.onkeypress; }
    if (!window.originalTodoistScrollBy) { window.originalTodoistScrollBy = window.scrollBy; }

    // Focus is on an input box during bulk move code, and mousetrap doesn't
    // handle those events.  So this handling needs to be done manually.
    document.onkeydown = function(ev) {
      if (inBulkMoveMode) {
        return handleBulkMoveKey(ev);
      }
      if (ev.keyCode === 27 && ev.type === 'keydown') {
        closeContextMenus();
      }
      return true;
    };
    // Clear the other key handlers. Instead fallthrough to Todoist is handled
    // by 'originalHandler'.
    document.onkeypress = function() {};
    document.onkeyup = function() {};

    // Initialize mousetrap.
    mousetrap = new Mousetrap(document);

    // Register key bindings with mousetrap.
    registerKeybindings(DEFAULT_KEYMAP, KEY_BINDINGS);
    registerKeybindings(SCHEDULE_KEYMAP, SCHEDULE_BINDINGS);
    registerKeybindings(BULK_SCHEDULE_KEYMAP, BULK_SCHEDULE_BINDINGS);
    registerKeybindings(BULK_MOVE_KEYMAP, BULK_MOVE_BINDINGS);
    registerKeybindings(NAVIGATE_KEYMAP, NAVIGATE_BINDINGS);
    registerKeybindings(POPUP_KEYMAP, POPUP_BINDINGS);
    registerKeybindings(SMART_SCHEDULER_KEYMAP, SMART_SCHEDULER_BINDINGS);

    // Reset mousetrap on disable.
    onDisable(function() { mousetrap.reset(); });

    // Register mouseover / mousemove handler.
    document.addEventListener('mousemove', handleMouseMove);
    onDisable(function() {
      document.removeEventListener('mousemove', handleMouseMove);
    });
    document.addEventListener('mouseover', handleMouseOver);
    onDisable(function() {
      document.removeEventListener('mouseover', handleMouseOver);
    });
  });
})();
