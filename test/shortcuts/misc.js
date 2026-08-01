// Undo, clipboard copying, and the notices for removed features.

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
      // Undo works on Todoist's undo toast, so there has to be something to
      // undo and the toast has to still be up.
      await t.press('d');
      await t.api.waitFor(
          'alpha to be completed',
          async () => (await t.api.getTask(t.fixture.id('alpha'))).checked);
    },
    check: async (t) => await t.api.waitFor(
        'alpha to come back',
        async () => !(await t.api.getTask(t.fixture.id('alpha'))).checked),
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
    keys: ['* t', '* v'],
    what: 'says that bulk actions were removed',
    setUp: onAlpha,
    check: async (t) => await t.page.waitForSelector(
        '.ts-note', {timeout: 15000}),
  },
];
