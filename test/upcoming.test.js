// Regression tests for the cursor keys in the "Upcoming" view.
//
// `^`, `$`, `{` and `}` used to refuse to do anything there, on the grounds
// that its lazy loading made them unreliable.  Every view is a virtual list
// now, so the most those keys can reach is what Todoist has rendered - which
// is what they do everywhere else, and better than doing nothing.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 180000;

// Where the cursor is in the rendered list, and how many tasks there are.
// Going by position rather than by task keeps these from depending on what
// else the account has due.
const CURSOR_POSITION = `(() => {
  const tasks = [...document.querySelectorAll('.task_list_item')];
  const index = tasks.findIndex((task) => {
    const style = getComputedStyle(task);
    return style.borderLeftColor === 'rgb(64, 115, 214)' &&
        parseFloat(style.borderLeftWidth) > 1;
  });
  return {index: index, count: tasks.length};
})`;

describe('cursor keys in the upcoming view', {timeout: TIMEOUT}, () => {
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
    // Two days' worth, so that the view has more than one section whichever
    // way the account's own tasks fall.
    fixture = await fixtures.create('upcoming', []);
    for (const [content, due] of [['up-today', 'today'],
      ['up-tomorrow', 'tomorrow']]) {
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

  const position = async () => await page.evaluate(CURSOR_POSITION + '()');

  // Puts the cursor on the task at the given index, by going to the top and
  // stepping down, then presses the key and says where it ended up.
  const from = async (index, key) => {
    await browser.press(page, '^');
    for (let i = 0; i < index; i++) await browser.press(page, 'j');
    const before = await position();
    assert.equal(before.index, index, 'could not put the cursor in place');
    await browser.press(page, key);
    return {before: before, after: await position()};
  };

  it('moves to the first task with `^`', async () => {
    const moved = await from(2, '^');
    assert.equal(moved.after.index, 0);
  });

  it('moves to the last rendered task with `$`', async () => {
    const moved = await from(0, '$');
    assert.equal(moved.after.index, moved.after.count - 1);
  });

  it('moves down a section with `}`', async () => {
    const moved = await from(0, '}');
    assert.ok(
        moved.after.index > 0,
        'expected `}` to move down from the first task, but it stayed put');
  });

  it('moves up a section with `{`', async () => {
    const down = await from(0, '}');
    await browser.press(page, '{');
    const back = await position();
    assert.ok(
        back.index < down.after.index,
        'expected `{` to move back up, but it stayed at ' + back.index);
  });
});
