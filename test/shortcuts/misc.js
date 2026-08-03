// Undo, clipboard copying, and the bulk modes.

const assert = require('node:assert');

const onAlpha = async (t) => await t.browser.putCursorOn(t.page, 'alpha');

// Reading the clipboard back is not allowed without the page being focused
// the way a user focuses it, so this checks the note the extension puts up,
// which quotes what it copied.
const copies = (pattern) => async (t) => {
  const note = await t.page.waitForSelector('.ts-note', {timeout: 15000});
  const text = await note.evaluate((el) => el.textContent);
  assert.match(text, /Copied the following text/,
      t.key + ' did not say it copied anything');
  assert.match(text, pattern,
      t.key + ' copied ' + JSON.stringify(text.slice(0, 120)));
};

module.exports = [
  {
    keymap: 'default',
    keys: ['u', 'z', 'ctrl+z'],
    what: 'undoes the last change',
    setUp: async (t) => {
      await onAlpha(t);
      await t.press('d');
      // Undo works on Todoist's popup, which is only up for a few seconds,
      // so what this waits for is the task leaving the list.  Waiting for
      // the API to catch up instead - which it usually does in about a
      // second, but not always - could outlast the popup and leave the
      // shortcut with nothing to press.
      await t.page.waitForFunction(
          () => ![...document.querySelectorAll('.task_content')]
              .some((el) => el.textContent === 'alpha'),
          {timeout: 15000});
    },
    // Checked through the API rather than by the task reappearing, since the
    // point is that the change was saved.  The longer wait is because that
    // round trip is usually under a second but is occasionally much slower,
    // and this is the one check with no second chance - the popup is gone.
    check: async (t) => await t.api.waitFor(
        'alpha to come back',
        async () => !(await t.api.getTask(t.fixture.id('alpha'))).checked,
        45000),
  },
  {
    keymap: 'default',
    keys: ['ctrl+shift+,'],
    what: 'copies the task\'s url',
    setUp: onAlpha,
    check: copies(/todoist\.com|task/i),
  },
  {
    keymap: 'default',
    keys: ['ctrl+,'],
    what: 'copies the task\'s title',
    setUp: onAlpha,
    check: copies(/alpha/),
  },
  {
    keymap: 'default',
    keys: ['ctrl+c'],
    what: 'copies the task as markdown',
    setUp: onAlpha,
    check: copies(/\[alpha\]|alpha/),
  },
  {
    keymap: 'default',
    keys: ['ctrl+s'],
    what: 'asks Todoist to sync',
    // Sync lives in the account menu, so the menu being open with its sync
    // item saying it has just synced is the whole of what the key does.  The
    // item is not in the page at all until the menu is opened.
    check: async (t) => await t.page.waitForFunction(
        () => {
          const info = document.getElementById('last-sync-info');
          return Boolean(info) && info.textContent === 'Just now';
        },
        {timeout: 15000}),
  },
  {
    keymap: 'default',
    keys: ['* t'],
    // What makes it bulk mode rather than `t` is moving on to the next task
    // once a date is picked, so that is what this checks.
    what: 'schedules each task in turn from the cursor down',
    setUp: onAlpha,
    check: async (t) => {
      await t.page.waitForSelector('.scheduler', {timeout: 15000});
      await t.press('c');
      await t.browser.waitForCursorOn(t.page, 'beta');
      await t.page.waitForSelector('.scheduler', {timeout: 15000});
      assert.ok(
          (await t.api.getTask(t.fixture.id('alpha'))).due,
          'expected the first task to have been scheduled');
    },
    tearDown: async (t) => await t.press('escape'),
  },
  {
    keymap: 'default',
    keys: ['* v'],
    // Cursor movement needing alt is what tells bulk move apart from `v`:
    // the picker keeps focus in its search input, so the unmodified keys
    // belong to it.
    what: 'moves each task in turn from the cursor down',
    setUp: onAlpha,
    check: async (t) => {
      await t.page.waitForSelector('.popper', {timeout: 15000});
      await t.press('alt+j');
      await t.browser.waitForCursorOn(t.page, 'beta');
      await t.page.waitForSelector('.popper', {timeout: 15000});
    },
    tearDown: async (t) => await t.press('escape'),
  },
];
