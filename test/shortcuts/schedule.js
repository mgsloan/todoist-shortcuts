// The keymap which applies while the scheduler is open, reached with `t`.

const assert = require('node:assert');

// Every one of these opens the scheduler on alpha first.
const openScheduler = async (t) => {
  await t.browser.putCursorOn(t.page, 'alpha');
  await t.press('t');
  await t.page.waitForSelector('.scheduler', {timeout: 15000});
  // The shortcut blurs the scheduler's input; keys pressed before that lands
  // are typed into it instead.
  await t.page.waitForFunction(() => {
    const active = document.activeElement;
    return !active || !['INPUT', 'TEXTAREA'].includes(active.tagName);
  }, {timeout: 15000});
};

const dueDateOfAlpha = async (t) => {
  const task = await t.api.getTask(t.fixture.id('alpha'));
  return task.due && task.due.date;
};

// Waits for alpha to be scheduled, and returns how many days ahead that is.
const daysAhead = async (t) => {
  const date = await t.api.waitFor(
      t.key + ' to schedule alpha', () => dueDateOfAlpha(t));
  const today = await t.page.evaluate(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' +
        pad(now.getDate());
  });
  return Math.round(
      (new Date(date + 'T00:00:00') - new Date(today + 'T00:00:00')) /
      (24 * 60 * 60 * 1000));
};

const schedulesInDays = (expected) => async (t) => assert.equal(
    await daysAhead(t), expected,
    t.key + ' should have scheduled alpha ' + expected + ' day(s) ahead');

const schedulerIsOpen = (t) => t.page.evaluate(
    () => Boolean(document.querySelector('.scheduler')));

const cursorMovedTo = (expected) => async (t) => assert.equal(
    await t.browser.cursorContent(t.page), expected,
    t.key + ' should have moved the cursor to ' + expected);

// Tasks which already have a due date, for postponing and unscheduling.
const DUE_TODAY = [
  {content: 'alpha', due_string: 'today'},
  {content: 'beta'},
  {content: 'gamma'},
];

const plusDays = [];
for (let day = 1; day <= 9; day++) {
  plusDays.push({
    keymap: 'schedule',
    keys: [String(day)],
    what: 'schedules ' + day + ' day(s) ahead',
    setUp: openScheduler,
    check: schedulesInDays(day),
  });
}

module.exports = [
  {
    keymap: 'schedule',
    keys: ['c', '0'],
    what: 'schedules today',
    setUp: openScheduler,
    check: schedulesInDays(0),
  },
  ...plusDays,
  {
    keymap: 'schedule',
    keys: ['w'],
    what: 'schedules next week',
    setUp: openScheduler,
    check: async (t) => {
      const days = await daysAhead(t);
      assert.ok(days > 0 && days <= 8, t.key + ' scheduled ' + days + ' ahead');
    },
  },
  {
    keymap: 'schedule',
    keys: ['s', 'p'],
    what: 'postpones the task',
    broken: 'The postpone button is no longer uniquely identifiable.',
    tasks: DUE_TODAY,
    setUp: openScheduler,
    check: async (t) => {
      const days = await daysAhead(t);
      assert.ok(days > 0, t.key + ' should have moved alpha later, not ' +
          days + ' days ahead');
    },
  },
  {
    keymap: 'schedule',
    keys: ['r'],
    what: 'removes the due date',
    tasks: DUE_TODAY,
    setUp: openScheduler,
    check: async (t) => await t.api.waitFor(
        'alpha to lose its due date',
        async () => (await dueDateOfAlpha(t)) === undefined ||
            (await dueDateOfAlpha(t)) === null),
  },
  {
    keymap: 'schedule',
    keys: ['alt+t'],
    what: 'focuses the time input',
    broken: 'Looks for a scheduler button which Todoist no longer has.',
    setUp: openScheduler,
    check: async (t) => await t.page.waitForSelector(
        '#scheduler-timepicker-input-element', {timeout: 15000}),
  },
  {
    keymap: 'schedule',
    keys: ['shift+t'],
    what: 'focuses the scheduler\'s text input',
    setUp: openScheduler,
    check: async (t) => await t.page.waitForFunction(() => {
      const active = document.activeElement;
      return Boolean(active && active.closest('.scheduler'));
    }, {timeout: 15000}),
  },
  {
    keymap: 'schedule',
    keys: ['escape'],
    what: 'closes the scheduler',
    setUp: openScheduler,
    check: async (t) => assert.equal(
        await schedulerIsOpen(t), false, 'the scheduler should have closed'),
  },
  {
    keymap: 'schedule',
    keys: ['j', 'down', 'k', 'up'],
    what: 'does nothing, so that the calendar keeps them',
    setUp: openScheduler,
    check: async (t) => {
      assert.equal(
          await schedulerIsOpen(t), true, 'the scheduler should still be open');
      assert.equal(
          await dueDateOfAlpha(t), undefined, 'alpha should not be scheduled');
    },
  },
  {
    keymap: 'schedule',
    keys: ['h', 'left'],
    what: 'collapses sub-tasks and reopens the scheduler',
    seed: seedSubTask,
    setUp: openScheduler,
    check: async (t) => {
      assert.equal(await taskCount(t), 3, 'the sub-task should be hidden');
      assert.equal(await schedulerIsOpen(t), true);
    },
  },
  {
    keymap: 'schedule',
    keys: ['l', 'right'],
    what: 'expands sub-tasks and reopens the scheduler',
    broken: 'Collapsing works from the scheduler but expanding does not.',
    seed: seedSubTask,
    setUp: async (t) => {
      await openScheduler(t);
      await t.press('h');
      await t.sleep(1500);
    },
    check: async (t) => {
      assert.equal(await taskCount(t), 4, 'the sub-task should be shown');
      assert.equal(await schedulerIsOpen(t), true);
    },
  },
  {
    keymap: 'schedule',
    keys: ['^'],
    what: 'schedules the first task instead',
    setUp: async (t) => {
      await t.browser.putCursorOn(t.page, 'gamma');
      await t.press('t');
      await t.page.waitForSelector('.scheduler', {timeout: 15000});
    },
    check: cursorMovedTo('alpha'),
  },
  {
    keymap: 'schedule',
    keys: ['$'],
    what: 'schedules the last task instead',
    setUp: openScheduler,
    check: cursorMovedTo('gamma'),
  },
  {
    keymap: 'schedule',
    keys: ['{'],
    what: 'moves to the previous section\'s task',
    tasks: [],
    seed: seedSections,
    setUp: async (t) => {
      await t.browser.putCursorOn(t.page, 'two-first');
      await t.press('t');
      await t.page.waitForSelector('.scheduler', {timeout: 15000});
    },
    check: cursorMovedTo('one-first'),
  },
  {
    keymap: 'schedule',
    keys: ['}'],
    what: 'moves to the next section\'s task',
    tasks: [],
    seed: seedSections,
    setUp: async (t) => {
      await t.browser.putCursorOn(t.page, 'one-first');
      await t.press('t');
      await t.page.waitForSelector('.scheduler', {timeout: 15000});
    },
    check: cursorMovedTo('two-first'),
  },
];

const taskCount = (t) => t.page.$$eval(
    '.task_list_item', (tasks) => tasks.length);

async function seedSubTask({api, fixture}) {
  await api.createTask({
    content: 'alpha-child',
    project_id: fixture.project.id,
    parent_id: fixture.id('alpha'),
  });
}

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
