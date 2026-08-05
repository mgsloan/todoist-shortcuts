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
