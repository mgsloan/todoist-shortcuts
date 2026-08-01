// Shortcuts whose job is to open something. The check is that the thing
// appeared; what it then does is Todoist's business.

const assert = require('node:assert');

const onAlpha = async (t) => await t.browser.putCursorOn(t.page, 'alpha');

// Waits for an element, and says which shortcut was being tested if it never
// turns up.
const opens = (selector) => async (t) => {
  try {
    await t.page.waitForSelector(selector, {timeout: 15000});
  } catch (e) {
    throw new Error(t.key + ' did not open anything matching ' + selector);
  }
};

// Several of the things Todoist puts up have no distinctive attributes, so
// this looks for a dialog, menu or popup mentioning the given words.
const opensSomethingSaying = (pattern) => async (t) => {
  try {
    await t.page.waitForFunction((source) => {
      const regexp = new RegExp(source, 'i');
      return [...document.querySelectorAll(
          '[role="dialog"], [role="menu"], .reactist_menulist, .popper')]
          .some((el) => regexp.test(el.textContent || ''));
    }, {timeout: 15000}, pattern.source);
  } catch (e) {
    throw new Error(t.key + ' did not open anything saying ' + pattern.source);
  }
};

module.exports = [
  {
    keymap: 'default',
    keys: ['i'],
    what: 'opens the task view',
    setUp: onAlpha,
    check: opens('div[data-testid="task-details-modal"]'),
  },
  {
    keymap: 'default',
    keys: ['c'],
    what: 'opens the comments for the task at the cursor',
    setUp: onAlpha,
    check: opensSomethingSaying(/comment/),
  },
  {
    keymap: 'default',
    keys: ['shift+r'],
    what: 'opens the reminders for the task at the cursor',
    setUp: onAlpha,
    check: opensSomethingSaying(/reminder/),
  },
  {
    keymap: 'default',
    keys: ['>'],
    what: 'opens the deadline picker',
    broken: 'Opens the task editor rather than the deadline picker.',
    setUp: onAlpha,
    check: opensSomethingSaying(/deadline/),
  },
  {
    keymap: 'default',
    keys: ['v'],
    what: 'opens the move to project picker',
    setUp: onAlpha,
    check: opensSomethingSaying(/move to|project/),
  },
  {
    keymap: 'default',
    keys: ['y', '@'],
    what: 'opens the label picker',
    setUp: onAlpha,
    // The picker's text is in a portal with nothing to match on, so this
    // settles for the popup it opens in.
    check: opens('[data-testid="popper__overlay"], .popper'),
  },
  {
    keymap: 'default',
    keys: ['q'],
    what: 'opens quick add',
    check: opens('[data-testid="quick-add"]'),
  },
  {
    keymap: 'default',
    keys: ['w'],
    what: 'opens the view\'s more actions menu',
    check: opens('[role="menu"], .reactist_menulist'),
  },
  {
    keymap: 'default',
    keys: ['?'],
    what: 'opens the shortcuts help',
    check: opens('.todoist_shortcuts_help'),
  },
  {
    keymap: 'default',
    keys: ['ctrl+k'],
    what: 'opens Todoist\'s command menu',
    broken: 'Looks for a command menu button which Todoist no longer has.',
    check: opensSomethingSaying(/search|command/),
  },
  {
    keymap: 'default',
    keys: ['f', '/'],
    what: 'focuses the search input',
    check: async (t) => await t.page.waitForFunction(() => {
      const active = document.activeElement;
      return active && (active.tagName === 'INPUT' ||
          active.getAttribute('role') === 'combobox' ||
          active.isContentEditable);
    }, {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['m'],
    what: 'toggles the sidebar',
    // The container keeps its width when collapsed, so this goes by what the
    // toggle button says about it.
    check: async (t) => await t.page.waitForFunction(
        () => {
          const button = document.querySelector(
              'button[aria-controls=sidebar]');
          return button && button.getAttribute('aria-expanded') === 'false';
        }, {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['g'],
    what: 'shows the sidebar navigation tips',
    check: async (t) => await t.page.waitForFunction(
        () => document.querySelectorAll('.todoist_shortcuts_tip').length > 0,
        {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['G'],
    what: 'goes to the project of the task at the cursor',
    broken: 'Does not navigate anywhere.',
    where: 'today',
    seed: async ({api, fixture}) => await api.createTask({
      content: 'today-task',
      project_id: fixture.project.id,
      due_string: 'today',
    }),
    setUp: async (t) => {
      await t.browser.waitForTasks(t.page);
      await t.browser.putCursorOn(t.page, 'today-task');
    },
    settle: 2500,
    check: async (t) => assert.ok(
        t.page.url().includes(t.fixture.project.id),
        'expected to end up in the task\'s project, at ' + t.page.url()),
  },
  {
    keymap: 'default',
    keys: ['t'],
    what: 'opens the scheduler',
    setUp: onAlpha,
    check: opens('.scheduler'),
  },
  {
    keymap: 'default',
    keys: ['shift+t'],
    what: 'opens the scheduler with its input focused',
    setUp: onAlpha,
    check: async (t) => {
      await opens('.scheduler')(t);
      await t.page.waitForFunction(() => {
        const active = document.activeElement;
        return Boolean(active && active.closest('.scheduler'));
      }, {timeout: 15000});
    },
  },
  {
    keymap: 'default',
    keys: ['alt+t'],
    what: 'opens the scheduler ready to type a time',
    setUp: onAlpha,
    check: async (t) => await t.page.waitForFunction(() => {
      const active = document.activeElement;
      return Boolean(active && active.getAttribute('aria-label') ===
          'Start time');
    }, {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['ctrl+shift+/'],
    what: 'opens a random task',
    settle: 2500,
    check: opens('div[data-testid="task-details-modal"]'),
  },
];
