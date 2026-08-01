// Shortcuts which change a task, checked through the API rather than the DOM.

const assert = require('node:assert');

const onAlpha = async (t) => await t.browser.putCursorOn(t.page, 'alpha');

const contents = (t) => t.api.contentsOfProject(t.fixture.project.id);

const taskOf = (t, content) => t.api.getTask(t.fixture.id(content));

// For tasks made by a seed, which the fixture doesn't know the ids of.
const findTask = async (t, content) =>
  (await t.api.getTasks(t.fixture.project.id))
      .find((task) => task.content === content);

module.exports = [
  {
    keymap: 'default',
    keys: ['d'],
    what: 'completes the task at the cursor',
    setUp: onAlpha,
    check: async (t) => await t.api.waitFor(
        'alpha to be completed',
        async () => (await taskOf(t, 'alpha')).checked),
  },
  {
    keymap: 'default',
    keys: ['e', '#'],
    what: 'asks to delete the task at the cursor',
    setUp: onAlpha,
    // Todoist asks for confirmation, so the shortcut having worked means the
    // confirmation is up rather than the task being gone.
    check: async (t) => await t.page.waitForFunction(
        () => [...document.querySelectorAll('[role="dialog"]')].some(
            (dialog) => /delete/i.test(dialog.textContent || '')),
        {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['&'],
    what: 'duplicates the task at the cursor',
    setUp: onAlpha,
    check: async (t) => await t.api.waitFor(
        'a duplicate of alpha',
        async () => (await contents(t))
            .filter((content) => content.includes('alpha')).length > 1),
  },
  {
    keymap: 'default',
    keys: ['shift+a'],
    what: 'opens an editor to add a task at the top',
    setUp: onAlpha,
    check: async (t) => await t.page.waitForFunction(
        () => Boolean(document.querySelector('.ProseMirror-focused')),
        {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['shift+j', 'shift+down', 'alt+down'],
    what: 'moves the task at the cursor down',
    setUp: onAlpha,
    settle: 2500,
    check: async (t) => await t.api.waitFor(
        'alpha to move down',
        async () => (await contents(t))[0] === 'beta'),
  },
  {
    keymap: 'default',
    keys: ['shift+k', 'shift+up', 'alt+up'],
    what: 'moves the task at the cursor up',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'beta'),
    settle: 2500,
    check: async (t) => await t.api.waitFor(
        'beta to move up',
        async () => (await contents(t))[0] === 'beta'),
  },
  {
    keymap: 'default',
    keys: ['shift+l', 'shift+right'],
    what: 'indents the task at the cursor',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'beta'),
    settle: 2500,
    check: async (t) => await t.api.waitFor(
        'beta to become a sub-task of alpha',
        async () => (await taskOf(t, 'beta')).parent_id ===
            t.fixture.id('alpha')),
  },
  {
    keymap: 'default',
    keys: ['shift+h', 'shift+left'],
    what: 'dedents the task at the cursor',
    // The task has to be created as a sub-task: the API's update endpoint
    // doesn't accept parent_id.
    seed: async ({api, fixture}) => await api.createTask({
      content: 'child',
      project_id: fixture.project.id,
      parent_id: fixture.id('alpha'),
    }),
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'child'),
    settle: 2500,
    check: async (t) => await t.api.waitFor(
        'child to stop being a sub-task',
        async () => !(await findTask(t, 'child')).parent_id),
  },
  {
    keymap: 'default',
    keys: ['enter'],
    what: 'opens the editor for the task at the cursor',
    setUp: onAlpha,
    check: async (t) => await t.page.waitForFunction(
        () => Boolean(document.querySelector('.ProseMirror-focused')),
        {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['shift+enter'],
    what: 'follows the link in the task at the cursor',
    tasks: [
      {content: 'alpha https://example.com/followed'},
      {content: 'beta'},
    ],
    setUp: async (t) => await t.browser.putCursorOn(
        t.page, 'alpha https://example.com/followed'),
    settle: 2500,
    check: async (t) => {
      const pages = await t.chrome.pages();
      const urls = pages.map((page) => page.url());
      assert.ok(
          urls.some((url) => url.includes('example.com')),
          'expected a tab for the task\'s link, got ' + JSON.stringify(urls));
      for (const page of pages) {
        if (page.url().includes('example.com')) await page.close();
      }
    },
  },
];
