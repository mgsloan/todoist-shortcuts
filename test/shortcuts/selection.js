// Selecting tasks: x and the `*` prefixed shortcuts.

const assert = require('node:assert');

const selectedIs = async (t, expected) => {
  const selected = (await t.browser.selectedContents(t.page)).sort();
  assert.deepEqual(
      selected, expected.slice().sort(),
      t.key + ' selected ' + JSON.stringify(selected));
};

const onAlpha = async (t) => await t.browser.putCursorOn(t.page, 'alpha');

const selectAlphaAndBeta = async (t) => {
  await t.browser.putCursorOn(t.page, 'alpha');
  await t.press('x');
  await t.press('j');
  await t.press('x');
};

const PRIORITIES = [
  {content: 'p1', priority: 4},
  {content: 'p2', priority: 3},
  {content: 'p3', priority: 2},
  {content: 'p4', priority: 1},
];

module.exports = [
  {
    keymap: 'default',
    keys: ['x'],
    what: 'selects the task at the cursor',
    setUp: onAlpha,
    check: async (t) => await selectedIs(t, ['alpha']),
  },
  {
    keymap: 'default',
    keys: ['* a'],
    what: 'selects every task',
    setUp: onAlpha,
    check: async (t) => await selectedIs(t, ['alpha', 'beta', 'gamma']),
  },
  {
    keymap: 'default',
    keys: ['* n'],
    what: 'deselects everything',
    setUp: selectAlphaAndBeta,
    check: async (t) => await selectedIs(t, []),
  },
  {
    keymap: 'default',
    keys: ['* o'],
    what: 'selects the overdue tasks',
    tasks: [
      {content: 'overdue', due_string: 'yesterday'},
      {content: 'beta'},
      {content: 'gamma'},
    ],
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'beta'),
    check: async (t) => await selectedIs(t, ['overdue']),
  },
  {
    keymap: 'default',
    keys: ['* s'],
    what: 'selects the tasks in the cursor\'s section',
    tasks: [],
    seed: seedSections,
    setUp: async (t) => await t.browser.putCursorOn(t.page, 'one-first'),
    check: async (t) => await selectedIs(t, ['one-first', 'one-second']),
  },
  {
    keymap: 'default',
    keys: ['* 1'],
    what: 'selects the priority 1 tasks',
    tasks: PRIORITIES,
    setUp: onP4,
    check: async (t) => await selectedIs(t, ['p1']),
  },
  {
    keymap: 'default',
    keys: ['* 2'],
    what: 'selects the priority 2 tasks',
    tasks: PRIORITIES,
    setUp: onP4,
    check: async (t) => await selectedIs(t, ['p2']),
  },
  {
    keymap: 'default',
    keys: ['* 3'],
    what: 'selects the priority 3 tasks',
    tasks: PRIORITIES,
    setUp: onP4,
    check: async (t) => await selectedIs(t, ['p3']),
  },
  {
    keymap: 'default',
    keys: ['* 4', '* 0'],
    what: 'selects the priority 4 tasks',
    tasks: PRIORITIES,
    setUp: onP4,
    check: async (t) => await selectedIs(t, ['p4']),
  },
  {
    keymap: 'default',
    keys: ['* h', '* left'],
    what: 'collapses every task with sub-tasks',
    seed: seedSubTask,
    setUp: onAlpha,
    check: async (t) => assert.equal(
        await taskCount(t), 3, 'expected the sub-task to be hidden'),
  },
  {
    keymap: 'default',
    keys: ['* l', '* right'],
    what: 'expands every task with sub-tasks',
    seed: seedSubTask,
    setUp: async (t) => {
      await onAlpha(t);
      await t.press('* h');
      await t.sleep(500);
    },
    check: async (t) => assert.equal(
        await taskCount(t), 4, 'expected the sub-task to be shown'),
  },
];

async function onP4(t) {
  await t.browser.putCursorOn(t.page, 'p4');
}

const taskCount = (t) => t.page.$$eval(
    '.task_list_item', (tasks) => tasks.length);

async function seedSubTask({api, fixture}) {
  await api.createTask({
    content: 'alpha-child',
    project_id: fixture.project.id,
    parent_id: fixture.id('alpha'),
  });
}

// Two sections, the first with two tasks, so that selecting a section is
// distinguishable from selecting everything.
async function seedSections({api, fixture}) {
  const one = await api.request('POST', '/sections', {
    name: 'one', project_id: fixture.project.id,
  });
  const two = await api.request('POST', '/sections', {
    name: 'two', project_id: fixture.project.id,
  });
  for (const [content, section] of [
    ['one-first', one.id], ['one-second', one.id], ['two-first', two.id],
  ]) {
    await api.createTask({
      content, project_id: fixture.project.id, section_id: section,
    });
  }
}
