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
