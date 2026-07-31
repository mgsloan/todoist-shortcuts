// Tests for the scheduling shortcuts reachable from `t`.
//
// https://github.com/mgsloan/todoist-shortcuts/issues/205 reported that `t n`
// (next weekend) did nothing, back when Todoist had dropped the button.

const assert = require('node:assert');
const {after, before, beforeEach, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 120000;

// Waits for the task's due date, since it takes a moment to reach the server.
async function waitForDue(id, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const due = (await api.getTask(id)).due;
    if (due) return due.date;
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for a due date');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function daysBetween(from, to) {
  const start = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

describe('scheduling', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;
  // Today according to the browser, which is what the shortcuts work from.
  let today = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    today = await first.evaluate(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' +
          pad(now.getDate());
    });
    await first.close();
    await fixtures.destroyStale();
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  beforeEach(async () => {
    if (page) await page.close();
    page = null;
    await fixtures.destroy(fixture);
    fixture = null;
  });

  // Opens a task, then presses `t` followed by the given key.
  const schedule = async (name, key) => {
    fixture = await fixtures.create(name, [{content: 'alpha'}]);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 't');
    // The shortcut blurs the scheduler's text input after opening it. Keys
    // pressed before that lands are typed into the input instead.
    await page.waitForFunction(() => {
      const active = document.activeElement;
      return Boolean(document.querySelector('.scheduler')) &&
          (!active || !['INPUT', 'TEXTAREA'].includes(active.tagName));
    }, {timeout: 30000});
    await browser.press(page, key);
    return await waitForDue(fixture.id('alpha'));
  };

  it('schedules for tomorrow with `t t`', async () => {
    const due = await schedule('tomorrow', 't');
    assert.equal(daysBetween(today, due), 1);
  });

  it('schedules for the next weekend with `t n`', async () => {
    const due = await schedule('weekend', 'n');
    const day = new Date(due + 'T00:00:00').getDay();
    assert.equal(day, 6, 'expected a Saturday, got ' + due);
    // Todoist counts the coming weekend as this one, so from a Friday the
    // next weekend is over a week away.
    const days = daysBetween(today, due);
    assert.ok(days > 0 && days <= 14, 'expected within a fortnight: ' + due);
  });
});
