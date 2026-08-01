// Turns a table of shortcut descriptions into one test per key spelling.
//
// See test/shortcuts/index.js for the shape of a table entry.

const {after, afterEach, before, describe, it} = require('node:test');

const api = require('./api');
const browser = require('./browser');
const fixtures = require('./fixtures');

const TIMEOUT = 120000;

const DEFAULT_TASKS = ['alpha', 'beta', 'gamma'];

// Mousetrap spells some keys differently to puppeteer.
const PUPPETEER_KEYS = {
  'down': 'ArrowDown',
  'up': 'ArrowUp',
  'left': 'ArrowLeft',
  'right': 'ArrowRight',
  'escape': 'Escape',
  'enter': 'Enter',
  'space': 'Space',
  'tab': 'Tab',
};

const MODIFIERS = {
  'shift': 'Shift',
  'ctrl': 'Control',
  'alt': 'Alt',
  'meta': 'Meta',
};

// Presses a key written the way the keybindings are, like 'shift+o', 'alt+up'
// or the two key sequence '* a'.
//
// Modifiers are held down rather than relying on the shifted character:
// pressing 'O' arrives without the shift modifier, which is not what the
// binding is on.
async function pressBinding(page, binding) {
  for (const step of binding.split(' ')) {
    const parts = step.split('+');
    // 'ctrl+shift+,' and friends: the last part is the key, and a trailing
    // '+' means the key itself is '+'.
    const key = parts.pop() || '+';
    const modifiers = parts.map((name) => MODIFIERS[name]).filter(Boolean);
    for (const modifier of modifiers) {
      await page.keyboard.down(modifier);
    }
    try {
      await page.keyboard.press(PUPPETEER_KEYS[key] || key);
    } finally {
      for (const modifier of modifiers.reverse()) {
        await page.keyboard.up(modifier);
      }
    }
    await sleep(250);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Generates the tests for one table.
function runShortcutTable(title, table) {
  // The timeout is per test rather than on the suite: a suite timeout
  // cancels the tests which haven't run yet, turning one slow failure into a
  // page of them.
  describe(title, () => {
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
    });

    after(async () => {
      if (chrome) await chrome.close();
    });

    afterEach(async () => {
      if (page) await page.close();
      page = null;
      await fixtures.destroy(fixture);
      fixture = null;
    });

    for (const entry of table) {
      for (const key of entry.keys) {
        const name = describeKey(key) + ' ' + entry.what;
        // `broken` marks a shortcut which Todoist has broken and which hasn't
        // been fixed yet. The test still runs, but a failure is expected, so
        // the suite stays green and the list of them stays visible.
        const options = {timeout: TIMEOUT};
        if (entry.broken) options.todo = entry.broken;
        it(name, options, async () => {
          fixture = await fixtures.create(
              fixtureName(entry, key),
              (entry.tasks || DEFAULT_TASKS).map(toTaskFields));
          // Anything the fixture needs beyond a list of tasks - sections,
          // sub-tasks - is made before the page is opened, so that it is
          // there when the extension first sees the list.
          if (entry.seed) await entry.seed({api, fixture});
          page = await browser.openApp(
              chrome, entry.where || ('project/' + fixture.project.id));
          const complaints = browser.collectComplaints(page);
          await page.bringToFront();
          if (entry.where === undefined) await browser.waitForTasks(page);
          const context = {
            api, browser, chrome, complaints, fixture, key, page,
            press: (binding) => pressBinding(page, binding),
            sleep,
          };
          if (entry.setUp) await entry.setUp(context);
          await pressBinding(page, key);
          await sleep(entry.settle || 1000);
          await entry.check(context);
        });
      }
    }
  });
}

function toTaskFields(task) {
  return typeof task === 'string' ? {content: task} : task;
}

// Project names have to differ per test, since they run against one account.
function fixtureName(entry, key) {
  return (entry.keymap + '-' + key).replace(/[^a-z0-9+-]/gi, (c) =>
    '-' + c.charCodeAt(0));
}

function describeKey(key) {
  return '`' + key + '`';
}

module.exports = {DEFAULT_TASKS, pressBinding, runShortcutTable, sleep};
