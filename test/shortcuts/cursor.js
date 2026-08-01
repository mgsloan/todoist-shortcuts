// Moving the cursor around the task list.

const assert = require('node:assert');

const cursorIs = async (t, expected) => assert.equal(
    await t.browser.cursorContent(t.page), expected,
    t.key + ' should have put the cursor on ' + expected);

// alpha with two sub-tasks, so that collapsing and expanding have an effect.
const NESTED = [
  {content: 'alpha'},
  {content: 'beta'},
  {content: 'gamma'},
];

const subTaskCount = (t) => t.page.$$eval(
    '.task_list_item', (tasks) => tasks.length);

module.exports = [
  {
    keymap: 'default',
    keys: ['j', 'down'],
    what: 'moves the cursor down',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'alpha'),
    check: async (t) => await cursorIs(t, 'beta'),
  },
  {
    keymap: 'default',
    keys: ['k', 'up'],
    what: 'moves the cursor up',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'gamma'),
    check: async (t) => await cursorIs(t, 'beta'),
  },
  {
    keymap: 'default',
    keys: ['^'],
    what: 'moves the cursor to the first task',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'gamma'),
    check: async (t) => await cursorIs(t, 'alpha'),
  },
  {
    keymap: 'default',
    keys: ['$'],
    what: 'moves the cursor to the last task',
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'alpha'),
    check: async (t) => await cursorIs(t, 'gamma'),
  },
  {
    keymap: 'default',
    keys: ['h', 'left'],
    what: 'collapses the sub-tasks at the cursor',
    tasks: NESTED,
    seed: seedSubTask,
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'alpha'),
    check: async (t) => {
      // The child is hidden while its parent is collapsed.
      assert.equal(await subTaskCount(t), 3, 'expected the child to be hidden');
    },
  },
  {
    keymap: 'default',
    keys: ['l', 'right'],
    what: 'expands the sub-tasks at the cursor',
    tasks: NESTED,
    seed: seedSubTask,
    setUp: async (t) => {
      await t.browser.putCursorOn(t.page, 'alpha');
      await t.press('h');
      await t.sleep(500);
    },
    check: async (t) => {
      assert.equal(await subTaskCount(t), 4, 'expected the child to be shown');
    },
  },
  {
    keymap: 'default',
    keys: ['{'],
    what: 'moves the cursor up to the previous section',
    tasks: [],
    seed: seedSections,
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'two-first'),
    check: async (t) => await cursorIs(t, 'one-first'),
  },
  {
    keymap: 'default',
    keys: ['}'],
    what: 'moves the cursor down to the next section',
    tasks: [],
    seed: seedSections,
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'one-first'),
    check: async (t) => await cursorIs(t, 'two-first'),
  },
];

// alpha gets a sub-task, so that collapsing and expanding it do something.
async function seedSubTask({api, fixture}) {
  await api.createTask({
    content: 'alpha-child',
    project_id: fixture.project.id,
    parent_id: fixture.id('alpha'),
  });
}

// Two sections with a task each, since section navigation needs them.
async function seedSections({api, fixture}) {
  for (const name of ['one', 'two']) {
    const section = await api.request('POST', '/sections', {
      name, project_id: fixture.project.id,
    });
    await api.createTask({
      content: name + '-first',
      project_id: fixture.project.id,
      section_id: section.id,
    });
  }
}
