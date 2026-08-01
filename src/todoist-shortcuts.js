/* global TodoistShortcutsMousetrap */

(function() {
  // Set this to true to get more log output.
  const DEBUG = false;

  const IS_CHROME =
    /Chrom/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  const IS_SAFARI =
    /Safari/.test(navigator.userAgent) && /Apple/.test(navigator.vendor);

  // Cursor navigation.
  const CURSOR_BINDINGS = [
    [['j', 'down'], cursorDown],
    [['k', 'up'], cursorUp],
    [['h', 'left'], cursorLeft],
    [['l', 'right'], cursorRight],
    ['^', cursorFirst],
    ['$', cursorLast],
    ['{', cursorUpSection],
    ['}', cursorDownSection],
  ];

  // Here's where the keybindings get specified. Of course, feel free to modify
  // this list, or modify this script in general.
  const KEY_BINDINGS = [].concat(CURSOR_BINDINGS, [

    // Navigation
    ['g', navigate],
    ['G', navigateToTask],
    ['`', nextLeftMenuItem],
    ['shift+`', prevLeftMenuItem],

    // Manipulation of tasks at cursor
    ['enter', edit],
    ['shift+enter', followLink],
    ['shift+o', addAbove],
    ['o', addBelow],
    ['a', addTaskBottom],
    ['shift+a', addTaskTop],
    ['i', openTaskView],
    ['c', openComments],
    ['shift+r', openReminders],
    ['+', openAssign],
    ['>', openDeadline],
    [['shift+j', 'shift+down', 'alt+down'], moveDown],
    [['shift+k', 'shift+up', 'alt+up'], moveUp],
    [['shift+h', 'shift+left'], moveOut],
    [['shift+l', 'shift+right'], moveIn],

    // Selection
    ['x', toggleSelect],
    ['* a', selectAllTasks],
    ['* n', deselectAllTasks],
    ['* o', selectAllOverdue],
    ['* s', selectSection],
    ['* 1', selectPriority('1')],
    ['* 2', selectPriority('2')],
    ['* 3', selectPriority('3')],
    [['* 4', '* 0'], selectPriority('4')],
    [['* h', '* left'], collapseAll],
    [['* l', '* right'], expandAll],

    // Manipulation of selected tasks
    ['t', schedule],
    ['shift+t', scheduleText],
    ['alt+t', scheduleTime],
    ['d', done],
    [['e', '#'], deleteTasks],
    ['&', duplicateTasks],
    ['v', moveToProject],
    [['y', '@'], openLabelMenu],
    ['1', setPriority('4')],
    ['2', setPriority('3')],
    ['3', setPriority('2')],
    [['4', '0'], setPriority('1')],
    ['shift+c', toggleTimer],

    // Projects
    //
    // Disabled as it's broken
    // ['shift+p', openCurrentProjectLeftNavMenu],

    // Bulk reschedule / move modes were removed
    ['* t', notifyBulkActionsRemoved],
    ['* v', notifyBulkActionsRemoved],

    // Other

    [['u', 'z', 'ctrl+z'], undo],

    ['q', quickAdd],
    ['m', toggleLeftNav],
    [['f', '/'], focusSearch],
    ['!', openNotifications],
    ['?', openHelpModal],
    ['ctrl+s', sync],
    ['ctrl+k', openCommandMenu],
    ['ctrl+shift+,', copyCursorOrSelectedUrls],
    ['ctrl+,', copyCursorOrSelectedTitles],
    ['ctrl+c', copyCursorOrSelectedAsMarkdown],
    ['ctrl+shift+/', openRandomTask],
    ['w', openMoreActionsMenu],
    ['shift+v', nextLayout],

    // See https://github.com/mgsloan/todoist-shortcuts/issues/30
    // [???, importFromTemplate],
  ]);
  const DEFAULT_KEYMAP = 'default';

  // Build cursor movement bindings that can be used in schedule mode
  const SCHEDULE_CURSOR_BINDINGS = [];
  for (const binding of CURSOR_BINDINGS) {
    SCHEDULE_CURSOR_BINDINGS.push([
      binding[0],
      sequence([closeContextMenus, binding[1], schedule]),
    ]);
  }

  // Scheduling keybindings (used when scheduler is open)
  const SCHEDULE_BINDINGS = [].concat(SCHEDULE_CURSOR_BINDINGS, [
    ['c', scheduleToday],
    ['t', schedulePlusN(1)],
    ['w', scheduleNextWeek],
    ['n', scheduleNextWeekend],
    ['m', scheduleNextMonth],
    [['s', 'p'], schedulePostpone],
    ['r', unschedule],
    ['0', scheduleToday],
    ['1', schedulePlusN(1)],
    ['2', schedulePlusN(2)],
    ['3', schedulePlusN(3)],
    ['4', schedulePlusN(4)],
    ['5', schedulePlusN(5)],
    ['6', schedulePlusN(6)],
    ['7', schedulePlusN(7)],
    ['8', schedulePlusN(8)],
    ['9', schedulePlusN(9)],
    ['alt+t', scheduleTime],
    ['shift+t', scheduleText],
    ['escape', closeContextMenus],
    // See #256 for why this is no longer needed
    // ['fallback', schedulerFallback],
    // See #252 for why these are disabled.
    [['j', 'k', 'up', 'down'], noop],
  ]);
  const SCHEDULE_KEYMAP = 'schedule';

  const TASK_VIEW_BINDINGS = [
    ['enter', taskViewEdit],
    ['d', taskViewDone],
    [['i', 'escape'], taskViewClose],
    ['h', taskViewParent],
    ['j', taskViewNext],
    ['k', taskViewPrevious],
    ['c', taskViewComments],
    // TODO(#94): proper bindings for o / O.
    [['q', 'a', 'A', 'o', 'O'], taskViewAddSubtask],
    ['t', taskViewSchedule],
    ['shift+t', taskViewScheduleText],
    ['+', taskViewOpenAssign],
    ['v', taskViewMoveToProject],
    [['y', '@'], taskViewLabel],
    ['1', taskViewSetPriority('1')],
    ['2', taskViewSetPriority('2')],
    ['3', taskViewSetPriority('3')],
    [['4', '0'], taskViewSetPriority('4')],
    ['shift+r', taskViewOpenReminders],
    [['e', '#'], taskViewDelete],
    ['shift+c', taskViewToggleTimer],
    ['ctrl+shift+/', async () => {
      await taskViewClose();
      await openRandomTask();
    }],
  ];
  const TASK_VIEW_KEYMAP = 'task_view';

  const MENU_LIST_BINDINGS = [
    [['j', 'down', 'tab'], nextMenuListItem],
    [['k', 'up', 'shift+tab'], prevMenuListItem],
    [['enter', 'space'], selectMenuListItem],
  ];
  const MENU_LIST_KEYMAP = 'menu_list';

  // Keycode constants
  const UP_ARROW_KEYCODE = 38;
  const DOWN_ARROW_KEYCODE = 40;
  const BACKSPACE_KEYCODE = 8;
  const ENTER_KEYCODE = 13;
  const ESCAPE_KEYCODE = 27;

  // Navigation mode uses its own key handler.
  const NAVIGATE_BINDINGS = [['fallback', handleNavigateKey]];
  const NAVIGATE_KEYMAP = 'navigate';

  // Keymap used when there is a floating window.
  const POPUP_BINDINGS = [];
  const POPUP_KEYMAP = 'popup';

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
  const WHAT_CURSOR_APPLIES_TO = 'all';

  // 'navigate' (g) attempts to assign keys to items based on their names. In
  // some case there might not be a concise labeling. This sets the limit on key
  // sequence length for things based on prefixes.
  const MAX_NAVIGATE_PREFIX = 2;

  const TODOIST_SHORTCUTS_TIP = 'todoist_shortcuts_tip';
  const TODOIST_SHORTCUTS_TIP_TYPED = 'todoist_shortcuts_tip_typed';
  const TODOIST_SHORTCUTS_WARNING = 'todoist_shortcuts_warning';
  const TODOIST_SHORTCUTS_HELP = 'todoist_shortcuts_help';
  const TODOIST_SHORTCUTS_HELP_CONTAINER = 'todoist_shortcuts_help_container';

  const TODOIST_SHORTCUTS_GITHUB = 'https://github.com/mgsloan/todoist-shortcuts';

  // This user script will get run on iframes and other todoist pages. Should
  // skip running anything if #todoist_app doesn't exist.
  const todoistRootDiv = document.getElementById('todoist_app');
  if (!todoistRootDiv) throw new Error('no div with id "todoist_app"');

  // Set on initialization to mousetrap instance.
  let mousetrap = null;

  /*****************************************************************************
   * Options
   */

  let options = {};

  function loadOptions() {
    try {
      const serializedOptions =
            document.body.getAttribute('data-todoist-shortcuts-options');
      if (!serializedOptions) throw new Error('Missing options data');
      options = JSON.parse(serializedOptions);
      info('Loaded options:', options);
    } catch (e) {
      error('ignoring error loading options (will use defaults instead):', e);
    }
  }

  function getMouseBehaviorOption() {
    const result = options['mouse-behavior'];
    if (!result) {
      return 'focus-follows-mouse';
    }
    return result;
  }

  function getCursorMovementOption() {
    const result = options['cursor-movement'];
    if (!result) {
      return 'follows-task-within-section';
    }
    return result;
  }

  /*****************************************************************************
   * Action combiners
   */

  // Take multiple actions (functions that take no arguments), and run them in
  // sequence.
  // eslint-disable-next-line no-unused-vars
  // Note that this is not itself async: it returns the action to run, and an
  // async function would return a promise of one, which is not something that
  // can be bound to a key.
  function sequence(actions) {
    return async () => {
      for (let i = 0; i < actions.length; i++) {
        await actions[i]();
      }
    };
  }

  // If the condition is true, runs the first action, otherwise runs the second.
  // eslint-disable-next-line no-unused-vars
  function ifThenElse(condition, calendarAction, normalAction) {
    return () => {
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
  async function cursorDown() {
    const cursorChanged = modifyCursorIndex((ix) => ix + 1);
    if (!cursorChanged && isUpcomingView()) {
      scrollTaskToTop(getCursor());
    }
  }
  async function cursorUp() {
    const cursorChanged = modifyCursorIndex((ix) => ix - 1);
    if (!cursorChanged && isUpcomingView()) {
      info('scrolling task to bottom');
      scrollTaskToBottom(getCursor());
    }
  }

  // Move the cursor to first / last task.
  async function cursorFirst() {
    disabledWithLazyLoading('Cursoring first task', () => {
      setCursorToFirstTask('scroll');
    });
  }
  async function cursorLast() {
    disabledWithLazyLoading('Cursoring last task', () => {
      setCursorToLastTask('scroll');
    });
  }

  async function cursorUpSection() {
    disabledWithLazyLoading('Moving cursor up a section', () => {
      const cursor = requireCursor();
      let section = getSection(cursor);
      section = findParent(section, matchingTag('li')) || section;
      let firstTask = getFirstTaskIn(section);
      if (firstTask && !sameElement(cursor)(firstTask)) {
        // Not on first task, so move the cursor.
        setCursor(firstTask, 'scroll');
      } else {
        // If already on the first task of this section, then select
        // first task of prior populated section, if any exists.
        section = section.previousSibling;
        for (; section; section = section.previousSibling) {
          firstTask = getFirstTaskIn(section);
          if (firstTask) {
            setCursor(firstTask, 'scroll');
            return;
          }
        }
      }
    });
  }

  async function cursorDownSection() {
    disabledWithLazyLoading('Moving cursor down a section', () => {
      const cursor = requireCursor();
      let startSection = getSection(cursor);
      startSection =
        findParent(startSection, matchingTag('li')) || startSection;
      let section = startSection.nextSibling;
      for (; section; section = section.nextSibling) {
        debug('section = ', section);
        const firstTask = getFirstTaskIn(section);
        if (firstTask) {
          setCursor(firstTask, 'scroll');
          return;
        }
      }
      // If execution has reached this point, then we must already be
      // on the last section.
      const lastTask = getLastTaskInSection(startSection);
      warn('Already on last section. lastTask =', lastTask);
      if (lastTask) {
        setCursor(lastTask, 'scroll');
      }
    });
  }

  // Edit the task under the cursor.
  async function edit() {
    clickTaskEdit(requireCursor());
  }

  // Follow the first link of the task under the cursor.
  async function followLink() {
    const contentQuery = '.task_list_item__content';
    withUnique(requireCursor(), contentQuery, all, (content) => {
      const link = getFirst(content, 'a');
      if (link) {
        if (IS_CHROME) {
          const middleClick =
                new MouseEvent( 'click', {'button': 1, 'which': 2});
          link.dispatchEvent(middleClick);
        } else {
          click(link);
        }
      } else {
        info('Didn\'t find a link to click.');
      }
    });
  }

  // Toggles selection of the task focused by the cursor.
  async function toggleSelect() {
    await toggleSelectTask(requireCursor());
  }

  // Selects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  async function select() {
    selectTask(requireCursor());
  }

  // Deselects the task focused by the cursor.
  // eslint-disable-next-line no-unused-vars
  async function deselect() {
    deselectTask(requireCursor());
  }

  // Clicks the 'schedule' link when tasks are selected.  If
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the
  // cursor if there is no selection.
  async function schedule() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await clickTaskSchedule(mutateCursor);
      await blurSchedulerInput();
    } else {
      clickUniqueRetrying(
          document,
          'button[data-action-hint="multi-select-toolbar-scheduler"]');
      await blurSchedulerInput();
    }
  }

  // Edits the task under the cursor and focuses the textual representation of
  // when the task is scheduled. Only works for the cursor, not for the
  // selection.
  async function scheduleText() {
    const scheduler = findScheduler();
    if (scheduler) {
      withAll(scheduler, 'input', all, (el) => el.focus() );
      return;
    }
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await clickTaskSchedule(mutateCursor);
    } else {
      clickUnique(
          document,
          'button[data-action-hint="multi-select-toolbar-scheduler"]');
    }
  }

  async function scheduleTime() {
    if (!findScheduler()) {
      scheduleText();
    }
    // Waiting for the scheduler rather than guessing at how long it takes to
    // open, which is longer than it used to be.
    const scheduler = await retryWithDelay('finding scheduler', findScheduler);
    // Todoist used to mark the "Time" button with aria-controls and no longer
    // does, leaving its text as the only way to tell it apart.
    const timeButton =
        getUnique(scheduler, 'button[aria-controls]') ||
        getUnique(scheduler, 'button', matchingText('Time'));
    if (!timeButton) {
      warn('Couldn\'t find the scheduler\'s time button.');
      return;
    }
    click(timeButton);
    await focusTimeInput();
  }

  async function openDeadline() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      clickTaskEdit(mutateCursor);
      await clickAllRetrying(document, '[aria-label="Set deadline"]');
      // Todoist seems to put back the focus, so try a few times to blur.
      await blurSchedulerInput();
      sleep(20);
      await blurSchedulerInput();
      sleep(50);
      await blurSchedulerInput();
      sleep(100);
      await blurSchedulerInput();
    }
  }

  // Click 'today' in schedule. Only does anything if schedule is open.
  async function scheduleToday() {
    withScheduler(
        'scheduleToday',
        (scheduler) => {
          clickUnique(
              scheduler,
              'button',
              matchingAttr('data-track', 'scheduler|date_shortcut_today'));
        });
  }

  // Click 'next week' in schedule. Only does anything if schedule is open.
  async function scheduleNextWeek() {
    const date = new Date();
    const day = date.getDay();
    if (day === 0) {
      schedulePlusN(1)();
    } else if (day > 0) {
      schedulePlusN(8 - day)();
    }
  }

  // Click 'next weekend' in schedule. Only does anything if schedule is open.
  async function scheduleNextWeekend() {
    withScheduler(
        'scheduleNextWeekend',
        (scheduler) => {
          clickUnique(
              scheduler,
              'button',
              matchingAttr('data-track',
                  'scheduler|date_shortcut_nextweekend'));
        });
  }

  // Click the same day of the next month in the schedule's calendar. Only does
  // anything if schedule is open.
  //
  // Todoist used to have a button for this, but the scheduler's buttons are
  // now only today, tomorrow, next week and next weekend.
  async function scheduleNextMonth() {
    const date = new Date();
    const dayOfMonth = date.getDate();
    // Moving to the start of the month before changing month avoids
    // overshooting: setting the month while on the 31st, when the next month
    // has 30 days, lands in the month after that instead.
    date.setDate(1);
    date.setMonth(date.getMonth() + 1);
    date.setDate(Math.min(dayOfMonth, daysInMonth(date)));
    clickSchedulerDate('scheduleNextMonth', date);
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  // Clicks date on scheduler 1-9 days in the future
  function schedulePlusN(n) {
    return async () => {
      const date = new Date();
      date.setDate(date.getDate() + n);
      clickSchedulerDate('schedulePlusN', date);
    };
  }

  // Clicks a day in the scheduler's calendar, which labels them with the date
  // in ISO format.
  function clickSchedulerDate(name, date) {
    const label = dateToIsoFormatUsingCurrentTimezone(date);
    withScheduler(
        name,
        (scheduler) => {
          clickUnique(scheduler, 'button', matchingAttr('aria-label', label));
        });
  }

  // Clicks 'postpone' in the scheduler, which Todoist only offers for
  // recurring tasks.
  async function schedulePostpone() {
    withScheduler(
        'schedulePostpone',
        (scheduler) => {
          clickUnique(
              scheduler,
              'button',
              matchingAttr('data-track',
                  'scheduler|date_shortcut_postpone'));
        });
  }

  // Click 'no due date' in schedule. Only does anything if schedule is open.
  async function unschedule() {
    withScheduler(
        'unschedule',
        (scheduler) => {
          clickUnique(
              scheduler,
              'button',
              matchingAttr('data-track', 'scheduler|date_shortcut_nodate'));
        });
  }

  // Clicks 'Move to project' for the selection. If WHAT_CURSOR_APPLIES_TO is
  // 'all' or 'most', then instead applies to the cursor if there is no
  // selection.
  async function moveToProject() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await clickTaskMenu(
          mutateCursor,
          'task-overflow-menu-move-to-project',
          false);
    } else {
      clickUnique(
          document,
          'button[data-action-hint="multi-select-toolbar-project-picker"]');
    }
  }

  // Clicks 'Move to project' for the selection, and moves to the
  // named project.
  // eslint-disable-next-line no-unused-vars
  function moveToProjectNamed(projectName) {
    return async () => {
      const mutateCursor = getCursorToMutate();
      if (mutateCursor) {
        await clickTaskMenu(
            mutateCursor,
            'task-overflow-menu-move-to-project',
            false);
        withUnique(
            document,
            '.popper',
            hasChild('[aria-label="'+projectName+'"]'),
            (menu) => {
              clickUnique(
                  menu,
                  'li',
                  matchingAttr('aria-label', projectName));
            });
      } else {
        withUnique(
            document,
            'button[data-action-hint="multi-select-toolbar-project-picker"]',
            all,
            (menu) => {
              click(menu);
              withUnique(
                  document,
                  '.popper',
                  hasChild('[aria-label="'+projectName+'"]'),
                  (menu) => {
                    clickUnique(
                        menu,
                        'li',
                        matchingAttr('aria-label', projectName));
                  });
            },
        );
      }
    };
  }

  // Sets the priority of the selected tasks to the specified level. If
  // WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead applies to the
  // cursor if there is no selection.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function setPriority(level) {
    return async () => {
      const mutateCursor = getCursorToMutate();
      if (mutateCursor) {
        // The task's contextual menu has priority items in it, so unlike
        // opening the task editor, no separate save step is needed.
        await clickTaskMenu(
            mutateCursor,
            'task-overflow-menu-priority-' + level,
            false);
      } else {
        await clickUniqueRetrying(
            document,
            'button[data-action-hint="multi-select-toolbar-priority-picker"]');
        const menu = await getUniqueRetrying(document, '.priority_picker');
        await clickPriorityMenu(menu, level);
      }
    };
  }

  // Adds tasks matching the specified priority level to the current selection,
  // even if they are hidden by collapsing.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function selectPriority(level) {
    return async () => {
      const actualLevel = invertPriorityLevel(level);
      const allTasks = getTasks('include-collapsed');
      const selected = getSelectedTaskKeys();
      let modified = false;
      for (const task of allTasks) {
        if (getTaskPriority(task) === actualLevel) {
          selected[getTaskKey(task)] = true;
          modified = true;
        }
      }
      if (modified) {
        await setSelections(selected);
      }
    };
  }

  // Mark all the tasks as completed. If WHAT_CURSOR_APPLIES_TO is 'all', then
  // instead applies to the cursor if there is no selection.
  async function done() {
    const mutateCursor = getCursorToMutate('dangerous');
    if (mutateCursor) {
      clickTaskDone(mutateCursor);
    } else {
      clickUnique(
          openMoreMenu(),
          '[data-action-hint="multi-select-toolbar-overflow-menu-complete"]',
          all,
      );
    }
  }

  // Delete selected tasks. Todoist will prompt for deletion. Since
  // todoist prompts, this is not treated as a 'dangerous' action.  As
  // such, if WHAT_CURSOR_APPLIES_TO is 'all' or 'most', then instead
  // applies to the cursor if there is no selection.
  async function deleteTasks() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await clickTaskMenu(mutateCursor, 'task-overflow-menu-delete', false);
    } else {
      clickUnique(
          openMoreMenu(),
          '[data-action-hint="multi-select-toolbar-overflow-menu-delete"]');
    }
  }

  async function duplicateTasks() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await clickTaskMenu(mutateCursor, 'task-overflow-menu-duplicate', false);
    } else {
      clickUnique(
          openMoreMenu(),
          '[data-action-hint="multi-select-toolbar-overflow-menu-duplicate"]',
      );
    }
  }

  // Opens the label toggling menu.
  async function openLabelMenu() {
    if (isEmptyMap(getSelectedTaskKeys())) {
      await select();
    }
    withUnique(document, '.multi_select_toolbar', all, (toolbar) => {
      clickUnique(
          toolbar,
          'button',
          matchingAction('multi-select-toolbar-label-picker'));
    });
  }

  const TIMER_QUERY =
    '.toggl-button, .clockify-button-inactive, .clockify-button-active';

  // If toggl-button or clockify extension is in use, clicks the
  // button element in the task.
  async function toggleTimer() {
    clickUnique(requireCursor(), TIMER_QUERY, all);
  }

  // Toggles collapse / expand of a task, if it has children.
  async function toggleCollapse(task) {
    clickUnique(
        task ? task : requireCursor(),
        '[data-action-hint=task-toggle-collapse]');
  }

  // Collapse cursor. If it is already collapsed, select and collapse parent.
  async function cursorLeft() {
    if (checkTaskExpanded(requireCursor())) {
      toggleCollapse();
    } else {
      selectAndCollapseParent();
    }
  }

  // Expand cursor and move down.
  async function cursorRight() {
    if (checkTaskCollapsed(requireCursor())) {
      toggleCollapse();
      cursorDown();
    }
  }

  // Collapses or expands task under the cursor, that have children. Does
  // nothing if it's already in the desired state.

  async function collapse(task0) {
    const task = task0 ? task0 : requireCursor();
    if (checkTaskExpanded(task)) {
      toggleCollapse(task);
    }
  }
  // eslint-disable-next-line no-unused-vars
  async function expand(task0) {
    const task = task0 ? task0 : requireCursor();
    if (checkTaskCollapsed(task)) {
      toggleCollapse(task);
    }
  }

  // Move selection to parent project.
  async function selectAndCollapseParent() {
    const cursor = requireCursor();
    const tasks = getTasks();
    for (let i = 0; i < tasks.length; i++) {
      let task = tasks[i];
      if (task === cursor) {
        for (let j = i; j >= 0; j--) {
          task = tasks[j];
          if (getUnique(task, '.down')) {
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
  async function collapseAll() {
    repeatedlyClickArrows('.down');
  }
  async function expandAll() {
    repeatedlyClickArrows('.right');
  }

  // Clears all selections.
  async function deselectAllTasks() {
    click(document.body);
  }

  // Selects all tasks, even those hidden by collapsing.
  async function selectAllTasks() {
    /* Old definition before hacks to fix Todoist behavioral regressions (#281)
    const allTasks = getTasks('include-collapsed');
    for (let i = 0; i < allTasks.length; i++) {
      setTimeout(() => selectTask(allTasks[i]));
    }
    */

    const selections = {};
    for (const task of getTasks('include-collapsed')) {
      selections[getTaskKey(task)] = true;
    }
    await setSelections(selections);
  }

  // Selects all overdue tasks.
  async function selectAllOverdue() {
    /* Old definition before hacks to fix Todoist behavioral regressions (#281)
    for (const task of getTasks()) {
      if (getUnique(task, '.date_overdue')) {
        setTimeout(() => selectTask(task));
      }
    }
    */

    const selections = {};
    for (const task of getTasks()) {
      if (getUnique(task, '.date_overdue')) {
        selections[getTaskKey(task)] = true;
      }
    }
    await setSelections(selections);
  }

  async function selectSection() {
    const cursor = getCursor();
    if (!cursor) {
      return;
    }
    const section = getSection(cursor);
    const selections = {};
    for (const task of getTasks()) {
      if (getSection(task) === section) {
        selections[getTaskKey(task)] = true;
      }
    }
    await setSelections(selections);
  }

  async function addTaskBottom() {
    addToSectionContaining(getCursor());
  }

  async function addTaskTop() {
    if (viewMode === 'agenda') {
      quickAdd();
    } else {
      const tasks = getTasks();
      if (tasks.length > 0) {
        await addAboveTask(tasks[0]);
      } else {
        quickAdd();
      }
    }
  }

  // The li which holds the editor for adding or editing a task inline. This is
  // also how getTasks recognizes it, when including editors.
  const TASK_EDITOR_SELECTOR = 'li.manager';

  function findTaskEditor() {
    return getUnique(document, TASK_EDITOR_SELECTOR);
  }

  // Note that the editor is waited for: this gets called right after clicking
  // something that opens it, before it has rendered.
  async function scrollTaskEditorIntoView() {
    const editor = await retryWithDelay(
        'finding task editor', findTaskEditor).catch(() => null);
    if (editor) {
      verticalScrollIntoView(editor, 'nearest', false);
    } else {
      debug('no task editor to scroll into view.');
    }
  }

  // Add a task above / below cursor. Unfortunately these options do not exist
  // in agenda mode, so in that case, instead it is added to the current
  // section.
  async function addAbove() {
    await addAboveTask(getCursor());
  }

  async function addBelow() {
    await addBelowTask(getCursor());
  }

  // Open comments sidepane
  async function openComments() {
    openTaskView();
    await getUniqueRetrying(document, TASK_VIEW_SELECTOR);
    await taskViewComments();
  }

  // Open reminders dialog
  async function openReminders() {
    await clickTaskMenu(requireCursor(), 'task-overflow-menu-reminders');
  }

  // Open assign dialog
  async function openAssign() {
    const mutateCursor = getCursorToMutate();
    if (mutateCursor) {
      await withTaskHovered(mutateCursor, () => {
        const assignButton =
              getUnique(mutateCursor, '.task_list_item__person_picker');
        if (assignButton) {
          click(assignButton);
        } else {
          info('Could not find assign button, maybe project not shared?');
        }
      });
    } else {
      clickUnique(
          openMoreMenu(),
          '[data-action-hint="multi-select-toolbar-overflow-menu-asssign"]',
      );
    }
  }

  // Open the task view sidepane.
  async function openTaskView() {
    withUnique(
        requireCursor(),
        '.content, .task_list_item__body',
        all,
        click,
    );
  }

  // Click somewhere on the page that shouldn't do anything in particular except
  // closing context menus.  Also clicks 'Cancel' on any task adding.
  async function closeContextMenus() {
    for (let i = 0; i < 100; i++) {
      const popperOverlay = getLast(document, '.popper__overlay');
      if (popperOverlay) {
        click(popperOverlay);
      } else {
        break;
      }
      if (i == 99) {
        warn('Tried a lot to close poppers.');
      }
    }
    click(document.body);
    withAll(document, '.manager', all, (manager) => {
      const cancelBtn = getUnique(manager, '.cancel');
      if (cancelBtn) {
        click(cancelBtn);
      }
    });
    // Close windows with close buttons, particularly move-to-project
    //
    // (probably old)
    clickAll(document, '.GB_window .close div');
    // Close windows with close buttons
    clickAll(document, '[aria-label="Close task"]');
    clickAll(document, '[aria-label="Close modal"]');
    // Close todoist-shortcuts' modals
    clickAll(document, '.ts-modal-close');
  }

  // The ids Todoist gives the layout radio buttons in the view options menu.
  // In the order Todoist's own shift+v shortcut cycles through them.
  const LAYOUTS = ['LIST', 'BOARD', 'CALENDAR'];

  // Switches to the next layout, like Todoist's own shift+v. Since
  // todoist-shortcuts takes over Todoist's key handling, its shortcut never
  // runs, so the view options menu is used instead.
  //
  // Note that the calendar layout is only offered to Todoist Pro and Business
  // customers, and that not every view has every layout, so this cycles
  // through whichever ones are on offer.
  async function nextLayout() {
    if (!isViewOptionsOpen()) {
      clickViewOptions();
    }
    try {
      // Waiting for the first layout rather than for the menu itself, since
      // the menu has no distinguishing attributes of its own.
      await getUniqueRetrying(document, layoutQuery(LAYOUTS[0]));
      const layouts = LAYOUTS
          .map((layout) => getUnique(document, layoutQuery(layout)))
          .filter((radio) =>
            radio && !radio.disabled && isLayoutOffered(radio));
      if (layouts.length < 2) {
        info('Not switching layout, as this view offers no other layout.');
        return;
      }
      const current = layouts.findIndex((radio) => radio.checked);
      click(layouts[(current + 1) % layouts.length]);
    } finally {
      // The menu stays up after picking a layout, and would otherwise be
      // toggled shut by the next press rather than switching layout again.
      if (isViewOptionsOpen()) {
        clickViewOptions();
      }
    }
  }

  // Layouts which the account's plan doesn't include are still listed, marked
  // with an upgrade icon. Clicking one offers an upgrade instead of switching,
  // and the offer then swallows further keypresses, so they are skipped.
  function isLayoutOffered(radio) {
    const label = findParent(radio, (el) => el.tagName === 'LABEL');
    return !label || !getFirst(label, '[data-icon-name="upgrade-icon"]');
  }

  function isViewOptionsOpen() {
    return getUnique(document, layoutQuery(LAYOUTS[0])) !== null;
  }

  function clickViewOptions() {
    clickUnique(document, 'button[aria-label="View Options Menu"]');
  }

  function layoutQuery(layout) {
    return 'input[type="radio"][id="' + layout + '"]';
  }

  async function openMoreActionsMenu() {
    withUnique(document, 'header[aria-label^="Header:"]', all, (header) => {
      for (const button of selectAll(header, 'button')) {
        // If it contains 3 svg circles, it's the more menu
        // button. Sad that there is no other identifying
        // characteristic in the dom.
        if (selectAll(button, 'circle').length == 3) {
          click(button);
          return;
        }
      }
      throw new Error('Failed to find more actions menu');
    });
  }

  // TODO: Fix this
  // eslint-disable-next-line no-unused-vars
  async function openCurrentProjectLeftNavMenu() {
    if (leftNavIsHidden()) {
      toggleLeftNav();
    }
    const currentPath = document.location.pathname;
    const currentProject = getUnique(
        document, '#left-menu-projects-panel li', (project) => {
          const link = getUnique(project, 'a');
          // If a project doesn't have an anchor tag, it's hidden and
          // we want to skip it.
          return link !== null && link.href.endsWith(currentPath);
        });
    if (!currentProject) {
      throw new Error('Could not find current project.');
    }
    const projectButtons = selectAll(currentProject, 'button');
    let moreProjectActionsButton = null;
    switch (projectButtons.length) {
      case 1:
        moreProjectActionsButton = projectButtons[0];
        break;
      case 2:
        // If a project has two buttons, the first is the "toggle
        // collapse" button and the second is the "more actions"
        // button.
        moreProjectActionsButton = projectButtons[1];
        break;
      case 0:
        throw new Error(
            'Project element has no buttons (expected "more actions" button.');
      default:
        throw new Error(
            'Project element has more than two buttons, which is unexpected.');
    }
    click(moreProjectActionsButton);
    setTimeout(updateKeymap, 10);
  }

  // Switches to a navigation mode, where navigation targets are annotated
  // with letters to press to click.
  async function navigate() {
    withNavigationContainer((listHolder) => {
      openedLeftNavForNavigate = false;
      if (leftNavIsHidden()) {
        toggleLeftNav();
        openedLeftNavForNavigate = true;
      }
      // Since the projects list can get reconstructed, watch for changes and
      // reconstruct the shortcut tips.  A function to unregister the mutation
      // observer is passed in.
      oldNavigateOptions = [];
      const unregisterListener = registerMutationObserver(listHolder, () => {
        setupNavigate(listHolder);
      }, {childList: true, subtree: true});
      finishNavigate = () => {
        unregisterListener();
        finishNavigate = null;
        switchKeymap(DEFAULT_KEYMAP);
        updateKeymap();
        if (openedLeftNavForNavigate && !leftNavIsHidden()) {
          toggleLeftNav();
        }
      };
      setupNavigate(listHolder);
    });
  }

  function withNavigationContainer(f) {
    withUnique(document, '[role=navigation]', all, f);
  }

  // When viewing something other than a project, and the current task has a
  // project associated with it, jumps to the project and reselects the task.
  //
  // When viewing a project, and the current task has a time associated with
  // it that is within the next 7 days, then it jumps to "next 7 days" and
  // reselects the task.
  async function navigateToTask() {
    const cursor = requireCursor();
    const isFilterView = getIsFilterView();
    if (viewMode === 'project' && !isFilterView) {
      const dateSpan = getUnique(cursor, '.date');
      if (dateSpan) {
        withUnique(document, '#filter_upcoming a', all, (upcomingLink) => {
          // Set a variable that will be read by 'handlePageChange',
          // which will tell it to select this task.
          selectAfterNavigate = getTaskId(cursor);
          click(upcomingLink);
        });
      } else {
        info('Not switching to "Upcoming", because task is not scheduled.');
      }
    } else {
      const projectEl = getUnique(
          cursor,
          'a',
          (linkEl) => linkEl.href && linkEl.href.includes('/project/'));
      if (projectEl) {
        // Set a variable that will be read by 'handlePageChange', which will
        // tell it to select this task.
        selectAfterNavigate = getTaskId(cursor);
        debug('set selectAfterNavigate to', selectAfterNavigate);
        click(projectEl);
      } else {
        error('couldn\'t find project button');
      }
    }
  }

  // Navigate to left menu item based on ID (`today`, `upcoming`, etc).
  // eslint-disable-next-line no-unused-vars
  async function navigateToLeftMenuItem(itemId) {
    return () => {
      withLeftMenuItems((menuItems, current) => {
        for (const menuItem of menuItems) {
          if (menuItem.href.indexOf(itemId) > 0) {
            click(menuItem);
          }
        }
      });
    };
  }

  // Cycles down through menu items.
  async function nextLeftMenuItem() {
    withLeftMenuItems((menuItems, current) => {
      // If on the last item, or no item, select the first item.
      if (current >= menuItems.length - 1 || current < 0) {
        clickLeftMenuItem(menuItems, 0);
      // Otherwise, select the next item.
      } else {
        clickLeftMenuItem(menuItems, current + 1);
      }
    });
  }

  // Cycles up through top sections (inbox / today / next 7 days + favorites).
  async function prevLeftMenuItem() {
    withLeftMenuItems((menuItems, current) => {
      // If on the first item, or no item, select the last item.
      if (current <= 0) {
        clickLeftMenuItem(menuItems, menuItems.length - 1);
      // Otherwise, select the previous item.
      } else {
        clickLeftMenuItem(menuItems, current - 1);
      }
    });
  }

  // Run a function on the array of left menu items, along with the index of the
  // currently selected one, if any.
  function withLeftMenuItems(f) {
    withId('top-menu', (topItems) => {
      // The favorites panel only exists when there are favorites, and the
      // projects panel only when there are projects, so missing ones are
      // expected rather than a problem.
      const panels = [topItems];
      const panelIds =
            ['left-menu-favorites-panel', 'left-menu-projects-panel'];
      for (const id of panelIds) {
        const panel = getById(id);
        if (panel) {
          panels.push(panel);
        }
      }
      withLeftMenuItemLinks(panels, f);
    });
  }

  function withLeftMenuItemLinks(containers, f) {
    const links = [];
    // Indices of the items which link to the page being viewed. There can be
    // more than one, because a favorited project is listed in both the
    // favorites and the projects panel.
    const currents = [];
    for (const container of containers) {
      withAll(container, 'li', all, (item) => {
        const link =
              getFirst(item, '.item_content') ||
              getFirst(item, 'a') ||
              getFirst(item, '.name');
        // Items like the search box have no link, and collapsed projects hide
        // their children. Neither is worth warning about.
        if (hidden(item) || !link) {
          return;
        }
        links.push(link);
        if (isLinkToCurrentPage(getFirst(item, 'a'))) {
          currents.push(links.length - 1);
        }
      });
    }
    f(links, chooseCurrentLeftMenuItem(currents));
  }

  // Which of the items linking to the current page to navigate relative to.
  // Preferring the one navigated to last is what keeps navigation from
  // bouncing between a favorited project's two entries: without it, moving off
  // the projects entry would start over from the favorites entry.
  function chooseCurrentLeftMenuItem(currents) {
    if (!currents.length) {
      return -1;
    }
    if (currents.includes(lastLeftMenuIndex)) {
      return lastLeftMenuIndex;
    }
    return currents[0];
  }

  function isLinkToCurrentPage(link) {
    if (!link) {
      return false;
    }
    const href = link.getAttribute('href');
    if (!href) {
      return false;
    }
    // Comparing pathnames rather than hrefs, so that query strings and
    // fragments don't matter.
    return identifyPath(new URL(href, document.baseURI).pathname) ===
      identifyPath(window.location.pathname);
  }

  // Reduces a path to something comparable, by dropping the slug that Todoist
  // puts in front of a project / filter / label id. Sidebar links have the
  // slug ("/app/project/shopping-6X7yz"), but the same page navigated to
  // directly may not ("/app/project/6X7yz").
  function identifyPath(pathname) {
    const segments = pathname.split('/').filter((segment) => segment);
    const last = segments.pop() || '';
    const lastDash = last.lastIndexOf('-');
    segments.push(lastDash < 0 ? last : last.substring(lastDash + 1));
    return segments.join('/');
  }

  // Index into the left menu items of the one navigated to by the most recent
  // nextLeftMenuItem / prevLeftMenuItem. MUTABLE.
  let lastLeftMenuIndex = -1;

  // Note that this uses the element's own click method rather than the
  // synthetic click used elsewhere: sidebar items are draggable, and the
  // pointer events that come with a synthetic click start a drag.
  function clickLeftMenuItem(menuItems, index) {
    lastLeftMenuIndex = index;
    menuItems[index].click();
  }

  async function undo() {
    // Triggering keypress appears to be broken.
    // todoistShortcut({key: 'z'});
    withUnique(document, '[role=alert]', all, (alertContainer) => {
      const foundByText = getUnique(
          alertContainer, 'button', (el) => el.innerText === 'Undo');
      if (foundByText) {
        click(foundByText);
        return;
      }
      const foundByLackOfSvg = getUnique(
          alertContainer, 'button', (el) => el.querySelector('svg') == null);
      if (foundByLackOfSvg) {
        click(foundByLackOfSvg);
        return;
      }
      notifyUser('Didn\'t find undo button, undo only works popup is visible.');
    });
  }

  async function openNotifications() {
    clickUnique(document, 'a[aria-label="Notifications"]');
  }

  async function quickAdd() {
    withUnique(document, '.app-sidebar-container', all, (appSidebar) =>
      withUnique(
          appSidebar,
          'button',
          (button) => button.innerText.includes('Add task'),
          click),
    );
  }

  function leftNavIsHidden() {
    const appSidebar = getUnique(document, '.app-sidebar-container');
    if (appSidebar) {
      // TODO: Fix this on firefox - always fails.
      try {
        return appSidebar.computedStyleMap().get('margin-left').value != 0;
      } catch (e) {
        warn('Failed to check if left nav is open:', e);
        return false;
      }
    }
    warn('Couldn\'t figure out if left nav is open or not.');
    return false;
  }

  async function toggleLeftNav() {
    clickUnique(
        document,
        'button[aria-controls=sidebar], .top_bar_btn.left_menu_toggle');
  }

  async function focusSearch() {
    // TODO: does it work in other UI languages?
    clickUnique(document, 'nav *[aria-label=Search]');
  }

  // Open help documentation.
  async function openHelpModal() {
    let modal = getUnique(document, '.' + TODOIST_SHORTCUTS_HELP);
    if (modal === null) {
      createHelpModal();
      modal = getUnique(document, '.' + TODOIST_SHORTCUTS_HELP);
    }
    modal.style.display = 'inline-block';
  }

  // Create DOM nodes for help documentation.
  function createHelpModal() {
    // Create new help modal.
    const header = element(
        'h1', '',
        text('Keyboard shortcuts'),
    );
    const optionsLink = element(
        'a', '', text('Configure todoist-shortcuts options'),
    );
    const optionsUrl =
          document.body.getAttribute('data-todoist-shortcuts-options-url');
    optionsLink.setAttribute('href', optionsUrl);
    optionsLink.setAttribute('target', '_blank');
    const docsLink = element(
        'a', '',
        text('Full todoist-shortcuts documentation'),
    );
    docsLink.setAttribute(
        'href', TODOIST_SHORTCUTS_GITHUB + '/blob/master/readme.md');
    docsLink.setAttribute('target', '_blank');
    const originalLink = element(
        'a', '',
        text('Original Todoist keyboard shortcuts documentation'),
    );
    originalLink.setAttribute('href', 'https://get.todoist.help/hc/en-us/articles/205063212');
    originalLink.setAttribute('target', '_blank');
    const sheetsLink = element(
        'a', '',
        text('Printable shortcuts guide (displayed below)'),
    );
    sheetsLink.setAttribute('href', 'https://docs.google.com/spreadsheets/d/1AGh85HlDze19bWpCa2OTErv9xc7grmMOMRV9S2OS7Xk');
    sheetsLink.setAttribute('target', '_blank');
    const linksList = element(
        'ul', '',
        element('li', '', optionsLink),
        element('li', '', docsLink),
        element('li', '', originalLink),
        element('li', '', sheetsLink),
    );
    const iframe = element('iframe');
    iframe.setAttribute('src', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ5jkiI07g9XoeORQrOQUlAwY4uqJkBDkm-zMUK4WuaFvca0BJ0wPKEM5dw6RgKtcSN33PsZPKiN4G4/pubhtml?gid=0&amp;single=true&amp;widget=true&amp;headers=false');
    iframe.setAttribute('scrolling', 'no');
    const container = div(TODOIST_SHORTCUTS_HELP_CONTAINER, linksList, iframe);
    const modal = createModal(div('', header, container));
    modal.classList.add(TODOIST_SHORTCUTS_HELP);
    modal.style.display = 'none';
  }

  // Click "import from template" in project menu
  // eslint-disable-next-line no-unused-vars
  async function importFromTemplate() {
    withAll(document, '.menu_item', all, (tr) => {
      const predicate =
            matchingAttr('data-track', 'project|actions_import_from_template');
      withUnique(tr, 'td', predicate, (foundItem) => {
        click(foundItem);
        let foundInput = null;
        withAll(document, '.file_input_container', all, (container) => {
          withAll(container, 'input', all, (input) => {
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

  async function sync() {
    let lastSynced = getById('last_synced');
    if (!lastSynced) {
      withId('help_btn', click);
      lastSynced = getById('last_synced');
    }
    const priorElement = lastSynced.previousElementSibling;
    const tag = priorElement.tagName.toLowerCase();
    if (tag !== 'button') {
      error('Expected element to be sync button, but instead it is ' + tag);
      return;
    }
    click(priorElement);
  }

  const COMMAND_MENU_SELECTOR =
        'button[aria-labelledby="command-menu-description"]';

  async function openCommandMenu() {
    const button = getUnique(document, COMMAND_MENU_SELECTOR);
    if (button) {
      click(button);
    } else {
      withId('help_btn', click);
      clickUnique(document, COMMAND_MENU_SELECTOR);
    }
  }

  const TASK_VIEW_SELECTOR = 'div[data-testid="task-details-modal"]';

  async function taskViewEdit() {
    clickUnique(document, '.task-detail-editor-container .task_content');
  }

  async function taskViewDone() {
    clickUnique(document, '[data-action-hint=task-detail-view-complete]');
  }

  async function taskViewClose() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'button[aria-label="Close task"]');
    });
  }

  async function taskViewParent() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'div[data-testid="task-detail-breadcrumbs"] > a');
    });
  }

  async function taskViewNext() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, '[aria-label="Next task"');
    });
  }

  async function taskViewComments() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'button[data-testid="open-comment-editor-button"]');
    });
  }

  async function taskViewPrevious() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, '[aria-label="Previous task"');
    });
  }

  async function taskViewAddSubtask() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'button', matchingText('Add sub-task'));
    });
  }

  async function taskViewSchedule() {
    taskViewScheduleText();
    await blurSchedulerInput();
  }

  async function taskViewScheduleText() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, '.task-due-date-button');
    });
  }

  async function taskViewOpenAssign() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'span', matchingText('Assignee'));
    });
  }

  async function taskViewMoveToProject() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'button[aria-label="Select a project"]');
    });
  }

  async function taskViewLabel() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'span', matchingText('Labels'));
    });
  }

  function taskViewSetPriority(level) {
    return async () => {
      const actualLevel = invertPriorityLevel(level);
      // The picker is opened by clicking the priority button, but it only
      // appears asynchronously, so the click on the level needs to retry.
      if (!getUnique(document, '.priority_picker')) {
        withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
          clickUnique(taskView, '[data-icon-name=priority-icon]');
        });
      }
      const picker = await getUniqueRetrying(document, '.priority_picker');
      await clickPriorityMenu(picker, actualLevel);
    };
  }

  async function taskViewOpenReminders() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, 'span', matchingText('Reminders'));
    });
  }

  async function taskViewDelete() {
    withTaskViewMoreMenu((menu) => {
      clickUnique(menu, 'kbd', matchingText('Delete'));
    });
  }

  async function taskViewToggleTimer() {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      clickUnique(taskView, TIMER_QUERY);
    });
  }

  // eslint-disable-next-line no-unused-vars
  async function taskViewActivity() {
    withTaskViewMoreMenu((menu) => {
      clickUnique(menu, 'div', matchingText('View task activity'));
    });
  }

  function withTaskViewMoreMenu(f) {
    withUnique(document, TASK_VIEW_SELECTOR, all, (taskView) => {
      let overflowMenu = getTaskViewMoreMenu();
      if (!overflowMenu) {
        clickUniqueRetrying(taskView, 'button[aria-label="More actions"]');
        overflowMenu = getTaskViewMoreMenu();
      }
      if (overflowMenu) {
        f(overflowMenu);
      } else {
        warn('Couldn\'t find overflow menu.');
      }
    });
  }

  function getTaskViewMoreMenu() {
    return getUniqueRetrying(
        document, 'div.reactist_menulist[aria-label="More actions"]');
  }

  async function copyCursorOrSelectedUrls() {
    setClipboard(selectedTasksOrCursorToText(getTaskUrl));
  }

  async function copyCursorOrSelectedTitles() {
    setClipboard(selectedTasksOrCursorToText(getTaskTitle));
  }

  async function copyCursorOrSelectedAsMarkdown() {
    setClipboard(selectedTasksOrCursorToText(getTaskMarkdown, '* '));
  }

  async function openRandomTask() {
    const tasks = getTasks();
    setCursor(tasks[Math.floor(Math.random()*tasks.length)], 'scroll');
    openTaskView();
  }

  async function nextMenuListItem() {
    withCurrentFocusedMenuListItem((focusedItem) => {
      let item = focusedItem;
      do {
        item = item.nextElementSibling;
      } while (item && !item.classList.contains('menu_item'));
      if (!item) {
        item = focusedItem.parentElement.firstElementChild;
      }
      item.focus();
    });
  }

  async function prevMenuListItem() {
    withCurrentFocusedMenuListItem((focusedItem) => {
      let item = focusedItem;
      do {
        item = item.previousElementSibling;
      } while (item && !item.classList.contains('menu_item'));
      if (!item) {
        item = focusedItem.parentElement.lastElementChild;
      }
      item.focus();
    });
  }

  async function selectMenuListItem() {
    withCurrentFocusedMenuListItem(click);
  }

  function notifyBulkActionsRemoved() {
    notifyUser('Bulk move (* v) and bulk reschedule (* t) shortcuts were ' +
               'removed as they had stopped working and were not ' +
               'straightforward to fix.');
  }

  async function noop() {}

  /*****************************************************************************
   * Utilities for manipulating the UI
   */

  function getViewContent() {
    return getUnique(document, '#content');
  }

  function withViewContent(f) {
    return withUnique(document, '#content', all, f);
  }

  async function toggleSelectTask(task) {
    const selectedTasks = getTasks().filter(checkTaskIsSelected);
    if (selectedTasks.length > 0) {
      deselectAllTasks();
      await sleep(0);
      let wasAlreadySelected = false;
      for (const selectedTask of selectedTasks) {
        if (selectedTask === task) {
          wasAlreadySelected = true;
          continue;
        }
        controlClickTask(selectedTask);
      }
      if (wasAlreadySelected) {
        return;
      }
    }
    controlClickTask(task);
  }

  function controlClickTask(task) {
    // Control click toggles selection state.
    //
    // Unfortunately wacky todoist bugs makes this clear existing selections etc
    // for inscrutable reasons..
    const e = new MouseEvent(
        'click',
        {bubbles: true, ctrlKey: true, metaKey: true});
    withUnique(task, '.task_content', all, (content) => {
      content.dispatchEvent(e);
    });
  }

  function selectTask(task) {
    if (!checkTaskIsSelected(task)) {
      toggleSelectTask(task);
    }
  }

  function deselectTask(task) {
    if (checkTaskIsSelected(task)) {
      toggleSelectTask(task);
    }
  }

  // Ensures that the specified task ids are selected (specified by a set-like
  // object).
  async function setSelections(selections) {
    deselectAllTasks();
    await sleep(0);
    for (const key in selections) {
      const task = getTaskByKey(key);
      if (task) {
        controlClickTask(task);
      }
    }

    /* Old definition before hacks to fix Todoist behavioral regressions (#281)

    const allTasks = getTasks('include-collapsed');
    for (const task of allTasks) {
      const key = getTaskKey(task);
      setTimeout(() => {
        if (selections[key]) {
          selectTask(task);
        } else {
          deselectTask(task);
        }
      });
    }
    */
  }

  function getSelectedTasksOrCursor() {
    const selectedTasks = getTasks().filter(checkTaskIsSelected);
    if (!selectedTasks.length) {
      const cursor = getCursor();
      return [cursor];
    }
    return selectedTasks;
  }

  // Valid values for lastCursorType:

  // Normal cursor position
  const TYPE_NORMAL = 'normal';
  // Cursor based on editing initiated by todoist-shortcuts.
  const TYPE_EXPLICIT_EDITING = 'explicit-editing';
  // Cursor based on inferred editing. Stored task precedes the editor.
  const TYPE_IMPLICIT_EDITING = 'implicit-editing';

  // All MUTABLE. Only mutated by 'storeCursorContext'.
  let lastCursorTasks = [];
  let lastCursorIndex = -1;
  let lastCursorId = null;
  let lastCursorIndent = null;
  let lastCursorSection = null;
  let lastCursorType = TYPE_NORMAL;
  let mouseGotMoved = false;
  let windowRecentlyFocused = false;
  let focusTimeout = null;

  function storeCursorContext(cursor, tasks, index, type) {
    lastCursorTasks = tasks;
    lastCursorIndex = index;
    lastCursorId = getTaskId(cursor);
    lastCursorIndent = getIndentClass(cursor);
    lastCursorSection = getSectionName(cursor);
    lastCursorType = type;
    mouseGotMoved = false;
    debugCursorContext('wrote down cursor context:');
  }

  function debugCursorContext(prefix) {
    debug(
        prefix,
        'id =', lastCursorId,
        'indent =', lastCursorIndent,
        'section =', lastCursorSection,
        'idx =', lastCursorIndex,
        'type =', lastCursorType,
        'mouseGotMoved =', mouseGotMoved);
  }

  function storeNormalContext(cursor) {
    const tasks = getTasks();
    const index = tasks.indexOf(cursor);
    if (index < 0) {
      clearEditingContext(tasks);
    } else {
      storeCursorContext(cursor, tasks, index, TYPE_NORMAL);
    }
  }

  function storeImplicitEditingContext(cursor, index) {
    // Do not overwrite an explicitly stored cursor position.
    if (lastCursorType !== TYPE_EXPLICIT_EDITING) {
      storeCursorContext(cursor, getTasks(), index, TYPE_IMPLICIT_EDITING);
    }
  }

  function storeExplicitEditingContext(cursor) {
    const tasks = getTasks();
    const index = tasks.indexOf(cursor);
    if (index < 0) {
      clearEditingContext(tasks);
    } else {
      storeCursorContext(cursor, tasks, index, TYPE_EXPLICIT_EDITING);
    }
  }

  function clearEditingContext(tasks) {
    lastCursorTasks = tasks;
    lastCursorIndex = -1;
    lastCursorId = null;
    lastCursorIndent = null;
    lastCursorSection = null;
    lastCursorType = TYPE_NORMAL;
    debugCursorContext('Cleared cursor context');
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
    if (!ev.isTrusted) {
      // Synthetic mouse move events are generated when dragging
      // tasks.
      debug('handleMouseOver ignoring synthetic mouse hover event.');
      return;
    }
    try {
      const predicate = matchingClass('task_list_item');
      const hoveredTask = findParent(ev.target, predicate);
      if (mouseGotMoved && hoveredTask) {
        const mouseBehavior = getMouseBehaviorOption();
        switch (mouseBehavior) {
          case 'focus-follows-mouse':
            break;
          case 'focus-follows-mouse-delay-after-window-focus':
            if (windowRecentlyFocused) {
              debug('Not setting cursor on mouse move, ',
                  'because window was recently focused.');
              return;
            }
            break;
          case 'no-mouse-behavior':
            debug('Not setting cursor on mouse move (disabled in settings).');
            return;
          default:
            warn('Unrecognized mouse behavior option: ', mouseBehavior);
            break;
        }
        debug('Due to mouse hover, setting cursor');
        setCursor(hoveredTask, 'no-scroll');
      }
    } finally {
      mouseGotMoved = false;
    }
  }

  function handleWindowFocus() {
    debug('FOCUS EVENT');
    if (focusTimeout) {
      clearTimeout(focusTimeout);
    }
    windowRecentlyFocused = true;
    focusTimeout = setTimeout(() => {
      windowRecentlyFocused = false;
    }, 500);
  }

  // If the cursor exists, set 'lastCursorTasks' / 'lastCursorIndex'. If it
  // doesn't exist, then use previously stored info to place it after its prior
  // location.
  function ensureCursor(content) {
    content = content || getViewContent();
    // If there's an editor open to add a task, then set the cursor to the item
    // above.
    const manager = getUnique(content, '.manager');
    if (manager) {
      const tasks = getTasks('no-collapsed', 'include-editors');
      const managerIndex =
            tasks.findIndex((task) => task.classList.contains('manager'));
      debug('there is an active editor, with index', managerIndex);
      if (managerIndex > 0) {
        // The index is the same in the list without editors, since the editor
        // follows the task being stored.
        storeImplicitEditingContext(tasks[managerIndex - 1], managerIndex - 1);
      } else if (managerIndex < 0) {
        error('There seems to be a task editor, but then couldn\'t find it.');
      }
      return;
    }
    debug('Checking if cursor still exists:', lastCursorId, lastCursorIndent);
    const cursor = getCursor();
    // Detect if the cursor has changed section. This can happen when the user
    // re-schedules it or moves it to a different project. I find it nicer if
    // the cursor doesn't follow the task for these moves, hence this logic.
    let changedSection = false;
    let currentSection = null;
    const cursorMovement = getCursorMovementOption();
    if (cursor &&
        cursorMovement === 'follows-task-within-section' &&
        lastCursorType === TYPE_NORMAL) {
      const cursorId = getTaskId(cursor);
      const cursorIndent = getIndentClass(cursor);
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
      if (lastCursorType !== TYPE_NORMAL) {
        // This invocation is to handle the circumstance where the user inserts
        // a task, moving the task list. The task under the mouse then gets
        // hovered, even if the mouse wasn't moved, which erroneously changes
        // the cursor.
        debug(
            'Was just editing, and mouse didn\'t move,',
            'so restoring the cursor to last position.');
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
    debugCursorContext('restoring last cursor based on context:');
    let found = false;
    let tasks = null;
    if (lastCursorIndex >= 0) {
      if (lastCursorType === TYPE_IMPLICIT_EDITING) {
        const taskPrecedingEditor =
            getTaskById(lastCursorId, 'ignore-indent', lastCursorSection);
        if (taskPrecedingEditor) {
          tasks = getTasks();
          for (let i = 0; i < tasks.length; i++) {
            if (tasks[i] === taskPrecedingEditor && i + 1 < tasks.length) {
              found = restoreCursor(tasks[i + 1], 'no-scroll');
              if (found) {
                debug('found task after task that preceded the editor.');
              }
              break;
            }
          }
          if (!found) {
            found = restoreCursor(taskPrecedingEditor, 'no-scroll');
            if (found) {
              debug('falling back on selecting task that preceded editor.');
            }
          }
        } else {
          // Todoist replaces the task's element when the edit is saved, so it
          // can be absent while the list re-renders. Falling back on the
          // index below lands in the same place.
          debug('task that preceded the editor is gone, using its index.');
        }
      } else if (lastCursorType === TYPE_EXPLICIT_EDITING) {
        const task =
            getTaskById(lastCursorId, 'ignore-indent', lastCursorSection);
        if (task) {
          found = restoreCursor(task, 'scroll');
          if (found) {
            debug('found task that was being explicitly edited.');
          }
        }
      } else if (lastCursorType == TYPE_NORMAL) {
        for (let i = lastCursorIndex; i < lastCursorTasks.length; i++) {
          const oldTask = lastCursorTasks[i];
          if (oldTask) {
            const oldTaskId = getTaskId(oldTask);
            task = getTaskById(oldTaskId, 'ignore-indent' );
            if (task) {
              if (i !== lastCursorIndex) {
                found = restoreCursor(task, 'no-scroll');
                if (found) {
                  debug(
                      'found still-existing task that is',
                      i - lastCursorIndex,
                      'tasks after old cursor position, at',
                      lastCursorIndex,
                      ', set cursor to it');
                }
                break;
              } else {
                debug('cursor changed section, finding new location');
              }
            }
          }
        }
      } else {
        error('Invalid value for lastCursorType: ', lastCursorType);
      }
    } else {
      debug('lastCursorIndex wasn\'t set yet');
    }
    if (!found) {
      debug('didn\'t find a particular task to select, so selecting by index.');
      restoreCursorViaIndex(tasks);
    }
  }

  function restoreCursorViaIndex(tasks) {
    if (!tasks) {
      tasks = getTasks();
    }

    // Attempt to adjust index if cursored task is now earlier in the list.
    let indexBasedOnLastCursor = lastCursorIndex;
    const foundLastTaskEl =
          getTaskById(lastCursorId, 'ignore-indent', lastCursorSection);
    const foundLastTaskIndex = tasks.indexOf(foundLastTaskEl);
    if (foundLastTaskIndex !== -1 &&
        foundLastTaskIndex < indexBasedOnLastCursor) {
      indexBasedOnLastCursor += 1;
    }

    if (0 <= indexBasedOnLastCursor && indexBasedOnLastCursor < tasks.length) {
      debug('cursoring to index', indexBasedOnLastCursor);
      setCursor(tasks[indexBasedOnLastCursor], 'no-scroll');
    } else if (lastCursorIndex < tasks.length - lastCursorIndex) {
      debug('cursoring first task, because it\'s nearer to lastCursorIndex.');
      setCursorToFirstTask('no-scroll');
    } else {
      debug('cursoring last task, because it\'s nearer to lastCursorIndex.');
      setCursorToLastTask('no-scroll');
      if (!getCursor()) {
        // This can happen if the last task is a nested sub-project.
        debug('failed to set the cursor to last task, so setting to first');
        setCursorToFirstTask('no-scroll');
      }
    }
  }

  function restoreCursor(task, scroll) {
    // Don't jump back to the same task if it changed section and
    // cursor movement setting does not follow across sections
    const taskSection = getSectionName(task);
    const cursorMovement = getCursorMovementOption();
    const changedSection =
        cursorMovement === 'follows-task-within-section' &&
        lastCursorSection !== taskSection;
    if (!changedSection) {
      setCursor(task, scroll);
      return true;
    }
    return false;
  }

  // Gets the name of the section that a task is in.
  function getSectionName(task) {
    const section = getSection(task);
    if (!section) {
      error('Failed to find section div for', task);
    } else if ('aria-label' in section.attributes) {
      return section.attributes['aria-label'].value;
    } else {
      error('Section', section, 'lacks an aria-label attribute');
    }
    return '';
  }

  function getSection(task) {
    return findParent(task, matchingTag('section'));
  }

  function getFirstTaskIn(section) {
    return getFirst(
        section,
        '.task_list_item',
        not(matchingClass('reorder_item')),
    );
  }

  function getLastTaskInSection(section) {
    return getLast(
        section,
        '.task_list_item',
        not(matchingClass('reorder_item')),
    );
  }

  // MUTABLE. Stores the last page path, to detect page changes.
  let lastPath = null;

  // MUTABLE. If set, then the specified task ID will be selected after
  // navigation.
  let selectAfterNavigate = null;

  function handlePageChange() {
    debug('handling page change');
    updateKeymap();
    updateViewMode();
    const currentPath = document.location.pathname;
    isTaskViewPath = currentPath.includes('/task/');
    if (lastPath !== currentPath && !isTaskViewPath) {
      lastPath = currentPath;
      debug('Setting cursor to first task after navigation');
      if (selectAfterNavigate) {
        const newEl = getTaskById(selectAfterNavigate, 'ignore-indent');
        debug('Initial attempt to select', selectAfterNavigate,
            'yielded', newEl);
        if (newEl) {
          setCursor(newEl, 'scroll');
        } else {
          const taskId = selectAfterNavigate;
          setTimeout(() => {
            persistentlySelectAfterNavigate(taskId, 100);
          }, 10);
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

  function persistentlySelectAfterNavigate(taskId, retriesLeft) {
    const taskEl = getTaskById(taskId, 'ignore-indent');
    debug('Retry attempt to select', taskId,
        'yielded', taskEl, '. ',
        retriesLeft, ' retries left.');
    if (taskEl) {
      setCursor(taskEl, 'scroll');
    } else if (retriesLeft > 1) {
      setTimeout(() => {
        persistentlySelectAfterNavigate(taskId, retriesLeft - 1);
      }, 10);
    } else {
      warn('Giving up on finding task to select.');
    }
  }

  // Registers mutation observers on elements that never get removed from the
  // DOM.  Run on initialization of todoist-shortcuts.
  function registerTopMutationObservers(content) {
    registerMutationObserver(content, handlePageChange);
    registerMutationObserver(document, (mutations) => {
      // Not sure how to do this at intelligent times. Instead doing
      // it all the time.
      //
      // TODO: remove this once unnecessary.
      if (!initializing) {
        updateViewMode();
      }
      if (dragInProgress) {
        debug('ignoring mutations since drag is in progress:', mutations);
        return;
      }
      if (checkDragSettling()) {
        debug('ignoring mutations while task list settles after drag');
        return;
      }
      // Ignore mutations from toggl-button extension
      const filtered = mutations.filter((mutation) => {
        if (mutation.target.classList.contains('toggl-button')) {
          return false;
        }
        if (mutation.addedNodes.length === 0 &&
            mutation.removedNodes.length === 1 &&
            mutation.removedNodes[0].classList &&
            mutation.removedNodes[0].classList.contains('item_dnd_handle')) {
          return false;
        }
        if (mutation.addedNodes.length === 1 &&
            mutation.removedNodes.length === 0 &&
            mutation.addedNodes[0].classList &&
            mutation.addedNodes[0].classList.contains('item_dnd_handle')) {
          return false;
        }
        return true;
      });
      if (filtered.length > 0) {
        debug('ensuring cursor + updating keymap due to mutations:', mutations);
        ensureCursor(content);
        updateKeymap();
      }
    }, {childList: true, subtree: true});
  }

  function updateKeymap() {
    if (mousetrap) {
      // Navigation mode manages switching away from NAVIGATE_KEYMAP.
      if (currentKeymap === NAVIGATE_KEYMAP) {
        return;
      }
      if (getCurrentFocusedMenuListItem()) {
        switchKeymap(MENU_LIST_KEYMAP);
        return;
      }
      if (checkSchedulerOpen()) {
        switchKeymap(SCHEDULE_KEYMAP);
        return;
      }
      if (checkTaskViewOpen()) {
        switchKeymap(TASK_VIEW_KEYMAP);
        return;
      }
      const popupWindow =
            getUnique(document, '.GB_window') ||
            getUnique(document, '[data-testid="modal-overlay"]') ||
            // Search dropdown
            getUnique(document, '#quick_find > [role="presentation"]');
      if (popupWindow) {
        switchKeymap(POPUP_KEYMAP);
        return;
      }
      switchKeymap(DEFAULT_KEYMAP);
    }
  }

  // MUTABLE. Currently set mousetrap keymap.
  let currentKeymap = DEFAULT_KEYMAP;

  function switchKeymap(keymap) {
    if (currentKeymap !== keymap) {
      debug('Setting keymap to', keymap);
      mousetrap.switchKeymap(keymap);
      currentKeymap = keymap;
    }
  }

  function checkTaskViewOpen() {
    return getUnique(document, 'div[data-item-detail-root]') !== null;
  }

  // Registers a mutation observer that just observes modifications to its
  // child list.
  function registerMutationObserver(el, f, optionalOpts) {
    const opts = optionalOpts ? optionalOpts : {childList: true};
    const observer = new MutationObserver(f);
    observer.observe(el, opts);
    return onDisable(() => {
      observer.disconnect();
    });
  }

  // For some reason todoist clears the selections even after applying things
  // like priority changes. This restores the selections.
  //
  // eslint-disable-next-line no-unused-vars
  async function withRestoredSelections(f) {
    const oldSelections = getSelectedTaskKeys();
    try {
      f();
    } finally {
      await setSelections(oldSelections);
    }
  }

  function openMoreMenu() {
    clickUnique(
        document,
        'button',
        matchingAction('multi-select-toolbar-overflow-menu-trigger'));
    const result = getUnique(document, '.reactist_menulist[data-dialog]');
    if (!result) {
      throw new Error('Failed to find "More" menu');
    }
    return result;
  }

  // Returns true if the task has children and is collapsed.
  function checkTaskCollapsed(task) {
    return getUnique(task, '.right');
  }

  // Returns true if the task has children and is expanded.
  function checkTaskExpanded(task) {
    return getUnique(task, '.down');
  }

  // Click elements within the content which match the specified query.
  // Persistently clicks until the class can no longer be found. Used to
  // collapse / expand all items.
  function repeatedlyClickArrows(query) {
    withViewContent((content) => {
      let i = 0;
      let clickedSomething = false;
      const doClick = (el) => {
        click(el);
        clickedSomething = true;
      };
      let inner = null;
      inner = () => {
        clickedSomething = false;
        withAll(content, query, all, doClick);
        if (!clickedSomething) {
          return;
        }
        if (i < 5) {
          i++;
          setTimeout(inner);
        } else {
          warn('Iteratively clicked arrows but they didn\'t all toggle');
        }
      };
      inner();
    });
  }

  // Opens up the task's contextual menu and clicks an item via text match.
  async function clickTaskMenu(task, action, shouldScroll) {
    await withTaskMenuOpen(task, shouldScroll, async () => {
      const element = await getUniqueRetrying(
          document, '[data-action-hint="' + action + '"]');
      click(element);
    });
  }

  async function withTaskMenuOpen(task, shouldScroll, f) {
    if (shouldScroll) {
      await withTaskMenuOpenImpl(task, f);
    } else {
      await new Promise((resolve) => {
        withScrollIgnoredFor(400, async () => {
          await withTaskMenuOpenImpl(task, f);
          resolve();
        });
      });
    }
  }

  async function withTaskMenuOpenImpl(task, f) {
    await withTaskHovered(task, async () => {
      const query = 'button[data-action-hint="task-overflow-menu"]';
      const openMenu = await getUniqueRetrying(task, query);
      click(openMenu);
      await f();
    });
  }

  function checkSchedulerOpen() {
    return findScheduler() !== null;
  }

  function findScheduler() {
    return getUnique(document, '.scheduler');
  }

  function withScheduler(name, f) {
    const scheduler = findScheduler();
    if (scheduler) {
      f(scheduler);
    } else {
      warn('Not performing action', name, 'because scheduler is not open');
    }
  }

  // Simulate a key press with todoist's global handlers.
  // eslint-disable-next-line no-unused-vars
  function todoistShortcut(options0) {
    const options = typeof options0 === 'string' ? {key: options0} : options0;
    let ev = new Event('keydown');
    for (const o in options) {
      ev[o] = options[o];
    }
    if (window.originalTodoistKeydown) {
      window.originalTodoistKeydown.apply(document, [ev]);
    }
    ev = new Event('keyup');
    for (o in options) {
      ev[o] = options[o];
    }
    if (window.originalTodoistKeyup) {
      window.originalTodoistKeyup.apply(document, [ev]);
    }
    ev = new Event('keypress');
    for (o in options) {
      ev[o] = options[o];
    }
    if (window.originalTodoistKeypress) {
      window.originalTodoistKeypress.apply(document, [ev]);
    }
  }

  // Indent task.
  async function moveIn() {
    if (viewMode === 'agenda') {
      info('Indenting task does not work in agenda mode.');
    } else if (viewMode === 'project') {
      const cursor = requireCursor();
      await dragTaskOver(cursor, () => ({
        destination: cursor,
        indentDelta: 35,
      }));
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Dedent task.
  async function moveOut() {
    if (viewMode === 'agenda') {
      info('Dedenting task does not work in agenda mode.');
    } else if (viewMode === 'project') {
      const cursor = requireCursor();
      if (getIndentClass(cursor) === 'indent_1') {
        // See https://github.com/mgsloan/todoist-shortcuts/issues/39
        info('Task is already at indent level 1, so not dedenting');
      } else {
        await dragTaskOver(cursor, () => ({
          destination: cursor,
          indentDelta: -35,
        }));
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Move task up, maintaining its indent level and not swizzling any nested
  // structures.
  async function moveUp() {
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else {
      const cursor = requireCursor();
      if (getSectionName(cursor) === 'Overdue') {
        info('Can\'t move cursor up in overdue section');
        return;
      }
      // Collapse nested tasks before moving it - see
      // https://github.com/mgsloan/todoist-shortcuts/issues/29#issuecomment-426121307
      collapse(cursor);
      await dragTaskOver(cursor, () => {
        const tasks =
              getTasks('no-collapsed', 'no-editors', 'include-sections');
        const cursorIndex = tasks.indexOf(cursor);
        const cursorIndent = getIndentClass(cursor);
        for (let i = cursorIndex - 1; i >= 0; i--) {
          const task = tasks[i];
          const indent = getIndentClass(task);
          if (indent === cursorIndent ||
              (isSectionLi(task) && i != cursorIndex - 1)) {
            debug('moveUp target is', task);
            // Less glitchy if destination is collapsed
            collapse(task);
            return {
              destination: task,
              horizontalOffset: 0,
              dropPosition: isSectionLi(task) ? 'after-section' : 'before',
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
  }

  // Move task down, maintaining its indent level and not swizzling any nested
  // structures.
  async function moveDown() {
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else {
      const cursor = requireCursor();
      if (getSectionName(cursor) === 'Overdue') {
        info('Can\'t move cursor down in overdue section');
        return;
      }
      // Collapse nested tasks before moving it - see
      // https://github.com/mgsloan/todoist-shortcuts/issues/29#issuecomment-426121307
      collapse(cursor);
      await dragTaskOver(cursor, () => {
        const tasks =
              getTasks('no-collapsed', 'no-editors', 'include-sections');
        const cursorIndex = tasks.indexOf(cursor);
        const cursorIndent = getIndentClass(cursor);
        let lastQualifyingTask = null;
        for (let i = cursorIndex + 1; i < tasks.length; i++) {
          const task = tasks[i];
          const indent = getIndentClass(task);
          // Logic here is a bit tricky.  The first time we encounter a task
          // at the same indent level, this is the subtree we want to move
          // past.  So, set lastQualifyingTask to non-null and keep track of
          // the last one.  After that, when we encounter something at a
          // lesser or equal indent to cursorIndent, we want to place it after
          // the last one.
          if (isSectionLi(task)) {
            if (!lastQualifyingTask) {
              lastQualifyingTask = task;
            }
            break;
          } else if (!lastQualifyingTask) {
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
        debug('moveDown target is', lastQualifyingTask);
        if (lastQualifyingTask) {
          // Less glitchy if destination is collapsed
          collapse(lastQualifyingTask);
          return {
            destination: lastQualifyingTask,
            horizontalOffset: 0,
            dropPosition: isSectionLi(lastQualifyingTask) ?
              'after-section' : 'after',
          };
        } else {
          info('Couldn\'t find task below cursor to move it below.');
          return null;
        }
      });
    }
  }

  let timeToRestoreScroll = null;
  let scrollTimeoutCount = 0;

  function withScrollIgnoredFor(millis, f) {
    try {
      ignoreScroll();
      f();
    } finally {
      const restoreTime = new Date((new Date()).getTime() + millis);
      if (timeToRestoreScroll === null || restoreTime > timeToRestoreScroll) {
        timeToRestoreScroll = restoreTime;
      }
      scrollTimeoutCount += 1;
      setTimeout(scrollTimeoutHandler, millis);
    }
  }

  function scrollTimeoutHandler() {
    scrollTimeoutCount -= 1;
    const now = new Date();
    if (timeToRestoreScroll === null || now > timeToRestoreScroll) {
      restoreScroll();
    } else if (scrollTimeoutCount === 0) {
      debug('trying again');
      scrollTimeoutCount += 1;
      setTimeout(scrollTimeoutHandler, 50);
    }
  }

  function ignoreScroll() {
    debug('ignoring scroll');
    window.scroll = (...args) => {
      debug('Ignored Todoist scroll:', args);
    };
    window.scrollBy = (...args) => {
      debug('Ignored Todoist scrollBy:', args);
    };
    window.scrollTo = (...args) => {
      debug('Ignored Todoist scrollTo:', args);
    };
  }

  function restoreScroll() {
    debug('restoring scroll');
    window.scroll = window.originalTodoistScroll;
    window.scrollBy = window.originalTodoistScrollBy;
    window.scrollTo = window.originalTodoistScrollTo;
  }

  let dragInProgress = false;
  let suppressDrag = false;

  // Todoist now lazily renders the drag handle, so we try a few selectors
  // after forcing the task row into its hovered state.
  const DRAG_HANDLE_SELECTORS = [
    '.item_dnd_handle',
    '[data-testid="task-drag-handle"]',
    '.drag_and_drop_handle',
    'button.task_list_item__drag_handle',
    'span.drag_and_drop_handler',
    '[aria-label="Drag"]',
    '[aria-roledescription="sortable"]',
  ];

  function dragStart() {
    dragInProgress = true;
    suppressDrag = true;
    ignoreScroll();
  }

  function dragDone(task) {
    dragInProgress = false;
    // Suppress subsequent drags for 50ms, otherwise glitches occur.
    setTimeout(() => {
      suppressDrag = false;
    }, 0);
    restoreScroll();
    // Don't reconcile the cursor yet - the task list is still changing.
    startDragSettling();
    if (!task || task.classList.contains('on_drag')) {
      warn('didn\'t find spot to drop for drag and drop, so cancelling');
      closeContextMenus();
    }
  }

  // Todoist applies a drop asynchronously, re-rendering the task list a few
  // times as the change is applied and synced. While that happens the dragged
  // task's element is briefly absent from the list, which looks to
  // 'ensureCursor' like the task was deleted - it then moves the cursor to the
  // task which took its place. So instead of reconciling the cursor at mouseup,
  // wait for the task list to stop changing, and reconcile once. See #248.
  const DRAG_SETTLE_QUIET_MILLIS = 150;
  const DRAG_SETTLE_MAX_MILLIS = 1500;

  // MUTABLE. Non-null while waiting for the task list to settle after a drag.
  let dragSettleTimeout = null;
  let dragSettleDeadline = 0;

  function startDragSettling() {
    dragSettleDeadline = Date.now() + DRAG_SETTLE_MAX_MILLIS;
    deferDragSettled();
  }

  function deferDragSettled() {
    if (dragSettleTimeout !== null) {
      clearTimeout(dragSettleTimeout);
    }
    dragSettleTimeout = setTimeout(dragSettled, DRAG_SETTLE_QUIET_MILLIS);
  }

  function dragSettled() {
    dragSettleTimeout = null;
    if (dragInProgress) {
      // Another drag started while waiting - it will start the wait again when
      // it finishes.
      debug('not reconciling cursor yet, another drag is in progress');
      return;
    }
    debug('task list settled after drag, so reconciling cursor');
    ensureCursor();
    const cursor = getCursor();
    if (cursor) {
      scrollTaskIntoView(cursor);
    }
    updateCursorStyle();
    updateKeymap();
  }

  // Returns true if mutations should be ignored because the task list is still
  // settling after a drag. Every mutation postpones the reconciliation, up
  // until a deadline, so that a page which never stops changing can't stop the
  // cursor from being updated entirely.
  function checkDragSettling() {
    if (dragSettleTimeout === null) {
      return false;
    }
    if (Date.now() > dragSettleDeadline) {
      debug('task list still changing after drag, so no longer waiting');
      clearTimeout(dragSettleTimeout);
      dragSettled();
      return false;
    }
    deferDragSettled();
    return true;
  }

  function getTaskDropPointY(task, dropPosition) {
    const bounds = task.getBoundingClientRect();
    const centerY = bounds.y + bounds.height / 2;
    const overshoot = Math.max(4, Math.min(12, bounds.height * 0.2));

    if (dropPosition === 'before') {
      return centerY - overshoot;
    } else if (dropPosition === 'after') {
      return centerY + overshoot;
    } else if (dropPosition === 'after-section') {
      return bounds.bottom + 8;
    }

    return centerY;
  }

  async function dragTaskOver(sourceTask, findDestination) {
    if (suppressDrag) {
      info('Not executing drag because one already happened quite recently.');
    } else {
      try {
        dragStart();
        const result = findDestination();
        await withDragHandle(sourceTask, async (el, x, y) => {
          if (result) {
            // Indent / dedent: a purely horizontal move never passes Todoist's
            // drag activation threshold, so it needs its own gesture that first
            // nudges vertically to activate the drag, then sweeps horizontally
            // to change indent without a net vertical move (so no reorder).
            if (typeof result.indentDelta === 'number') {
              await animateIndentDrag(el, x, y, result.indentDelta);
              dragDone(sourceTask);
              return;
            }

            const deltaX = result.horizontalOffset;
            let deltaY = 0;

            if (result.dropPosition) {
              deltaY = getTaskDropPointY(
                  result.destination, result.dropPosition) - y;
            } else {
              const sourceBounds = sourceTask.getBoundingClientRect();
              const handleOffsetY = y - sourceBounds.y;
              let targetY = clientOffset(result.destination).y + handleOffsetY +
                  result.verticalOffset;
              if (result.isBelow) {
                targetY += result.destination.clientHeight;
              }
              deltaY = targetY - y;
            }

            await animateDrag(el, x, y, x + deltaX, y + deltaY);
            dragDone(sourceTask);
          } else {
            dragDone(sourceTask);
          }
        }, () => {
          dragDone(sourceTask);
        });
      } catch (ex) {
        dragDone(sourceTask);
        throw ex;
      }
    }
  }

  function dispatchPointerEvent(el, type, params) {
    if (typeof PointerEvent === 'function') {
      el.dispatchEvent(new PointerEvent(type, Object.assign({}, params, {
        pointerId: 1,
      })));
    }
  }

  function hoverTaskForDrag(task) {
    const hoverParams = {bubbles: true, cancelable: true};
    task.dispatchEvent(new MouseEvent('mouseover', hoverParams));
    dispatchPointerEvent(task, 'pointerover', hoverParams);
    dispatchPointerEvent(task, 'pointerenter', hoverParams);
  }

  async function findDragHandle(task) {
    for (let i = 0; i < 5; i++) {
      for (const selector of DRAG_HANDLE_SELECTORS) {
        const handler = task.querySelector(selector);
        if (handler) {
          return handler;
        }
      }
      await sleep(10);
    }
    return null;
  }

  async function withDragHandle(task, f, finished) {
    const key = getTaskKey(task);
    let currentTask = getTaskByKey(key) || task;
    hoverTaskForDrag(currentTask);
    try {
      await sleep(20);
      currentTask = getTaskByKey(key) || currentTask;
      const handler = await findDragHandle(currentTask);
      if (handler) {
        const bounds = handler.getBoundingClientRect();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        await f(handler, x, y);
      } else {
        info('Couldn\'t find a drag handle after hovering the task.');
        finished();
      }
    } finally {
      currentTask = getTaskByKey(key) || currentTask;
      if (currentTask) {
        dispatchPointerEvent(currentTask, 'pointerout', {bubbles: true});
        currentTask.dispatchEvent(new MouseEvent('mouseout', {bubbles: true}));
      }
    }
  }

  // Todoist listens for both pointer and mouse events, so synthetic drags need
  // to dispatch both.
  function pressPointer(el, x, y) {
    const params = mkMouseParams(x, y);
    dispatchPointerEvent(el, 'pointerdown', params);
    el.dispatchEvent(new MouseEvent('mousedown', params));
  }

  function movePointer(el, x, y) {
    const params = mkMouseParams(x, y);
    dispatchPointerEvent(el, 'pointermove', params);
    el.dispatchEvent(new MouseEvent('mousemove', params));
  }

  function releasePointer(el, x, y) {
    const params = mkMouseParams(x, y);
    dispatchPointerEvent(el, 'pointerup', params);
    el.dispatchEvent(new MouseEvent('mouseup', params));
  }

  async function animateDrag(el, sx, sy, tx, ty) {
    pressPointer(el, sx, sy);
    await sleep(10);

    const initialOffset = ty > sy ? 2 : -2;
    movePointer(el, sx, sy + initialOffset);
    await sleep(10);

    const duration = 75;
    const frameCount = 15;
    // Keep the animated drag because Todoist is sensitive to abrupt jumps.
    for (let currentFrame = 1; currentFrame <= frameCount; currentFrame++) {
      const alpha = currentFrame / frameCount;
      const x = overshootCoslerp(sx, tx, alpha, 0.3, 1.5);
      const y = overshootCoslerp(sy, ty, alpha, 0.3, 1.5);
      movePointer(el, x, y);
      await sleep(duration / frameCount);
    }

    movePointer(el, tx, ty);
    releasePointer(el, tx, ty);
  }

  // Drag gesture for indent / dedent. Unlike a reorder, this must NOT move the
  // task to a new row: it activates the drag with a vertical nudge, sweeps the
  // pointer horizontally (Todoist maps horizontal position to indent level and
  // clamps to the nearest legal level), then settles back near the original row
  // so the drop only changes indent.  See #248.
  async function animateIndentDrag(el, sx, sy, deltaX) {
    pressPointer(el, sx, sy);
    await sleep(10);

    // Activate: nudge downward past the drag threshold, staying within the
    // task's own row so no reorder is triggered.
    for (let dy = 3; dy <= 12; dy += 3) {
      movePointer(el, sx, sy + dy);
      await sleep(20);
    }

    // Sweep horizontally at a small vertical hold so the indent updates but the
    // task stays put.
    const holdY = sy + 6;
    const frameCount = 12;
    for (let currentFrame = 1; currentFrame <= frameCount; currentFrame++) {
      const x = coslerp(sx, sx + deltaX, currentFrame / frameCount);
      movePointer(el, x, holdY);
      await sleep(15);
    }

    // Settle back toward the original row and drop.
    const endX = sx + deltaX;
    const endY = sy + 2;
    movePointer(el, endX, endY);
    await sleep(10);
    releasePointer(el, endX, endY);
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

  function overshootCoslerp(s, e, t, mt, f) {
    const m = lerp(s, e, f);
    if (t < mt) {
      return coslerp(s, m, t / mt);
    } else {
      return coslerp(m, e, (t - mt) / (1 - mt));
    }
  }

  function mkMouseParams(x, y) {
    return {
      bubbles: true,
      cancelable: true,
      screenX: x,
      screenY: y,
      clientX: x,
      clientY: y,
    };
  }

  function clickTaskEdit(task) {
    storeExplicitEditingContext(task);
    withUnique(task, '.task_content', all, (content) => {
      const options = {
        bubbles: true,
        cancelable: true,
        view: window,
        button: 0,
        which: 1,
        altKey: true,
      };
      content.dispatchEvent(new MouseEvent( 'mousedown', options));
      content.dispatchEvent(new MouseEvent( 'mouseup', options));
      content.dispatchEvent(new MouseEvent( 'click', options));
    });
  }

  async function clickTaskSchedule(task) {
    await withTaskHovered(task, async () => {
      await clickUniqueRetrying(task, '[data-action-hint="task-scheduler"]');
    });
  }

  async function withTaskHovered(task, f) {
    const eventOptions = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
    };
    task.dispatchEvent(new MouseEvent('mouseover', eventOptions));
    try {
      await f();
    } finally {
      task.dispatchEvent(new MouseEvent('mouseout', eventOptions));
    }
  }

  async function blurSchedulerInput() {
    enterDeferLastBinding();
    await sleep(IS_SAFARI ? 20 : 0);
    try {
      const focusedEl = await retryWithDelay(
          'finding scheduler input',
          () => {
            const el = document.activeElement;
            if (el && findParent(el, matchingClass('scheduler'))) {
              return el;
            }
          },
      );
      focusedEl.blur();
      keepSchedulerInputBlurred();
    } finally {
      exitDeferLastBinding();
    }
  }

  // How long to keep the scheduler's input blurred after opening the
  // scheduler.
  const SCHEDULER_SETTLE_DELAY = 500;

  // Cancels the current keepSchedulerInputBlurred, if any. MUTABLE.
  let cancelSchedulerBlur = null;

  // Todoist focuses the scheduler's text input when the scheduler opens, and
  // focuses it again if it is blurred while the scheduler is still opening.
  // While it has focus, the schedule shortcuts are typed into it rather than
  // run, so keep blurring it until the scheduler has settled.
  function keepSchedulerInputBlurred() {
    stopKeepingSchedulerInputBlurred();
    const blurSchedulerFocus = (ev) => {
      const el = ev.target;
      if (el && el.blur && findParent(el, matchingClass('scheduler'))) {
        el.blur();
      }
    };
    document.addEventListener('focusin', blurSchedulerFocus, {capture: true});
    const timeout = setTimeout(
        stopKeepingSchedulerInputBlurred, SCHEDULER_SETTLE_DELAY);
    cancelSchedulerBlur = () => {
      clearTimeout(timeout);
      document.removeEventListener(
          'focusin', blurSchedulerFocus, {capture: true});
    };
  }

  function stopKeepingSchedulerInputBlurred() {
    if (cancelSchedulerBlur) {
      cancelSchedulerBlur();
      cancelSchedulerBlur = null;
    }
  }

  async function focusTimeInput() {
    // Otherwise the time input is blurred right back again when the scheduler
    // was only just opened.
    stopKeepingSchedulerInputBlurred();
    enterDeferLastBinding();
    try {
      const timepicker = await retryWithDelay(
          'finding time input',
          // Todoist used to give this an id and now generates one, leaving
          // its label as the way to find it.
          () => getById('scheduler-timepicker-input-element') ||
              getUnique(document, '.scheduler input[aria-label="Start time"]'),
      );
      timepicker.focus();
    } finally {
      exitDeferLastBinding();
    }
  }

  function clickTaskDone(task) {
    clickUnique(task, '.item_checkbox, .task_checkbox');
  }

  async function addAboveTask(task) {
    await addAboveOrBelowTask(
        task, 'Add task above', 'task-overflow-menu-add-above');
  }

  async function addBelowTask(task) {
    await addAboveOrBelowTask(
        task, 'Add task below', 'task-overflow-menu-add-below');
  }

  // Common code implementing addAbove / addBelow.
  async function addAboveOrBelowTask(task, menuText, action) {
    if (task === null) {
      clickInlineAddTask();
    } else if (viewMode === 'agenda') {
      addToSectionContaining(task);
    } else if (viewMode === 'project') {
      await withTaskMenuOpen(task, true, async () => {
        try {
          await clickUniqueRetrying(
              document, '[data-action-hint="' + action + '"]');
        } finally {
          // If there is no matching menu item (such as when sorting
          // project by priority), then the task menu needs to be
          // explicitly closed.
          closeContextMenus();
        }
      });
      // Retrying rather than getUniqueRetrying, so that not finding the editor
      // falls back on adding to the section instead of throwing.
      const editor = await retryWithDelay(
          'finding task editor', findTaskEditor).catch(() => null);
      if (editor) {
        scrollTaskEditorIntoView();
      } else {
        info('Falling back on adding in section');
        addToSectionContaining(task);
      }
    } else {
      error('Unexpected viewMode:', viewMode);
    }
  }

  // Clicks the "Add Task" button within the section that contains the specified
  // task.
  function addToSectionContaining(task) {
    let section = null;
    if (task) {
      section = getSection(task);
    } else if (viewMode === 'agenda') {
      section = getFirst(document, '.section_day');
    } else {
      section = getFirst(document, '.project_editor_instance');
    }
    if (!section) {
      warn(
          'Couldn\'t find section for task',
          task,
          ', so instead using quick-add',
      );
      // TODO: This works well in labels, but may be a bit unexpected in filters
      // like "Priority 1", since quick add will not adjust the task such that
      // it ends up in the filter.
      quickAdd();
      return;
    }
    if (viewMode === 'agenda' &&
        section.classList.contains('section_overdue')) {
      section = getFirst(document, '.section_day');
    }
    clickInlineAddTask(section);
  }

  function clickInlineAddTask(section) {
    const addButton = getUnique(
      section ? section : document, '.plus_add_button');
    if (addButton) {
      click(addButton);
      scrollTaskEditorIntoView();
    } else {
      warn('Couldn\'t find task add button so falling back on quick-add');
      quickAdd();
    }
  }

  const SHOULD_MUTATE_CURSOR =
        WHAT_CURSOR_APPLIES_TO === 'all' ||
        WHAT_CURSOR_APPLIES_TO === 'most';
  const SHOULD_UNSAFE_MUTATE_CURSOR = WHAT_CURSOR_APPLIES_TO === 'all';

  // This function is used by commands that can be applied to both selections
  // and the cursor. It returns the cursor task under the following conditions:
  //
  // * The cursor exists, and there are no selections
  //
  // * The WHAT_CURSOR_APPLIES_TO setting allows for it.
  function getCursorToMutate(danger) {
    // TODO: Something more efficient than finding all selections if we just
    // want to know if there are any.
    if (isEmptyMap(getSelectedTaskKeys())) {
      const cursor = requireCursor();
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
        error(
            'Unexpected 2nd argument to getCursorToMutate.',
            'Expected undefined or "dangerous", but got:',
            danger,
        );
      }
    }
    return null;
  }

  async function clickPriorityMenu(menu, level) {
    await clickUniqueRetrying(
        menu, '[data-action-hint="task-actions-priority-' + level + '"]');
  }

  // eslint-disable-next-line no-unused-vars
  function notifyRecommendOldUi(msg) {
    notifyUser(msg +
        ' You may be able to fix this via Settings -> Advanced -> ' +
        'uncheck "Experimental features"');
  }

  // Fall back to a bundled close icon when Todoist doesn't expose its SVG map.
  function getCloseIconHtml() {
    if (window.svgs && window.svgs['sm1/close_small.svg']) {
      return window.svgs['sm1/close_small.svg'];
    }
    return '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" ' +
        'height="16"><path fill="currentColor" d="M18.3 5.71a1 1 0 ' +
        '0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.12L10.59 12l-4.9 ' +
        '4.89a1 1 0 0 0 1.42 1.41L12 13.41l4.89 4.9a1 1 0 0 0 ' +
        '1.41-1.42L13.41 12l4.9-4.89a1 1 0 0 0-.01-1.4z"></path></svg>';
  }

  function notifyUser(msg) {
    withId('todoist_app', (appHolder) => {
      withAll(appHolder, '.ts-note', all, (oldNote) => {
        appHolder.removeChild(oldNote);
      });
      const close = div('ts-note-close');
      close.innerHTML = getCloseIconHtml();
      const note =
          div('ts-note',
              div('ts-note-content',
                  span('ts-note-prefix',
                      text('Message from todoist-shortcuts: ')),
                  element('br', null),
              typeof msg === 'string' ? text(msg) : msg),
              close);
      appHolder.appendChild(note);
      const closeFunc = () => {
        appHolder.removeChild(note);
      };
      close.onclick = closeFunc;
      setTimeout(closeFunc, 10000);
    });
  }

  function createModal(msg) {
    let modal;
    withId('todoist_app', (appHolder) => {
      const close = div('ts-modal-close');
      close.innerHTML = getCloseIconHtml();
      const content = div(
          'ts-modal-content',
        typeof msg === 'string' ? text(msg) : msg,
      );
      modal = div('ts-modal', content, close);
      appHolder.appendChild(modal);
      close.onclick = () => {
        modal.style.display = 'none';
      };
    });
    return modal;
  }

  function selectedTasksOrCursorToText(f, multiPrefix) {
    const tasks = getSelectedTasksOrCursor();
    const minIndent = Math.min(...tasks.map(getIndentLevel));
    const prefix = multiPrefix && tasks.length > 1 ? multiPrefix : '';
    return tasks.map((task) =>
      '    '.repeat(getIndentLevel(task) - minIndent) + prefix + f(task),
    ).join('\n');
  }

  function getTaskMarkdown(task) {
    const escapedTitle = escapeForMarkdown(getTaskTitle(task));
    return '[' + escapedTitle + '](' + getTaskUrl(task) + ')';
  }

  function escapeForMarkdown(text) {
    return text
        .replace(/\*/g, '\\*')
        .replace(/#/g, '\\#')
        .replace(/\//g, '\\/')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/_/g, '\\_');
  }

  function setClipboard(text) {
    if (text == '') {
      warn('Nothing to put in clipboard, so not doing anything');
      return;
    }
    const type = 'text/plain';
    const blob = new Blob([text], {type});
    const data = [new ClipboardItem({[type]: blob})];
    navigator.clipboard.write(data);
    notifyUser('Copied the following text to clipboard:\n\n' + text);
  }

  /*****************************************************************************
   * Enumeration of tasks
   */

  // Get the <li> elements for all the tasks visible in the current view.
  function getTasks(includeCollapsed, includeEditors, includeSections) {
    let shouldIncludeCollapsed = false;
    if (includeCollapsed === 'include-collapsed') {
      shouldIncludeCollapsed = true;
    } else if (includeCollapsed && includeCollapsed !== 'no-collapsed') {
      error('Unexpected value for includeCollapsed:', includeCollapsed);
      return [];
    }
    let shouldIncludeEditors = false;
    if (includeEditors === 'include-editors') {
      shouldIncludeEditors = true;
    } else if (includeEditors && includeEditors !== 'no-editors') {
      error('Unexpected value for includeEditors:', includeEditors);
      return [];
    }
    let shouldIncludeSections = false;
    if (includeSections === 'include-sections') {
      shouldIncludeSections = true;
    } else if (includeSections && includeSections !== 'no-sections') {
      error('Unexpected value for includeSections:', includeSections);
      return [];
    }
    const results = [];
    withViewContent((content) => {
      withAll(content, 'li', all, (item) => {
        // Skip elements which don't correspond to tasks or sections
        const matches =
          !item.classList.contains('reorder_item') &&
          ( item.classList.contains('task_list_item') ||
          (item.classList.contains('manager') && shouldIncludeEditors) ||
          (isSectionLi(item) && shouldIncludeSections)
          );
        // Skip nested tasks that are not visible (if includeCollapsed
        // is not set).
        const visible = shouldIncludeCollapsed || !hidden(item);
        if (matches && visible) {
          results.push(item);
        }
      });
    });
    return results;
  }

  function isSectionLi(task) {
    return matchingClass('section_list')(task.parentElement);
  }

  // Predicate, returns 'true' if the task has a 'hidden' attribute.
  function hidden(el) {
    return matchingAttr('hidden', '')(el) || el.style.display === 'none';
  }

  // This returns the ids of all the selected tasks as a set-like object.
  //
  // When in agenda mode, also includes the indent level in the key. See
  // 'getTaskById' for why.
  function getSelectedTaskKeys() {
    const results = {};
    const tasks = getTasks('include-collapsed');
    for (const task of tasks) {
      if (checkTaskIsSelected(task)) {
        const key = getTaskKey(task);
        results[key] = true;
      }
    }
    return results;
  }

  // Get key used for the cursor, in the getSelectedTaskKeys map.
  function getTaskKey(task) {
    if (viewMode === 'agenda') {
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
    if (viewMode === 'agenda') {
      return id + ' ' + indent;
    } else if (viewMode === 'project') {
      return id;
    } else {
      error('Unexpected viewMode:', viewMode);
      return null;
    }
  }

  function checkTaskIsSelected(task) {
    return task.classList.contains('selected') || task.ariaSelected === 'true';
  }

  function getTaskId(task) {
    const idViaAttr = task.attributes['data-item-id'];
    if (idViaAttr) {
      return idViaAttr.value;
    } else {
      error('Couldn\'t find id for task', task);
      return null;
    }
  }

  function getTaskTitle(task) {
    return getUnique(task, '.content, .task_content').textContent;
  }

  function getTaskUrl(task) {
    return 'https://todoist.com/showTask?id=' + getTaskId(task);
  }

  /*
  function isItemClass(cls) {
    return cls.startsWith('item_');
  }
  */

  function getIndentClass(task) {
    // TODO: can probably just use data-item-indent now, seems to
    // always be available.
    const indentClass = findUnique(isIndentClass, task.classList);
    if (indentClass) {
      return indentClass;
    } else {
      const indentAttribute = task.attributes['data-item-indent'];
      if (indentAttribute) {
        return 'indent_' + indentAttribute.value;
      } else {
        return null;
      }
    }
  }

  function getIndentLevel(task) {
    const indentAttribute = task.attributes['data-item-indent'];
    if (indentAttribute) {
      return parseInt(indentAttribute.value);
    } else {
      return 1;
    }
  }

  function isIndentClass(cls) {
    return cls.startsWith('indent_');
  }

  function stripIndentClass(cls) {
    return stripPrefix('indent_', cls);
  }

  function getTaskPriority(task) {
    let priorityClass = findUnique(isPriorityClass, task.classList);
    if (priorityClass) {
      return stripPriorityClass(priorityClass);
    } else {
      const taskCheckbox =
            getUnique(task, '.task_checkbox, .item_checkbox');
      if (taskCheckbox) {
        priorityClass = findUnique(isPriorityClass, taskCheckbox.classList);
        if (priorityClass) {
          return stripPriorityClass(priorityClass);
        } else {
          warn('failed to parse task priority');
          return null;
        }
      }
      warn('didn\'t find task priority');
    }
    return null;
  }

  function isPriorityClass(cls) {
    return cls.startsWith('priority_');
  }

  function stripPriorityClass(cls) {
    return stripPrefix('priority_', cls);
  }

  // Yup, todoist has mixed up conventions for priority number...
  function invertPriorityLevel(level) {
    switch (level) {
      case '4':
        return '1';
      case '3':
        return '2';
      case '2':
        return '3';
      case '1':
        return '4';
      default:
        throw new Error('Unexpected level');
    }
  }

  // eslint-disable-next-line no-unused-vars
  function withTaskByKey(key, f) {
    const task = getTaskByKey(key, f);
    if (task) {
      f(task);
    } else {
      warn('Couldn\'t find task key', key);
    }
  }

  function getTaskByKey(key) {
    const arr = key.split(' ');
    if (viewMode === 'project') {
      return getTaskById(arr[0], 'ignore-indent');
    } else {
      return getTaskById(arr[0], arr[1]);
    }
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
  function getTaskById(id, indent, section) {
    const indentNumber = indent ? stripIndentClass(indent) : null;
    const els = document.getElementsByClassName('task_list_item');
    for (const el of els) {
      const itemIdAttr = el.attributes['data-item-id'];
      if (itemIdAttr && itemIdAttr.value === id) {
        if (indent === 'ignore-indent') {
          if (!section || getSectionName(el) === section) {
            return el;
          }
        } else if (!indent) {
          error('getTaskById called with no indent value.');
          return el;
        } else if (el.attributes['data-item-indent'].value === indentNumber) {
          if (!section || getSectionName(el) === section) {
            return el;
          }
        }
      }
    }
    if (section) {
      // Fallback on not constraining by section.
      return getTaskById(id, indent);
    }
    if (indent !== 'ignore-indent') {
      // Fallback on not constraining by indent.
      return getTaskById(id, 'ignore-indent');
    }
    debug('No task found by getTaskById. ',
        'viewMode = ', viewMode, '; id = ', id, '; indent = ', indent);
    return null;
  }

  // Gets the next task the cursor can be moved to, after the specified task.
  //
  // eslint-disable-next-line no-unused-vars
  function getNextCursorableTask(tasks, currentKey) {
    for (let i = 0; i < tasks.length; i++) {
      if (getTaskKey(tasks[i]) === currentKey) {
        if (i + 1 < tasks.length) {
          return tasks[i + 1];
        }
      }
    }
    return null;
  }

  // MUTABLE. When set, this function should be called when navigate mode
  // finished.
  let finishNavigate = null;

  // MUTABLE. Current set of navigate options.
  let navigateOptions = {};

  // MUTABLE. Used to avoid infinite recursion of 'setupNavigate' due to it
  // being called on mutation of DOM that it mutates.
  let oldNavigateOptions = {};

  // MUTABLE. Keys the user has pressed so far.
  let navigateKeysPressed = '';

  // MUTABLE. Records whether the left nav was opened for navigation.
  let openedLeftNavForNavigate = false;

  // Assigns key bindings to sections like inbox / today / various projects.
  // These keybindings get displayed along the options.  This function should
  // be re-invoked every time the DOM refreshes, in order to ensure they are
  // displayed. It overrides the keyboard handler such that it temporarily
  // expects a key.
  function setupNavigate(navigationContainer) {
    switchKeymap(NAVIGATE_KEYMAP);
    if (leftNavIsHidden()) {
      toggleLeftNav();
      openedLeftNavForNavigate = true;
    }
    debug('Creating navigation shortcut tips');
    try {
      const navigateItems = [];
      withAll(navigationContainer, 'li', all, (li) => {
        // Ignore empty li elements, which happen for collapsed parent projects.
        if (li.childElementCount == 0) {
          return;
        }
        let mustBeKeys = null;
        let txt = '';
        let initials = null;
        let keepGoing = false;
        if (matchingAttr('data-track', 'navigation|inbox')(li)) {
          mustBeKeys = 'i';
        } else if (matchingAttr('data-track', 'navigation|team_inbox')(li)) {
          mustBeKeys = 't';
        } else if (matchingAttr('data-track', 'navigation|today')(li)) {
          mustBeKeys = 'g';
        } else if (matchingAttr('data-track', 'navigation|upcoming')(li)) {
          mustBeKeys = 'n';
        } else if (matchingAttr(
            'data-track',
            'navigation|filters-labels')(li)) {
          mustBeKeys = 'fl';
          keepGoing = true;
        } else if (matchingAttr('data-track', 'navigation|completed')(li)) {
          mustBeKeys = 'co';
        } else if (getUnique(li, 'a[aria-label="Add task"]')) {
          mustBeKeys = 'q';
        } else if (getUnique(li, 'a[aria-label="Search"]')) {
          mustBeKeys = '/';
        } else {
          const rawText = getNavItemText(li).split('\n')[0];
          if (rawText.length > 0) {
            txt = preprocessItemText(rawText);
            initials = getItemInitials(rawText);
          } else {
            debug('failed to get nav link text for', li);
          }
        }
        // Add some stable sequences for common text
        if (txt === 'priority1') {
          mustBeKeys = 'p1';
        }
        if (txt === 'priority2') {
          mustBeKeys = 'p2';
        }
        if (txt === 'priority3') {
          mustBeKeys = 'p3';
        }
        if (txt === 'priority4') {
          mustBeKeys = 'p4';
        }
        if (txt === 'assignedtome') {
          mustBeKeys = 'am';
        }
        if (txt === 'assignedtoothers') {
          mustBeKeys = 'ao';
        }
        if (txt === 'viewall') {
          mustBeKeys = 'va';
        }
        if (txt === 'noduedate') {
          mustBeKeys = 'dn';
        }
        if (mustBeKeys) {
          navigateItems.push({
            element: li,
            mustBeKeys,
            text: txt,
            initials,
            keepGoing,
          });
        } else if (txt) {
          navigateItems.push({
            element: li,
            text: txt,
            initials,
            keepGoing,
          });
        } else {
          debug('Couldn\'t figure out text for', li);
        }
      });
      withAll(navigationContainer,
          '[data-expansion-panel-header=true]',
          all,
          (summary) => {
            let mustBeKeys = null;
            const dataTrackAttr = summary.attributes['data-track'];
            if (dataTrackAttr) {
              const dataTrack = dataTrackAttr.value;
              if (dataTrack === 'navigation|projects_panel') {
                mustBeKeys = 'tp';
              } else if (dataTrack === 'navigation|labels_panel') {
                mustBeKeys = 'tl';
              } else if (dataTrack === 'navigation|filters_panel') {
                mustBeKeys = 'tf';
              } else if (dataTrack === 'navigation|favorites_panel') {
                mustBeKeys = 'tt';
              } else {
                error('Unexpected dataTrack value:', dataTrack);
              }
            }
            if (mustBeKeys) {
              navigateItems.push({
                element: summary,
                mustBeKeys,
                keepGoing: true,
              });
            }
          });

      // Add labels and filters if that content is visible
      withAll(document, 'section[aria-label="Filters"]', all,
          (filtersHolder) => {
            withAll(filtersHolder, 'li', all, (li) => {
              let txt = '';
              let initials = null;
              nameSpan = getUnique(li, '.simple_content');

              if (nameSpan) {
                txt = preprocessItemText(nameSpan.textContent);
                initials = getItemInitials(nameSpan.textContent);
              } else {
                warn('failed to get nav link text for', li);
              }

              if (txt) {
                navigateItems.push({
                  element: li,
                  text: txt,
                  initials,
                });
              } else {
                error('Couldn\'t figure out text for', li);
              }
            });
          });

      withAll(document, 'section[aria-label="Labels"]', all, (labelsHolder) => {
        withAll(labelsHolder, 'li', all, (li) => {
          let txt = '';
          let initials = null;
          nameSpan = getUnique(li, '.simple_content');

          if (nameSpan) {
            txt = preprocessItemText(nameSpan.textContent);
            initials = getItemInitials(nameSpan.textContent);
          } else {
            warn('failed to get nav link text for', li);
          }

          if (txt) {
            navigateItems.push({
              element: li,
              text: txt,
              initials,
            });
          } else {
            error('Couldn\'t figure out text for', li);
          }
        });
      });

      navigateOptions = assignKeysToItems(navigateItems);
      let different = false;
      for (const key in navigateOptions) {
        const oldOption = oldNavigateOptions[key];
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
        debug('Same set of navigation options, avoiding infinite recursion.');
        return;
      }
      navigateKeysPressed = '';
      if (!rerenderTips() && finishNavigate) {
        finishNavigate();
      }
    } catch (ex) {
      if (finishNavigate) {
        finishNavigate();
      }
      removeOldTips();
      throw ex;
    }
  }

  // Add in tips to tell the user what key to press.
  function rerenderTips() {
    removeOldTips();
    let renderedAny = false;
    for (const key in navigateOptions) {
      const prefix = key.slice(0, navigateKeysPressed.length);
      const rest = key.slice(navigateKeysPressed.length);
      if (prefix === navigateKeysPressed) {
        const option = navigateOptions[key];
        const el = option.element;
        if (!el) {
          error('Missing element for tip', key);
        } else {
          const tip = div(TODOIST_SHORTCUTS_TIP, text(rest));
          if (prefix.length > 0) {
            tip.prepend(span(TODOIST_SHORTCUTS_TIP_TYPED, text(prefix)));
          }
          el.prepend(tip);
          renderedAny = true;
        }
      }
    }
    return renderedAny;
  }

  function getNavItemText(li) {
    // Similar to li.innerText but skips divs inserted by todoist-shortcuts
    let result = '';
    for (const child of li.children) {
      if (!child.classList.contains(TODOIST_SHORTCUTS_TIP)) {
        result += child.innerText;
      }
    }
    return result;
  }

  // Lowercase and take only alphanumeric.
  function preprocessItemText(txt) {
    let result = '';
    for (const char of txt) {
      const lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlphanum(lowerChar)) {
        result += lowerChar;
      }
    }
    return result;
  }

  // Lowercase and get initials.
  function getItemInitials(txt) {
    let result = '';
    for (let i = 0; i < txt.length; i++) {
      const char = txt[i];
      const lowerChar = char.toLowerCase();
      if (lowercaseCharIsAlphanum(lowerChar) &&
        (i === 0 || txt[i - 1] === ' ' || lowerChar !== char)) {
        result += lowerChar;
      }
    }
    return result;
  }

  function lowercaseCharIsAlphanum(char) {
    const code = char.charCodeAt(0);
    return (
      (code > 47 && code < 58) || // (0-9)
      (code > 96 && code < 123)); // (a-z)
  }

  const JUMP_KEYS = 'asdfghjklqwertyuiopzxcvbnm1234567890';

  // Assign keys to items based on their text.
  function assignKeysToItems(items) {
    const result = {};
    let item;
    let keys;
    let prefix;
    const prefixesUsed = {};
    // Ensure none of the results are prefixes or equal to this keysequence.
    const prefixNotAliased = (ks) => {
      for (let i = 1; i <= ks.length; i++) {
        if (result[ks.slice(0, i)]) {
          return false;
        }
      }
      return true;
    };
    const noAliasing = (ks) => {
      if (!prefixNotAliased(ks)) {
        return false;
      }
      // Ensure this is keysequence is not a prefix of any other keysequence.
      if (prefixesUsed[ks]) {
        return false;
      }
      return true;
    };
    const addResult = (ks, x) => {
      const noAlias = noAliasing(ks);
      if (noAlias) {
        result[ks] = x;
        for (let i = 1; i <= ks.length; i++) {
          prefixesUsed[ks.slice(0, i)] = true;
        }
      }
      return noAlias;
    };
    const addViaKeyFunc = (mode, f) => {
      const groups = {};
      for (let j = 0; j < items.length; j++) {
        keys = f(items[j]);
        if (keys) {
          let group = groups[keys];
          if (!group) {
            group = [];
            groups[keys] = group;
          }
          group.push(j);
        }
      }
      const qualifying = [];
      for (keys in groups) {
        if (noAliasing(keys)) {
          const groupItems = groups[keys];
          let qualifies = false;
          if (mode === 'no-shortening') {
            qualifies = true;
          } else if (mode === 'try-shortening') {
            // Prefer shortened key sequences if they are unambiguous.
            for (let sl = MAX_NAVIGATE_PREFIX - 1; sl > 0; sl--) {
              const shortened = keys.slice(0, sl);
              if (noAliasing(shortened)) {
                let found = true;
                for (const otherKeys in groups) {
                  if (otherKeys !== keys &&
                      otherKeys.slice(0, sl) !== shortened) {
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
      qualifying.sort((a, b) => b[1] - a[1]);
      for (let k = 0; k < qualifying.length; k++) {
        keys = qualifying[k][0];
        const ix = qualifying[k][1];
        item = items[ix];
        if (addResult(keys, item)) {
          items.splice(ix, 1);
        }
      }
    };
    // Handle items with 'mustBeKeys' set.
    addViaKeyFunc('no-shortening', (it) => it.mustBeKeys);
    // When initials are at least MAX_NAVIGATE_PREFIX in length, prefer
    // assigning those.
    addViaKeyFunc('no-shortening', (it) => {
      const initials = it.initials;
      if (initials && initials.length >= MAX_NAVIGATE_PREFIX) {
        return initials.slice(0, MAX_NAVIGATE_PREFIX);
      } else {
        return null;
      }
    });
    // Attempt to use prefix as the key sequence.
    addViaKeyFunc(
        'try-shortening',
        (it) => it.text.slice(0, MAX_NAVIGATE_PREFIX),
    );
    // For the ones that didn't have unambiguous prefixes, try other character
    // suffixes.
    for (let p = MAX_NAVIGATE_PREFIX - 1; p >= 0; p--) {
      for (let m = 0; m < items.length; m++) {
        item = items[m];
        prefix = item.text.slice(0, MAX_NAVIGATE_PREFIX - 1);
        if (prefixNotAliased(prefix)) {
          for (let n = -1; n < JUMP_KEYS.length; n++) {
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
    for (let q = 0; q < items.length; q++) {
      item = items[q];
      let success = false;
      // TODO: Don't hardcode choosing one or two, instead follow
      // MAX_NAVIGATE_PREFIX
      for (let r = 0; r < JUMP_KEYS.length; r++) {
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
      for (let s = 0; s < JUMP_KEYS.length; s++) {
        for (let t = -1; t < JUMP_KEYS.length; t++) {
          // Prefer doubling keys.
          const secondKey = t === -1 ? JUMP_KEYS[s] : JUMP_KEYS[t];
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
      info(
          'There must be many similar sidebar options.',
          'Couldn\'t find keysequences for',
          items,
      );
    }
    return result;
  }

  function handleNavigateKey(ev) {
    if (keyIsModifier(ev)) {
      return;
    }
    if (ev.type === 'keydown') {
      let keepGoing = false;
      try {
        // Space to scroll down.  Shift+space to scroll up.
        if (ev.key === ' ') {
          keepGoing = true;
          withNavScroll((navScroll) => {
            if (ev.shiftKey) {
              navScroll.scrollBy(0, navScroll.clientHeight / -2);
            } else {
              navScroll.scrollBy(0, navScroll.clientHeight / 2);
            }
          });
        } else if (ev.keyCode === UP_ARROW_KEYCODE) {
          // Up arrow to scroll up a little bit.
          keepGoing = true;
          withNavScroll((navScroll) => {
            navScroll.scrollBy(0, -40);
          });
        } else if (ev.keyCode === DOWN_ARROW_KEYCODE) {
          // Down arrow to scroll down a little bit.
          keepGoing = true;
          withNavScroll((navScroll) => {
            navScroll.scrollBy(0, 40);
          });
        } else if (ev.keyCode === BACKSPACE_KEYCODE) {
          // Backspace removes keys from list of pressed keys.
          navigateKeysPressed = navigateKeysPressed.slice(0, -1);
          keepGoing = rerenderTips();
        } else {
          const char = ev.key.toLowerCase();
          if (char.length === 1 &&
              (lowercaseCharIsAlphanum(char) || char == '/')) {
            navigateKeysPressed += char;
            const option = navigateOptions[navigateKeysPressed];
            if (option) {
              const el = option.element;
              keepGoing = option.keepGoing;
              // If the user is selecting a section like projects / labels /
              // filters, then close the other sections.
              if (el.classList.contains('expansion_panel__toggle') &&
                  !isFavoritesSection(el)) {
                withNavigationContainer((navContainer) => {
                  withAll(navContainer, '.expansion_panel__toggle', all,
                      (ps) => {
                        const isExpanded =
                              ps.attributes['aria-expanded'].value === 'true';
                        if (!sameElement(el)(ps) &&
                            isExpanded &&
                            !isFavoritesSection(ps)) {
                          ps.click();
                        }
                      });
                });
              }
              // Ensure that the item is visible - first, uncollapsing
              // the outer section.
              const collapseParent = findParent(el, matchingClass('collapse'));
              if (collapseParent &&
                  !matchingClass('collapse--entered')(collapseParent)) {
                const collapseHeader = collapseParent.previousSibling;
                if (collapseHeader) {
                  clickUnique(collapseHeader, '.expansion_panel__toggle');
                } else {
                  warn('Expected to find section collapse header, but did\'nt');
                }
              }
              // Second, uncollapse all of the project's parents.
              let priorIndent = getIndentClass(el);
              const arrowsToClick = [];
              for ( let elAbove = el.previousSibling
                ; elAbove
                ; elAbove = elAbove.previousSibling
              ) {
                const curIndent = getIndentClass(elAbove);
                if (curIndent < priorIndent) {
                  priorIndent = curIndent;
                  const arr = getUnique(elAbove, '.arrow');
                  if (arr && arr.classList.contains('right')) {
                    arrowsToClick.unshift(arr);
                  } else if (elAbove.style.display === 'none') {
                    warn('Expected to find collapsed task, but got', elAbove);
                  }
                }
                // If we've reached a visible list item, we're done
                // uncollapsing.
                if (elAbove.style.display !== 'none') {
                  break;
                }
              }
              for (let i = 0; i < arrowsToClick.length; i++) {
                click(arrowsToClick[i]);
              }
              // Uncollapse the target project, if necessary.
              const arrow = getUnique(el, '.arrow');
              if (arrow) {
                // If the user re-selects the same project they are already on,
                // toggle folding.
                if (el.classList.contains('current')) {
                  const prev = el.previousSibling;
                  if (!prev || !prev.classList.contains('current')) {
                    click(arrow);
                    keepGoing = true;
                  }
                // If the user selects a collapsed project, toggle folding.
                } else if (arrow.classList.contains('right')) {
                  click(arrow);
                  keepGoing = true;
                }
              }
              // The li itself is not responsive to clicks.
              let elToClick = getUnique(el, 'a', all);
              elToClick = elToClick || el;
              click(elToClick);
              // Scroll the nav element into view, if needed. The
              // delay is to give time to the uncollapsing. Not
              // supported on firefox etc.
              if (el.scrollIntoViewIfNeeded) {
                setTimeout(() => {
                  el.scrollIntoViewIfNeeded();
                }, 300);
              }
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
          if (finishNavigate) {
            finishNavigate();
          }
          // This is deferred, because the other key handlers may execute
          // after this one.
          setTimeout(() => {
            updateKeymap();
          });
          removeOldTips();
        }
      }
    }
  }

  function withNavScroll(f) {
    const scrollDiv =
      getUnique(
          document,
          'nav > div',
          isVerticallyScrollable);
    if (scrollDiv) {
      f(scrollDiv);
    } else {
      warn('Failed to find scroll div');
    }
  }

  function isVerticallyScrollable(el) {
    return el.scrollHeight > el.clientHeight;
  }

  function isFavoritesSection(el) {
    const dataTrackAttr = el.attributes['data-track'];
    return dataTrackAttr &&
      dataTrackAttr.value === 'navigation|favorites_panel';
  }

  function keyIsModifier(ev) {
    return (ev.key === 'Shift') ||
      (ev.key === 'Meta') ||
      (ev.key === 'Control') ||
      (ev.key === 'Alt');
  }

  // Remove old tips if any still exist.
  function removeOldTips() {
    // FIXME: I can't quite explain this, but for some reason, querying the
    // list that matches the class name doesn't quite work.  So instead find
    // and remove until they are all gone.
    let toDelete = [];
    do {
      for (const el of toDelete) {
        el.parentElement.removeChild(el);
      }
      toDelete = document.getElementsByClassName(TODOIST_SHORTCUTS_TIP);
    } while (toDelete.length > 0);
  }

  /*****************************************************************************
   * Task cursor
   */

  // Sets the cursor to the first task, if any exists.
  function setCursorToFirstTask(shouldScroll) {
    const tasks = getTasks();
    if (tasks.length > 0) {
      setCursor(tasks[0], shouldScroll);
    }
  }

  // Sets the cursor to the last task, if any exists.
  function setCursorToLastTask(shouldScroll) {
    const tasks = getTasks();
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
    verticalScrollIntoView(task, 'center', false);
  }

  function scrollTaskToBottom(task) {
    verticalScrollIntoView(task, 'end', true);
  }

  function scrollTaskToTop(task) {
    verticalScrollIntoView(task, 'start', true);
  }

  // Exception thrown by requireCursor.
  function CursorRequired() {
    this.message = 'Shortcut requires a cursored task, but none found.';
  }

  // Returns the <li> element of the current cursor.  If there is
  // none, throws an exception.
  function requireCursor() {
    const cursor = getCursor();
    if (cursor) {
      return cursor;
    } else {
      throw new CursorRequired();
    }
  }

  // Returns the <li> element which corresponds to the current cursor.
  function getCursor() {
    return getTaskById(lastCursorId, lastCursorIndent, lastCursorSection);
  }

  // A functional-ish idiom to reduce boilerplate.
  function modifyCursorIndex(f) {
    const tasks = getTasks();
    let cursor = getCursor();
    if (!cursor) {
      debug('modifyCursorIndex couldn\'t find cursor, so restoreLastCursor');
      restoreLastCursor();
      cursor = getCursor();
    }
    let cursorChanged = false;
    if (!cursor) {
      info('Couldn\'t find cursor, so cursoring first task.');
      setCursorToFirstTask('scroll');
      cursorChanged = true;
    } else {
      const cursorIndex = tasks.indexOf(cursor);
      if (cursorIndex < 0) {
        error(
            'Invariant violation: couldn\'t find', cursor, 'in', tasks,
            ', so aborting modifyCursorIndex');
        cursorFirst();
        return false;
      }
      let newIndex = f(cursorIndex, tasks);
      if (newIndex < 0) {
        info('Can\'t move cursor before first task');
        newIndex = 0;
      }
      if (newIndex >= tasks.length) {
        info('Can\'t move cursor after last task');
        newIndex = tasks.length - 1;
      }
      cursorChanged = newIndex !== cursorIndex;
      if (cursorChanged) {
        const newCursor = tasks[newIndex];
        if (newCursor) {
          setCursor(newCursor, 'scroll');
        }
      }
    }
    return cursorChanged;
  }

  // This function detects which mode Todoist's view is in, since each behaves a
  // bit differently.
  function getViewMode() {
    const agendaView =
          getById('agenda_view') ||
          getUnique(document, '.upcoming_view');
    if (agendaView === null) {
      return 'project';
    } else {
      return 'agenda';
    }
  }

  function getIsFilterView() {
    return document.location.pathname.includes('/filter/');
  }

  // MUTABLE. Should always correspond to getViewMode result, as it is updated
  // on load and on some dom mutation.
  let viewMode = null;

  function updateViewMode() {
    viewMode = getViewMode();
    debug('viewMode = ', viewMode);
  }

  /*****************************************************************************
   * SVG paths used for matching hacks
   */

  // eslint-disable-next-line max-len
  // const SORT_SVG_PATH = 'M15 14.5a2 2 0 011.936 1.498L19.5 16a.5.5 0 010 1l-2.563.001a2.001 2.001 0 01-3.874 0L4.5 17a.5.5 0 010-1l8.564-.002A2 2 0 0115 14.5zm-.982 1.81l.005-.025-.005.026-.003.014-.004.025-.007.061A.897.897 0 0014 16.5l.008.125.007.047-.001.002.003.014.006.024h-.001l.004.018.016.058.007.021.004.013.009.026.013.033.012.027-.011-.026.019.043-.008-.017.029.06-.018-.037.048.09a1 1 0 001.784-.155l.015-.039.006-.018-.015.039.022-.06-.001-.001.016-.057.004-.018.005-.024.001-.006v-.001l.005-.033.008-.06A.877.877 0 0016 16.5l-.008-.124-.007-.051-.001-.001-.003-.014-.01-.047-.004-.016-.007-.024-.01-.034-.004-.012-.01-.03-.006-.013-.007-.017-.01-.026a.998.998 0 00-1.843.043l-.014.034-.007.022-.014.047-.002.009v.001l-.005.016-.01.047zM9 9.5a2 2 0 011.936 1.498L19.5 11a.5.5 0 010 1l-8.563.001a2.001 2.001 0 01-3.874 0L4.5 12a.5.5 0 010-1l2.564-.002A2 2 0 019 9.5zm0 1a.998.998 0 00-.93.634l-.014.034-.007.022-.014.047-.002.009v.001l-.005.016-.01.047.005-.025-.005.026-.003.014-.004.025-.007.061C8 11.441 8 11.471 8 11.5l.008.125.007.047-.001.002.003.014.006.024h-.001l.004.018.016.058.007.021.004.013.009.026.013.033.012.027-.011-.026.019.043-.008-.017.029.06-.018-.037.048.09a1 1 0 001.784-.155l.015-.039.006-.018-.015.039.022-.06-.001-.001.016-.057.004-.018.005-.024.001-.006v-.001l.005-.033.008-.06A.877.877 0 0010 11.5l-.008-.124-.007-.051-.001-.001-.003-.014-.01-.047-.004-.016-.007-.024-.01-.034-.004-.012-.01-.03-.006-.013-.007-.017-.01-.026A1.002 1.002 0 009 10.5zm6-6a2 2 0 011.936 1.498L19.5 6a.5.5 0 010 1l-2.563.001a2.001 2.001 0 01-3.874 0L4.5 7a.5.5 0 010-1l8.564-.002A2 2 0 0115 4.5zm0 1a.998.998 0 00-.93.634l-.014.034-.007.022-.014.047-.002.009v.001l-.005.016-.01.047.005-.025-.005.026-.003.014-.004.025-.007.061C14 6.441 14 6.471 14 6.5l.008.125.007.047-.001.002.003.014.006.024h-.001l.004.018.016.058.007.021.004.013.009.026.013.033.012.027-.011-.026.019.043-.008-.017.029.06-.018-.037.048.09a1 1 0 001.784-.155l.015-.039.006-.018-.015.039.022-.06-.001-.001.016-.057.004-.018.005-.024.001-.006v-.001l.005-.033.008-.06C16 6.557 16 6.528 16 6.5l-.008-.124-.007-.051-.001-.001-.003-.014-.01-.047-.004-.016-.007-.024-.01-.034-.004-.012-.01-.03-.006-.013-.007-.017-.01-.026A1.002 1.002 0 0015 5.5z';

  /*****************************************************************************
   * Utilities
   */

  function debug(...rest) {
    if (DEBUG) {
      const args = [].slice.call(rest);
      args.unshift('todoist-shortcuts:');
      // eslint-disable-next-line no-console
      console.log.apply(null, args);
    }
  }

  function debugWithStack(...rest) {
    if (DEBUG) {
      const args = [].slice.call(rest);
      args.unshift('todoist-shortcuts:');
      args.push('\n' + getStack());
      // eslint-disable-next-line no-console
      console.log.apply(null, args);
    }
  }

  // Used to notify about an issue that's expected to sometimes occur during
  // normal operation.
  function info(...rest) {
    const args = [].slice.call(rest);
    args.unshift('todoist-shortcuts:');
    args.push('(this is fine)');
    // eslint-disable-next-line no-console
    console.log.apply(null, args);
  }

  function warn(...rest) {
    const args = [].slice.call(rest);
    args.unshift('todoist-shortcuts:');
    args.push('\n' + getStack());
    // eslint-disable-next-line no-console
    console.warn.apply(null, args);
  }

  function error(...rest) {
    const args = [].slice.call(rest);
    args.unshift('todoist-shortcuts:');
    args.push(getStack());
    args.push('Consider reporting this as an issue to http://github.com/mgsloan/todoist-shortcuts');
    // eslint-disable-next-line no-console
    console.error.apply(null, args);
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
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    onDisable(() => {
      style.remove();
    });
    return style;
  }

  // Scrolls the specified element into view, if it isn't already fully
  // visible. 'align' is scrollIntoView's 'block' option - 'start', 'center',
  // 'end' or 'nearest'. When 'skipCheck' is set, scrolls even if the element
  // is already visible.
  //
  // The scrolling itself is left to the browser, so that it keeps working as
  // Todoist shuffles around which element does the scrolling. The scroll
  // container is located only in order to measure, so getting that wrong now
  // means imperfect alignment rather than no scrolling at all.
  function verticalScrollIntoView(el, align, skipCheck) {
    const content = getScrollContainer(el);
    if (!content) {
      warn('Failed to find scroll container for', el);
    }
    // Space at the top of the container taken up by sticky headers, which
    // would otherwise obscure the element.
    const topInset = content ? getStickyTopInset(content) : 0;
    if (!skipCheck && content && isFullyVisible(el, content, topInset)) {
      return;
    }
    // The browser has no idea the sticky headers are there, so ask it to keep
    // clear of them.
    // MUTABLE: the inline style is restored before returning.
    const oldScrollMargin = el.style.scrollMarginTop;
    el.style.scrollMarginTop = topInset + 'px';
    try {
      // TODO: for very large tasks, this could end up with the whole task not
      // being in view.
      el.scrollIntoView({block: align, behavior: 'instant'});
    } finally {
      el.style.scrollMarginTop = oldScrollMargin;
    }
  }

  // Whether the element lies entirely within the visible portion of its scroll
  // container - that is, not counting the part covered by sticky headers.
  function isFullyVisible(el, content, topInset) {
    const bounds = el.getBoundingClientRect();
    const view = content.getBoundingClientRect();
    return bounds.top >= view.top + topInset && bounds.bottom <= view.bottom;
  }

  // Finds the nearest ancestor which actually scrolls the element. Todoist has
  // moved this around over time - it used to be '#content' itself, but is now
  // a div nested within it.
  function getScrollContainer(el) {
    let cur = el ? el.parentElement : null;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (isVerticallyScrollable(cur) && hasScrollableOverflow(cur)) {
        return cur;
      }
      cur = cur.parentElement;
    }
    // Nothing to scroll (the content fits), but return something sensible so
    // that positions can still be computed.
    return getViewContent();
  }

  function hasScrollableOverflow(el) {
    const overflowY = window.getComputedStyle(el).overflowY;
    return overflowY === 'auto' ||
      overflowY === 'scroll' ||
      overflowY === 'overlay';
  }

  // Todoist sticks the view header (and, once scrolled, section headers) to the
  // top of the scroll container. Returns how much of the top of the container
  // they cover, by probing downwards from the top for sticky elements.
  function getStickyTopInset(content) {
    const bounds = content.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    // No sensible answer for tiny / hidden containers.
    if (bounds.width <= 0 || bounds.height <= 0) {
      return 0;
    }
    let inset = 0;
    for (let i = 0; i < 3; i++) {
      const stuck = document.elementsFromPoint(x, bounds.top + inset + 1)
          .find((el) => el !== content &&
                content.contains(el) &&
                window.getComputedStyle(el).position === 'sticky');
      if (!stuck) {
        break;
      }
      const newInset = stuck.getBoundingClientRect().bottom - bounds.top;
      // Bail out rather than trust an implausibly large result, which would
      // mean some big sticky wrapper got mistaken for a header.
      if (newInset <= inset || newInset > bounds.height / 3) {
        break;
      }
      inset = newInset;
    }
    return inset;
  }

  // Alias for document.getElementById
  function getById(id) {
    return document.getElementById(id);
  }

  // Alias for querySelectorAll.
  function selectAll(parent, query) {
    return parent.querySelectorAll(query);
  }

  async function selectAllRetrying(
      parent, query, predicate, fuel=100, delay=10) {
    return await retryWithDelay(
        'finding descendants matching ' + query,
        () => {
          const results = selectAll(parent, query, predicate);
          if (results.length === 0) {
            return null;
          } else {
            return results;
          }
        },
        fuel,
        delay);
  }

  async function getUniqueRetrying(
      parent, query, predicate, fuel=100, delay=10) {
    return await retryWithDelay(
        'finding unique descendant matching ' + query,
        () => getUnique(parent, query, predicate),
        fuel,
        delay);
  }

  async function clickUniqueRetrying(
      parent, query, predicate, fuel=100, delay=10) {
    click(await getUniqueRetrying(parent, query, predicate, fuel, delay));
  }

  async function clickAllRetrying(
      parent, query, predicate, fuel=100, delay=10) {
    const elements =
      await selectAllRetrying(parent, query, predicate, fuel, delay);
    for (const element of elements) {
      click(element);
    }
  }

  // Generic retry with delay between retries - returns a Promise
  async function retryWithDelay(
      taskName, task, fuel = 100, delay = 10, instantFuel = 10) {
    while (instantFuel > 0 && fuel > 0) {
      const result = task();
      if (result) {
        return result;
      }
      if (instantFuel > 0) {
        await sleep(0);
        instantFuel -= 1;
      } else {
        await sleep(delay);
        fuel -= 1;
      }
    }
    throw new Error('Ran out of retries while ' + taskName);
  }

  async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Users querySelectorAll, requires unique result, and applies the
  // user's function to it.  Logs a warning if there isn't one.
  function withUnique(parent, query, predicate, f) {
    const result = getUnique(parent, query, predicate);
    if (result) {
      return f(result);
    } else {
      warn(
          'Couldn\'t find unique descendant matching query',
          query,
          ', instead got',
          result,
      );
      return null;
    }
  }

  // Uses querySelectorAll, and applies the provided function to each result.
  function withAll(parent, query, predicate, f) {
    const els = selectAll(parent, query, predicate);
    for (let i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Invokes the function for the matching id, or logs a warning.
  function withId(id, f) {
    const el = getById(id);
    if (el) {
      return f(el);
    } else {
      warn('Couldn\'t find ID', id);
      return null;
    }
  }

  // Finds a parentElement which matches the specified
  // predicate. Returns null if element is null.
  function findParent(el0, predicate) {
    if (!el0) return null;
    let el = el0.parentElement;
    if (!el) return null;
    do {
      if (predicate(el)) {
        return el;
      }
      el = el.parentElement;
    } while (el);
    return null;
  }

  // Returns first descendant that matches the specified query and
  // predicate.
  function getFirst(parent, query, predicate) {
    return findFirst(predicate, selectAll(parent, query));
  }

  // Returns last descendant that matches the specified query and
  // predicate.
  function getLast(parent, query, predicate) {
    return findLast(predicate, selectAll(parent, query));
  }

  // Checks that there is only one descendant element that matches the
  // query and predicate, and returns it. Returns null if it is not
  // found or not unique.
  function getUnique(parent, query, predicate) {
    return findUnique(predicate, selectAll(parent, query));
  }

  // Finds a unique element matching the query and clicks it.
  function clickUnique(parent, query, predicate) {
    return withUnique(parent, query, predicate || all, click);
  }

  // Finds all elements matching the query and clicks them.
  function clickAll(parent, query, predicate) {
    withAll(parent, query, predicate || all, (el) => {
      click(el);
    });
  }

  // Returns true if the map-like / set-like object is empty.
  function isEmptyMap(obj) {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }

  // Given a predicate, returns the first element that matches. If predicate is
  // null, then it is treated like 'all'.
  function findFirst(predicate, array) {
    const pred = checkedPredicate('findFirst', predicate ? predicate : all);
    for (const el of array) {
      if (pred(el)) {
        return el;
      }
    }
    return null;
  }

  // Given a predicate, returns the last element that matches. If predicate is
  // null, then it is treated like 'all'.
  function findLast(predicate, array) {
    const pred = checkedPredicate('findLast', predicate ? predicate : all);
    for (let i = array.length - 1; i >= 0; i--) {
      const el = array[i];
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
    const pred = checkedPredicate('findUnique', predicate ? predicate : all);
    let result = null;
    for (const el of array) {
      if (pred(el)) {
        if (result === null) {
          result = el;
        } else {
          debugWithStack(
              'findUnique didn\'t find unique element because there are ' +
            'multiple results. Here are two:', result, el,
          );
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
    const found = string.slice(0, prefix.length);
    if (found === prefix) {
      return string.slice(prefix.length);
    } else {
      return null;
    }
  }

  // Simulate a mouse click, in the order a real one arrives: pointerdown,
  // mousedown, pointerup, mouseup, click.
  //
  // The pointer events matter because Todoist's popover triggers (label menu,
  // scheduler, project menu) now open from pointerdown rather than click, so a
  // mouse-only sequence never reaches the handler that opens them.  See
  // https://github.com/mgsloan/todoist-shortcuts/issues/282 and
  // https://github.com/mgsloan/todoist-shortcuts/issues/285
  function click(el) {
    const eventOptions = {bubbles: true, cancelable: true, view: window};
    dispatchPointerEvent(el, 'pointerdown', eventOptions);
    el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
    dispatchPointerEvent(el, 'pointerup', eventOptions);
    el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
    el.dispatchEvent(new MouseEvent('click', eventOptions));
  }

  function clientOffset(el) {
    const bounds = el.getBoundingClientRect();
    return {x: bounds.x, y: bounds.y};
  }

  function dateToIsoFormatUsingCurrentTimezone(date) {
    return (date.getYear() + 1900) + '-' +
      (String(date.getMonth() + 1).padStart(2, '0')) + '-' +
      (String(date.getDate()).padStart(2, '0'));
  }

  /*****************************************************************************
   * Predicates (for use with get / with functions above)
   */

  // Predicate which always returns 'true'.
  function all() {
    return true;
  }

  function matchingText(text) {
    return (el) => el.innerText === text;
  }

  function matchingAction(action) {
    return matchingAttr('data-action-hint', action);
  }

  // Returns predicate which returns 'true' if the element has the
  // specified class.
  function matchingClass(cls) {
    return (el) => el.classList.contains(cls);
  }

  // Returns predicate which returns 'true' if the element has the
  // specified class suffix.
  //
  // eslint-disable-next-line no-unused-vars
  function matchingClassSuffix(suffix) {
    return (el) => {
      for (let i = 0; i < el.classList.length; i++) {
        const cl = el.classList.item(i);
        if (cl.endsWith(suffix)) {
          return true;
        }
      }
      return false;
    };
  }

  // Returns predicate which returns 'true' if the element has the
  // specified tag.
  function matchingTag(tag) {
    return (el) => el.tagName.toLowerCase() === tag;
  }

  // Returns predicate which returns 'true' if the element has the
  // specified id.
  //
  // eslint-disable-next-line no-unused-vars
  function matchingId(id) {
    return (el) => el.id === id;
  }

  // Returns predicate which returns 'true' if the element has the
  // specified attribute.
  function matchingAttr(k, v) {
    return (el) => {
      const attr = el.attributes[k];
      if (attr) {
        return attr.value === v;
      } else {
        return false;
      }
    };
  }

  // Returns predicate which returns 'true' if the element has a child
  // matching the query.
  function hasChild(query) {
    return (el) => el.querySelector(query) !== null;
  }

  // Inverts the result of a predicate.
  function not(p) {
    return (x) => !p(x);
  }

  function sameElement(el1) {
    return (el2) => // eslint-disable-next-line eqeqeq
      el1 == el2;
  }

  // Given two predicates, uses && to combine them.
  // eslint-disable-next-line no-unused-vars
  function and(...predicates) {
    return (x) => {
      let result = true;
      for (const predicate of predicates) {
        result = result && checkedPredicate('argument of and', predicate)(x);
      }
      return result;
    };
  }

  // Given multiple predicates, uses || to combine them.
  function or(...predicates) {
    return (x) => {
      let result = false;
      for (const predicate of predicates) {
        result = result || checkedPredicate('argument of or', predicate)(x);
      }
      return result;
    };
  }

  function checkedPredicate(context, predicate) {
    return (x) => {
      const bool = predicate(x);
      if (typeof bool !== 'boolean') {
        throw new Error(
            'In ' + context + ', expected bool from predicate. Got', bool,
        );
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

  function span(...rest) {
    return element('span', ...rest);
  }

  function div(...rest) {
    return element('div', ...rest);
  }

  function element(t, cls, ...children) {
    const el = document.createElement(t);
    if (cls) {
      el.classList.add(cls);
    }
    for (const child of children) {
      el.appendChild(child);
    }
    return el;
  }

  /*****************************************************************************
   * Allow loading todoist-shortcuts repeatedly in the terminal
   */

  (() => {
    if (window.oldTodoistShortcutsDisableActions) {
      const arr = window.oldTodoistShortcutsDisableActions;
      for (let i = 0; i < arr.length; i++) {
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
    const ix = window.oldTodoistShortcutsDisableActions.length;
    window.oldTodoistShortcutsDisableActions.push(f);
    return () => {
      window.oldTodoistShortcutsDisableActions[ix] = null;
      f();
    };
  }

  /*****************************************************************************
   * Styling
   */

  function updateBackgroundColor() {
    const background = document.body;
    try {
      const currentStyle =
        background.computedStyleMap ?
        background.computedStyleMap() :
        background.currentStyle;
      if (!currentStyle) {
        // Issue is that we can't even enumerate the stylesheet rules as the
        // theme CSS is from a different domain.  Could possibly be resolved
        // by loading the CSS file directly, but that seems way too inovlved.
        warn('Figuring out background color not supported in some browsers');
        return;
      }
      const todoistBackgroundColor =
        currentStyle.get('background-color').toString();
      debug('Background color is', todoistBackgroundColor);
      addCss([
        '.' + TODOIST_SHORTCUTS_TIP + ' {',
        // Since the tips overlap expand / collapse arrows, set
        // background.
        '  background-color: ' + todoistBackgroundColor + ';',
        '}',
      ].join('\n'));
    } catch (e) {
      warn('Failed to figure out background color:', e);
    }
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
    '.' + TODOIST_SHORTCUTS_TIP + ' {',
    '  position: absolute;',
    '  margin-top: 4px;',
    '  margin-left: -18px;',
    '  padding: 2px;',
    '  border-radius: 5px;',
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
    '  color: #aaa;',
    '}',
    '',
    '.expansion_panel__toggle .' + TODOIST_SHORTCUTS_TIP + ' {',
    '  margin-top: -3px;',
    '}',
    '',
    '#content .' + TODOIST_SHORTCUTS_TIP + ' {',
    '  margin-top: 6px;',
    '  margin-left: -22px;',
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
    '  -webkit-box-shadow: ' +
      'rgba(0,0,0,0.156863) 0 2px 3px 0, ' +
      'rgba(0,0,0,0.0588235) 0 1px 10px 0, ' +
      'rgba(0,0,0,0.0196078) 0 4px 6px 0;',
    '  box-shadow: ' +
      'rgba(0,0,0,0.156863) 0 2px 3px 0, ' +
      'rgba(0,0,0,0.0588235) 0 1px 10px 0, ' +
      'rgba(0,0,0,0.0196078) 0 4px 6px 0;',
    '  max-width: 105em;',
    '  white-space: pre-wrap;',
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
    '}',
    '',
    // Fix background of active item obscuring cursor
    '',
    '.task_list_item--keyboard_shortcuts_active .task_list_item__body {',
    '  background: transparent !important;',
    '}',
    // Create space for navigation hints. My apologies to Todoist designers.
    '',
    'nav > div {',
    '  padding-left: 12px !important;',
    '}',
    '',
    // Fix for new navigation pane not having position: relative for some li
    '',
    'nav li {',
    '  position: relative;',
    '}',
  ].join('\n'));

  // A CSS style element, dynamically updated by updateCursorStyle. MUTABLE.
  const cursorStyle = addCss('');

  // This is unusual. Usually you would not dynamically generate CSS that uses
  // different IDs. However, this is a nice hack in this case, because todoist
  // frequently re-creates elements.
  function updateCursorStyle() {
    const selecter = getKeySelecter(lastCursorId, lastCursorIndent);
    cursorStyle.textContent = [
      selecter + ' {',
      '  border-left: 2px solid #4073d6;',
      '  margin-left: -2px;',
      '}',
      // Oh man, I can't believe I'm doing this...
      selecter + '[data-item-indent="2"] {',
      '  margin-left: 26px;',
      '}',
      selecter + '[data-item-indent="3"] {',
      '  margin-left: 54px;',
      '}',
      selecter + '[data-item-indent="4"] {',
      '  margin-left: 82px;',
      '}',
      selecter + '[data-item-indent="5"] {',
      '  margin-left: 110px;',
      '}',
      selecter + ' .sel_checkbox_td {',
      '  padding-left: 2px;',
      '}',
    ].join('\n');
  }

  // See comment on 'getTaskById' for explanation
  function getKeySelecter(id, indent) {
    return '.task_list_item[data-item-id="' + id + '"]' +
      '[data-item-indent="' + stripIndentClass(indent) + '"]';
  }

  function isUpcomingView() {
    return getUnique(document, '.upcoming_view') !== null;
  }

  function disabledWithLazyLoading(actionName, f) {
    if (isUpcomingView()) {
      warn(actionName, ' disabled in upcoming view, ',
          'as it doesn\'t work properly due to lazy loading.');
      return;
    } else {
      f();
    }
  }

  /*****************************************************************************
   * Mousetrap utilities
   */

  function callBinding(bind) {
    return (...args) => {
      // Don't handle keybindings when modal is open.
      if (todoistModalIsOpen()) {
        return false;
      } else {
        (async () => {
          try {
            await bind[1].apply(null, args);
          } catch (ex) {
            if (ex instanceof CursorRequired) {
              warn('Shortcut for keys ' + bind[0] +
                ' requires a cursored task, but none found.');
            } else {
              throw ex;
            }
          }
        })();
        return false;
      }
    };
  }

  function registerKeybindings(keymap, binds) {
    for (let i = 0; i < binds.length; i++) {
      if (binds[i].length === 2) {
        // eslint-disable-next-line no-undefined
        mousetrap.bind(binds[i][0], callBinding(binds[i]), undefined, keymap);
      } else {
        error('Improper binding entry at index', i, 'value is', binds[i]);
      }
    }
  }

  let deferLastKeyDownEnabled = false;
  let lastDeferredEvent = null;

  function enterDeferLastBinding() {
    deferLastKeyDownEnabled = true;
    lastDeferredEvent = null;
  }

  function exitDeferLastBinding() {
    deferLastKeyDownEnabled = false;
    if (lastDeferredEvent) {
      document.dispatchEvent(copyKeyPressEvent(lastDeferredEvent));
      lastDeferredEvent = null;
    }
  }

  // Not sure why this is needed, but otherwise exceptions get thrown.
  function copyKeyPressEvent(ev) {
    const result = new Event('keypress');
    result.key = ev.key;
    result.keyCode = ev.keyCode;
    result.shiftKey = ev.shiftKey;
    result.altKey = ev.altKey;
    result.ctrlKey = ev.ctrlKey;
    result.metaKey = ev.metaKey;
    return result;
  }

  function withCurrentFocusedMenuListItem(f) {
    const item = getCurrentFocusedMenuListItem();
    if (item === null) {
      warn('Expected to find a focused menu list, but found none.');
    }
    f(item);
  }

  function getCurrentFocusedMenuListItem() {
    const item = document.activeElement;
    const parent = item.parentElement;
    if (parent && parent.classList.contains('item_menu_list')) {
      return item;
    }
    return null;
  }

  function todoistModalIsOpen() {
    const modal =
          document.getElementsByClassName('reactist_modal_box').item(0);
    if (modal && !matchingClass('detail_modal')(modal)) {
      return true;
    }

    const findSelector =
          selectAll(document, 'div[role="listbox"][data-dialog="true"]');
    if (findSelector.length && findSelector[0].style.display !== 'none') {
      return true;
    }

    sawEscapeDown = false;
    return false;
  }

  function genericKeyHandler(ev) {
    if (todoistModalIsOpen()) {
      return modalKeyHandler(ev);
    } else {
      return mousetrap.handleKeyEvent(ev);
    }
  }

  let sawEscapeDown = false;

  function modalKeyHandler(ev) {
    const modalPredicate =
          not(or(matchingClass('quick_add'), matchingClass('detail_modal')));
    const uniqueModal =
          getUnique(document, '.reactist_modal_box', modalPredicate);
    if (uniqueModal) {
      // Special handling for the modal that appears when confirming
      // task discard (esc after q), and for the deletion confirmation
      // modal.
      let cancelButton = null;
      let acceptButton = null;
      withAll(uniqueModal, '.ist_button', all, (el) => {
        if (el.innerText === 'Cancel') {
          cancelButton = el;
        } else if (el.innerText === 'Discard task' ||
                   el.innerText === 'Delete') {
          acceptButton = el;
        }
      });
      if (cancelButton && acceptButton) {
        if (ev.keyCode === ESCAPE_KEYCODE) {
          if (ev.type === 'keydown') {
            sawEscapeDown = true;
            return false;
          } else if (ev.type === 'keyup' && sawEscapeDown) {
            click(cancelButton);
            return false;
          }
        } else if (ev.keyCode === ENTER_KEYCODE) {
          if (ev.type === 'keyup') {
            click(acceptButton);
            return false;
          }
        }
      }
    } else {
      sawEscapeDown = false;
    }
    return true;
  }

  function keydownHandler(ev) {
    debug('keydownHandler', ev);
    // In debug mode f12 enters debugger.
    if (DEBUG && ev.keyCode === 123) {
      // eslint-disable-next-line no-debugger
      debugger;
    }
    if (todoistModalIsOpen()) {
      return modalKeyHandler(ev);
    }
    if (ev.keyCode === ESCAPE_KEYCODE && ev.type === 'keydown') {
      // Workaround for #217
      if (!checkTaskViewOpen()) {
        closeContextMenus();
      }
    }
    if (deferLastKeyDownEnabled) {
      lastDeferredEvent = ev;
      return false;
    } else {
      return mousetrap.handleKeyEvent(ev);
    }
  }

  function overwriteKeyHandlers() {
    if (document.onkeydown !== null) {
      window.originalTodoistKeydown = document.onkeydown;
      document.onkeydown = null;
      document.addEventListener('keydown', keydownHandler, {capture: true});
      debug('overwrote onkeydown');
    }
    if (document.onkeypress !== null) {
      window.originalTodoistKeypress = document.onkeypress;
      document.onkeypress = null;
      document.addEventListener('keypress', genericKeyHandler, {capture: true});
      debug('overwrote onkeypress');
    }
    if (document.onkeyup !== null) {
      window.originalTodoistKeyup = document.onkeyup;
      document.onkeyup = null;
      document.addEventListener('keyup', genericKeyHandler, {capture: true});
      debug('overwrote onkeyup');
    }
  }

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  // MUTABLE
  let initializing = true;

  function initialize() {
    loadOptions();
    handlePageChange();
    updateViewMode();

    if (!window.originalTodoistScroll) {
      window.originalTodoistScroll = window.scroll;
    }
    if (!window.originalTodoistScrollBy) {
      window.originalTodoistScrollBy = window.scrollBy;
    }
    if (!window.originalTodoistScrollTo) {
      window.originalTodoistScrollTo = window.scrollTo;
    }

    // Initialize mousetrap.
    mousetrap = new TodoistShortcutsMousetrap(document);

    overwriteKeyHandlers();

    // Register key bindings with mousetrap.
    registerKeybindings(DEFAULT_KEYMAP, KEY_BINDINGS);
    registerKeybindings(SCHEDULE_KEYMAP, SCHEDULE_BINDINGS);
    registerKeybindings(NAVIGATE_KEYMAP, NAVIGATE_BINDINGS);
    registerKeybindings(POPUP_KEYMAP, POPUP_BINDINGS);
    registerKeybindings(TASK_VIEW_KEYMAP, TASK_VIEW_BINDINGS);
    registerKeybindings(MENU_LIST_KEYMAP, MENU_LIST_BINDINGS);

    // Update the keymap.  Necessary now that the side panel can start
    // out visible.
    updateKeymap();

    // Reset mousetrap on disable.
    onDisable(() => {
      mousetrap.reset();
    });

    // Register mouseover / mousemove handler.
    document.addEventListener('mousemove', handleMouseMove);
    onDisable(() => {
      document.removeEventListener('mousemove', handleMouseMove);
    });
    document.addEventListener('mouseover', handleMouseOver);
    onDisable(() => {
      document.removeEventListener('mouseover', handleMouseOver);
    });
    window.addEventListener('focus', handleWindowFocus);
    onDisable(() => {
      window.removeEventListener('focus', handleWindowFocus);
    });

    initializing = false;
  }

  function initializeWhenContentAppears(gas) {
    const content = getViewContent();
    if (gas > 0 && (content === null || !window['TodoistShortcutsMousetrap'])) {
      info('Waiting for #content and mousetrap before initializing');
      setTimeout(() => initializeWhenContentAppears(gas - 1), 25);
    } else {
      if (content === null) {
        error('Ran out of gas looking for content div. ' +
              'Initializing todoist-shortcuts anyway.');
      } else {
        info('Found content div - initializing todoist-shortcuts!');
      }
      registerTopMutationObservers(content || document);
      initialize();
    }
  }

  initializeWhenContentAppears(2000);
})();
