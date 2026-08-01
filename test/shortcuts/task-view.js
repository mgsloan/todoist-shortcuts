// The keymap which applies while the task view is open, reached with `i`.

const assert = require('node:assert');

const TASK_VIEW = 'div[data-testid="task-details-modal"]';

// Scheduling from the task view clicks the task's due date button, which is
// only present once the task has a date.
const DATED = [
  {content: 'alpha', due_string: 'today'},
  {content: 'beta'},
  {content: 'gamma'},
];

const openTaskView = async (t, content) => {
  await t.browser.putCursorOn(t.page, content || 'alpha');
  await t.press('i');
  await t.page.waitForSelector(TASK_VIEW, {timeout: 15000});
  await t.sleep(800);
};

const onAlpha = (t) => openTaskView(t, 'alpha');

const taskViewText = (t) => t.page.evaluate((selector) => {
  const view = document.querySelector(selector);
  return view ? (view.textContent || '') : null;
}, TASK_VIEW);

const taskViewIsOpen = async (t) => (await taskViewText(t)) !== null;

const showsTask = (content) => async (t) => {
  const text = await t.api.waitFor(
      t.key + ' to show ' + content,
      async () => {
        const shown = await taskViewText(t);
        return shown && shown.includes(content) ? shown : null;
      });
  assert.ok(text.includes(content));
};

// Most of these open something inside the task view, which lands in a popup.
const opensAPopup = async (t) => await t.page.waitForSelector(
    '[data-testid="popper__overlay"], .popper, [role="dialog"] [role="menu"]',
    {timeout: 15000});

const editorIsFocused = async (t) => await t.page.waitForFunction(
    () => Boolean(document.querySelector('.ProseMirror-focused')),
    {timeout: 15000});

module.exports = [
  {
    keymap: 'task_view',
    keys: ['enter'],
    what: 'edits the task',
    setUp: onAlpha,
    check: editorIsFocused,
  },
  {
    keymap: 'task_view',
    keys: ['d'],
    what: 'completes the task',
    setUp: onAlpha,
    check: async (t) => await t.api.waitFor(
        'alpha to be completed',
        async () => (await t.api.getTask(t.fixture.id('alpha'))).checked),
  },
  {
    keymap: 'task_view',
    keys: ['i', 'escape'],
    what: 'closes the task view',
    setUp: onAlpha,
    check: async (t) => assert.equal(
        await taskViewIsOpen(t), false, 'the task view should have closed'),
  },
  {
    keymap: 'task_view',
    keys: ['h'],
    what: 'goes to the parent task',
    seed: async ({api, fixture}) => await api.createTask({
      content: 'child',
      project_id: fixture.project.id,
      parent_id: fixture.id('alpha'),
    }),
    setUp: async (t) => await openTaskView(t, 'child'),
    check: showsTask('alpha'),
  },
  {
    keymap: 'task_view',
    keys: ['j'],
    what: 'goes to the next task',
    setUp: onAlpha,
    check: showsTask('beta'),
  },
  {
    keymap: 'task_view',
    keys: ['k'],
    what: 'goes to the previous task',
    setUp: async (t) => await openTaskView(t, 'beta'),
    check: showsTask('alpha'),
  },
  {
    keymap: 'task_view',
    keys: ['c'],
    what: 'opens the comment editor',
    setUp: onAlpha,
    check: editorIsFocused,
  },
  {
    keymap: 'task_view',
    keys: ['q', 'a', 'A', 'o', 'O'],
    what: 'adds a sub-task',
    setUp: onAlpha,
    check: editorIsFocused,
  },
  {
    keymap: 'task_view',
    keys: ['t'],
    what: 'opens the scheduler',
    // On a task with a due date: the button it clicks is only there then.
    tasks: DATED,
    setUp: onAlpha,
    check: async (t) => await t.page.waitForSelector(
        '.scheduler', {timeout: 15000}),
  },
  {
    keymap: 'task_view',
    keys: ['shift+t'],
    what: 'opens the scheduler ready to type',
    tasks: DATED,
    setUp: onAlpha,
    check: async (t) => await t.page.waitForSelector(
        '.scheduler', {timeout: 15000}),
  },
  {
    keymap: 'task_view',
    keys: ['v'],
    what: 'opens the move to project picker',
    setUp: onAlpha,
    check: opensAPopup,
  },
  {
    keymap: 'task_view',
    keys: ['y', '@'],
    what: 'opens the label picker',
    setUp: onAlpha,
    check: opensAPopup,
  },
  {
    keymap: 'task_view',
    keys: ['shift+r'],
    what: 'opens reminders',
    setUp: onAlpha,
    check: opensAPopup,
  },
  {
    keymap: 'task_view',
    keys: ['e', '#'],
    what: 'asks to delete the task',
    setUp: onAlpha,
    check: async (t) => await t.page.waitForFunction(
        () => [...document.querySelectorAll('[role="dialog"]')].some(
            (dialog) => /delete/i.test(dialog.textContent || '')),
        {timeout: 15000}),
  },
  {
    keymap: 'task_view',
    keys: ['ctrl+shift+/'],
    what: 'opens a random task',
    setUp: onAlpha,
    settle: 2500,
    check: async (t) => assert.equal(
        await taskViewIsOpen(t), true, 'a task view should still be open'),
  },
];
