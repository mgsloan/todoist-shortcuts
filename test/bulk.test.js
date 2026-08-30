// Regression test for the bulk modes on a list which sorts itself.
//
// Rescheduling a task in the "Upcoming" view moves it to the day it was
// scheduled for, which can be below tasks the walk has not reached yet. The
// walk used to go by position alone, so it arrived at that task a second
// time - and, going round in circles, never reached the end of the list.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');
const {pressBinding, sleep} = require('./lib/shortcut-runner');

const TIMEOUT = 240000;

// Tasks due today, plus one already due tomorrow to walk on to at the end.
const TASKS = [
  ['bulk-a', 'today'],
  ['bulk-b', 'today'],
  ['bulk-c', 'today'],
  ['bulk-d', 'tomorrow'],
];

describe('bulk reschedule on a sorted list', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create('bulk-sorted', []);
    for (const [content, due] of TASKS) {
      await api.createTask({
        content: content, project_id: fixture.project.id, due_string: due,
      });
    }
    page = await browser.openApp(chrome, 'upcoming');
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  it('visits each task once, in a list which re-sorts as it goes', async () => {
    await browser.putCursorOn(page, 'bulk-a');
    await pressBinding(page, '* t');
    await page.waitForSelector('.scheduler', {timeout: 15000});
    // Scheduling for tomorrow moves the task down past the ones still to be
    // done, which is what used to send the walk back around to it.
    // The scheduler being up is what says the walk is still on a task; it
    // closes when there is nothing left, which is the loop's way out. The
    // extra rounds are so that going in circles shows up as a repeat rather
    // than as running out of iterations.
    const visited = [];
    const schedulerIsOpen = () => page.evaluate(
        () => Boolean(document.querySelector('.scheduler')));
    for (let i = 0; i < TASKS.length + 3 && await schedulerIsOpen(); i++) {
      visited.push(await browser.cursorContent(page));
      await pressBinding(page, '1');
      await sleep(2500);
    }
    await pressBinding(page, 'escape');
    const ours = visited.filter((content) => /^bulk-/.test(content || ''));
    assert.deepEqual(
        [...new Set(ours)], ours,
        'expected each task to be visited once, but the walk went ' +
        JSON.stringify(visited));
    for (const [content] of TASKS) {
      assert.ok(
          ours.includes(content),
          content + ' was never reached; the walk went ' +
          JSON.stringify(visited));
    }
  });
});

// The cursor keys used to be no use in bulk reschedule mode: 'j' and 'k' were
// bound to nothing at all, inherited from plain scheduling where they must not
// reschedule a task other than the one the scheduler was opened for, and 'h'
// and 'l' closed the scheduler in a way the mode took for the user having
// finished with the task, so it moved on a task of its own accord as well.
describe('cursor keys in bulk reschedule mode', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;
  // The subtask is made here rather than by the fixture, which has no way to
  // say that one task is under another, so its id is kept alongside.
  let childId = null;

  // Where the walk is: the scheduler is up for the task under the cursor.
  async function schedulingNow() {
    await page.waitForSelector('.scheduler', {timeout: 15000});
    return await browser.cursorContent(page);
  }

  // Whether the task is in the list at all, which is how collapsing shows up.
  async function showing(content) {
    return await page.$$eval(
        '.task_content',
        (els, wanted) => els.some((el) => el.textContent === wanted),
        content);
  }

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    // A subtask, so that 'h' and 'l' - which collapse and expand - have
    // something to work on.
    fixture = await fixtures.create('bulk-cursor', ['cur-parent', 'cur-last']);
    childId = (await api.createTask({
      content: 'cur-child',
      project_id: fixture.project.id,
      parent_id: fixture.id('cur-parent'),
    })).id;
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  it('takes the walk along with the cursor', async () => {
    await browser.putCursorOn(page, 'cur-parent');
    await pressBinding(page, '* t');
    assert.equal(await schedulingNow(), 'cur-parent');

    await pressBinding(page, 'j');
    assert.equal(await schedulingNow(), 'cur-child', 'j should go down one');

    await pressBinding(page, 'k');
    assert.equal(await schedulingNow(), 'cur-parent', 'k should go back up');

    // 'h' on a task with its subtasks showing collapses it and leaves the
    // cursor where it is, and 'l' expands it again.  Where 'l' then leaves
    // the cursor is not checked, only that the walk is still going: it steps
    // down as well, and does that before the subtasks are back, so it lands
    // past them rather than on the first of them.
    await pressBinding(page, 'h');
    assert.equal(await schedulingNow(), 'cur-parent', 'h should collapse');
    assert.ok(!(await showing('cur-child')), 'h should hide the subtask');
    await pressBinding(page, 'l');
    await page.waitForSelector('.scheduler', {timeout: 15000});
    assert.ok(await showing('cur-child'), 'l should bring the subtask back');

    await pressBinding(page, 'escape');
    // Moving about is not scheduling: the walk stops on each task it passes,
    // and only a date key gives it one.
    const ids = {
      'cur-parent': fixture.id('cur-parent'),
      'cur-child': childId,
      'cur-last': fixture.id('cur-last'),
    };
    for (const [content, id] of Object.entries(ids)) {
      assert.ok(
          !(await api.getTask(id)).due,
          content + ' was scheduled by moving the cursor over it');
    }
  });
});

// 'd' and 'e' deal with a task without giving it a date: the walk down the
// list is as good a place to complete or delete one as to reschedule it.
describe('completing and deleting in the bulk modes', {
  timeout: TIMEOUT,
}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  // Where the walk is: the dialog is up for the task under the cursor.
  async function walkIsOn(dialog) {
    await page.waitForFunction(dialog, {timeout: 15000});
    return await browser.cursorContent(page);
  }

  // The two dialogs the walk puts up, as page functions.
  const SCHEDULER = () => Boolean(document.querySelector('.scheduler'));
  const PROJECT_PICKER = () => [...document.querySelectorAll('.popper')].some(
      (popper) => popper.querySelector(
          'input[role=combobox][aria-controls^="dropdown-select-"]'));

  // Todoist asks before deleting; the confirmation takes enter or escape.
  async function waitForConfirmation() {
    await page.waitForFunction(
        () => [...document.querySelectorAll('[role="dialog"]')].some(
            (dialog) => /delete/i.test(dialog.textContent || '')),
        {timeout: 15000});
  }

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create(
        'bulk-done',
        ['bd-a', 'bd-b', 'bd-c', 'bd-d', 'bd-e', 'bd-f', 'bd-g', 'bd-h']);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  it('completes with d and deletes with e in reschedule mode', async () => {
    await browser.putCursorOn(page, 'bd-a');
    await pressBinding(page, '* t');
    assert.equal(await walkIsOn(SCHEDULER), 'bd-a');

    await pressBinding(page, 'd');
    assert.equal(await walkIsOn(SCHEDULER), 'bd-b', 'd should move on a task');

    // Cancelling the confirmation leaves the walk where it was, rather than
    // moving it past a task which is still there.
    await pressBinding(page, 'e');
    await waitForConfirmation();
    await pressBinding(page, 'escape');
    assert.equal(
        await walkIsOn(SCHEDULER), 'bd-b',
        'cancelling a delete should leave the walk on the task');

    await pressBinding(page, 'e');
    await waitForConfirmation();
    await pressBinding(page, 'enter');
    assert.equal(await walkIsOn(SCHEDULER), 'bd-c', 'e should move on a task');

    await pressBinding(page, 'escape');
    assert.ok(
        await api.waitFor(
            'bd-a to be completed', () => api.isChecked(fixture.id('bd-a'))),
        'd should have completed the task it was pressed on');
    assert.deepEqual(
        await api.waitFor('bd-b to be deleted', async () => {
          const contents = await api.contentsOfProject(fixture.project.id);
          return contents.includes('bd-b') ? null : contents;
        }),
        ['bd-c', 'bd-d', 'bd-e', 'bd-f', 'bd-g', 'bd-h'],
        'e should have deleted the task it was pressed on');
    assert.ok(
        !(await api.getTask(fixture.id('bd-c'))).due,
        'the task the walk moved on to should not have been scheduled');
  });

  // The project picker keeps the focus in its search field, so the unmodified
  // keys are typed into it and these two need alt, as the cursor keys do.
  it('completes with alt+d and deletes with alt+e in move mode', async () => {
    await browser.putCursorOn(page, 'bd-c');
    await pressBinding(page, '* v');
    // Which task the walk starts on is not checked: opening the picker for
    // the first time steps it on a couple of tasks of its own accord, which
    // is a bug of its own.  What is checked is that the keys deal with the
    // task the walk is actually on.
    const completed = await walkIsOn(PROJECT_PICKER);

    await pressBinding(page, 'alt+d');
    const deleted = await walkIsOn(PROJECT_PICKER);
    assert.notEqual(deleted, completed, 'alt+d should move on a task');

    await pressBinding(page, 'alt+e');
    await waitForConfirmation();
    await pressBinding(page, 'enter');
    assert.notEqual(
        await walkIsOn(PROJECT_PICKER), deleted,
        'alt+e should move on a task');

    await pressBinding(page, 'escape');
    assert.ok(
        await api.waitFor(
            completed + ' to be completed',
            () => api.isChecked(fixture.id(completed))),
        'alt+d should have completed the task it was pressed on');
    assert.ok(
        await api.waitFor(deleted + ' to be deleted', async () => {
          const contents = await api.contentsOfProject(fixture.project.id);
          return !contents.includes(deleted);
        }),
        'alt+e should have deleted the task it was pressed on');
  });
});

// Entering bulk move mode used to run the walk a couple of tasks down the
// list before the first dialog had settled: Todoist puts the move-to-project
// popup up, throws it away a few milliseconds later and puts another up in
// its place, and each of those flickers was taken for the user having dealt
// with a task.
describe('entering bulk move mode', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create(
        'bulk-move-start', ['bm-a', 'bm-b', 'bm-c', 'bm-d']);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  // Todoist's flicker is a race, so this enters the mode several times: it
  // used to slide on by a task or two most times, but not every time.
  it('starts on the task under the cursor, with the picker up', async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await browser.putCursorOn(page, 'bm-a');
      await pressBinding(page, '* v');
      await page.waitForFunction(
          () => [...document.querySelectorAll('.popper')].some(
              (popper) => popper.querySelector(
                  'input[role=combobox][aria-controls^="dropdown-select-"]')),
          {timeout: 15000});
      // A moment for a flicker to have its effect, if it is going to.
      await sleep(2000);
      assert.equal(
          await browser.cursorContent(page), 'bm-a',
          'entering bulk move mode moved the walk off the cursor');
      await pressBinding(page, 'escape');
      await sleep(1000);
    }
    // Nothing was moved by any of that: the walk stops on a task, it does not
    // deal with it.
    assert.deepEqual(
        await api.contentsOfProject(fixture.project.id),
        ['bm-a', 'bm-b', 'bm-c', 'bm-d']);
  });
});

// 'z' undoes without moving the walk on: what it undoes is the task before
// this one, which the walk has already finished with.
describe('undoing in bulk reschedule mode', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  const dueDateOf = async (content) =>
    (await api.getTask(fixture.id(content))).due;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create('bulk-undo', ['bz-a', 'bz-b', 'bz-c']);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  it('takes back the last change and stays where it is', async () => {
    await browser.putCursorOn(page, 'bz-a');
    await pressBinding(page, '* t');
    await page.waitForSelector('.scheduler', {timeout: 15000});

    // Scheduling bz-a takes the walk on to bz-b, which is where it should
    // still be after the undo.
    await pressBinding(page, '1');
    await api.waitFor(
        'bz-a to be scheduled', async () => Boolean(await dueDateOf('bz-a')));
    await page.waitForSelector('.scheduler', {timeout: 15000});
    assert.equal(await browser.cursorContent(page), 'bz-b');

    await pressBinding(page, 'z');
    assert.ok(
        await api.waitFor(
            'bz-a to lose its due date',
            async () => !(await dueDateOf('bz-a')), 30000),
        'z should have undone the scheduling');
    await page.waitForSelector('.scheduler', {timeout: 15000});
    assert.equal(
        await browser.cursorContent(page), 'bz-b',
        'undoing should leave the walk where it was');

    await pressBinding(page, 'escape');
  });
});
