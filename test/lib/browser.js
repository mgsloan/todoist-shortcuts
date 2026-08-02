// Launches Chrome with the in-development extension loaded, against a
// dedicated user data directory.
//
// The user data directory is deliberately separate from any Chrome profile
// used for a real account: these tests create, modify and delete tasks, so
// they must only ever run against the throwaway test account.  Log that
// account in once with `npm run test:login`; the session persists in the
// profile directory.

const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

const PROFILE_DIR = process.env.TS_TEST_PROFILE ||
      path.join(os.homedir(), '.cache', 'todoist-shortcuts-test-profile');

const CHROME = process.env.TS_TEST_CHROME || '/opt/google/chrome/chrome';

const APP_URL = 'https://app.todoist.com/app/';

async function launch(options) {
  const opts = options || {};
  const chrome = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir: PROFILE_DIR,
    headless: process.env.TS_TEST_HEADLESS === '1',
    defaultViewport: null,
    // Installing the extension goes over the CDP Extensions domain, which is
    // only available over a debugging pipe.
    pipe: true,
    // Puppeteer passes --disable-extensions by default, which of course
    // defeats the entire point here.
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      // Chrome ignores --load-extension these days; loading has to go through
      // Extensions.loadUnpacked, which this switch enables.
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1400,900',
    ].concat(opts.args || []),
  });
  if (opts.extension !== false) {
    await chrome.installExtension(SRC_DIR);
  }
  // So that tests can read what the copying shortcuts put on the clipboard.
  await chrome.defaultBrowserContext().overridePermissions(
      'https://app.todoist.com', ['clipboard-read', 'clipboard-write']);
  return chrome;
}

// Opens a Todoist page and waits for both Todoist and the extension to be
// ready.  `where` is a path relative to the app, e.g. 'project/123'.
// Note that each of these makes a new page rather than navigating an existing
// one: Todoist's router turns a same-tab navigation into a same-document one,
// which never fires the lifecycle events puppeteer waits for.
async function openApp(browser, where) {
  const page = await browser.newPage();
  // An unsaved editor can otherwise leave a beforeunload dialog blocking
  // everything.
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(
      APP_URL + (where || 'today'), {waitUntil: 'domcontentloaded'});
  if (page.url().includes('/auth/')) {
    throw new Error(
        'The test profile is not logged in. Run `npm run test:login`.');
  }
  await waitForExtension(page);
  return page;
}

// Returns {id, email} of the account the page is logged in as.  Todoist keeps
// this in local storage; the auth token is in there too and is deliberately
// not read here.
async function accountOfPage(page) {
  return await page.evaluate(() => {
    const identity = JSON.parse(localStorage.getItem('auth_identity') || '{}');
    return {id: String(identity.id), email: identity.email};
  });
}

// Refuses to go any further unless the browser is logged in as the same
// account as the API token.  Everything else in the suite assumes it can
// create and delete data freely, so this is the check that keeps a
// misconfigured profile from typing shortcuts at somebody's real tasks.
async function assertSameAccountAs(page, apiUser) {
  const account = await accountOfPage(page);
  if (!account.id || account.id !== String(apiUser.id)) {
    throw new Error(
        'Refusing to run: the browser is logged in as ' +
        (account.email || 'nobody') + ' but the API token belongs to ' +
        apiUser.email + '. Run `npm run test:login` and log in as the test ' +
        'account.');
  }
  return account;
}

async function waitForExtension(page) {
  // mousetrap.js is injected as a page script by the content script, so its
  // presence means the extension actually ran on this page.
  await page.waitForFunction(
      () => typeof window.TodoistShortcutsMousetrap === 'function',
      {timeout: 30000});
}

async function waitForTasks(page) {
  await page.waitForSelector('.task_list_item', {timeout: 30000});
  // The cursor is placed asynchronously once the list settles.
  await page.waitForFunction(
      CURSOR_CONTENT_JS + '() !== null', {timeout: 30000});
}

// todoist-shortcuts marks the cursor by generating CSS which draws a border on
// the task with the cursor's id, rather than by adding a class, so this looks
// for that border.  Returns the text of the task at the cursor, or null.
const CURSOR_CONTENT_JS = `(() => {
  const tasks = [...document.querySelectorAll('.task_list_item')];
  const cursor = tasks.find((task) => {
    const style = getComputedStyle(task);
    // Not an exact width comparison: it comes back scaled by the device
    // pixel ratio, e.g. "1.9542px".
    return style.borderLeftColor === 'rgb(64, 115, 214)' &&
        parseFloat(style.borderLeftWidth) > 1;
  });
  const content = cursor && cursor.querySelector('.task_content');
  return content ? content.textContent : null;
})`;

async function cursorContent(page) {
  return await page.evaluate(CURSOR_CONTENT_JS + '()');
}

// Waits for the cursor to land on the task with the given content.
async function waitForCursorOn(page, content, timeout = 15000) {
  try {
    await page.waitForFunction(
        '(' + CURSOR_CONTENT_JS + '()) === ' + JSON.stringify(content),
        {timeout: timeout});
  } catch (e) {
    throw new Error(
        'The cursor never reached ' + JSON.stringify(content) + '; it is on ' +
        JSON.stringify(await cursorContent(page)));
  }
}

async function selectedContents(page) {
  return await page.$$eval(
      '.task_list_item',
      (tasks) => tasks
          .filter((t) => t.classList.contains('selected') ||
                         t.getAttribute('aria-selected') === 'true')
          .map((t) => {
            const content = t.querySelector('.task_content');
            return content ? content.textContent : null;
          }));
}

// Moves the cursor onto the task with the given content, by going to the first
// task and then pressing 'j' until it gets there.  Clicking the task would open
// the task view instead.  Starting from the top matters because changing a
// task's priority can reorder the list.
async function putCursorOn(page, content) {
  await waitForTasks(page);
  await press(page, '^');
  const count = await page.$$eval('.task_list_item', (els) => els.length);
  for (let i = 0; i <= count; i++) {
    if (await cursorContent(page) === content) return;
    await press(page, 'j');
  }
  throw new Error('Never found a task with content ' + JSON.stringify(content));
}

// Presses a key the way a user would.  Puppeteer dispatches these through the
// browser, so they are trusted events and reach the extension's keybindings.
async function press(page, key) {
  await page.keyboard.press(key);
  await new Promise((resolve) => setTimeout(resolve, 250));
}

// Presses a key with shift held.  Note that this is not the same as pressing
// the shifted character: press(page, 'O') arrives without the shift modifier,
// which is what the bindings match on.
async function pressShift(page, key) {
  await page.keyboard.down('Shift');
  await page.keyboard.press(key);
  await page.keyboard.up('Shift');
  await new Promise((resolve) => setTimeout(resolve, 250));
}

// Collects the warnings and errors the extension logs, which is how it reports
// not finding something it expected in Todoist's DOM.  Returns an array which
// fills up as the page runs.
function collectComplaints(page) {
  const complaints = [];
  page.on('console', (message) => {
    const type = message.type();
    const text = message.text().split('\n')[0].trim();
    // Puppeteer reports console.warn as 'warn', not 'warning'.
    if ((type === 'warn' || type === 'warning' || type === 'error') &&
        text.includes('todoist-shortcuts')) {
      complaints.push(text);
    }
  });
  return complaints;
}

module.exports = {
  APP_URL,
  PROFILE_DIR,
  accountOfPage,
  assertSameAccountAs,
  collectComplaints,
  cursorContent,
  launch,
  selectedContents,
  openApp,
  press,
  pressShift,
  putCursorOn,
  waitForCursorOn,
  waitForExtension,
  waitForTasks,
};
