// The one-time notice shown after an update.
//
// The point of it is that it appears once and then stops, so both halves of
// that are worth a test - a notice which came back on every page load would
// be worse than none at all.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const {readAnnouncement} = require('./lib/announcement');

const TIMEOUT = 180000;

const {seenKey: SEEN_KEY, id: ID} = readAnnouncement();

// Longer than the delay the announcement waits out before showing itself.
const SETTLE = 6000;

describe('the one-time announcement', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;

  const noteText = () => page.evaluate(() => {
    const note = document.querySelector('.ts-note');
    return note ? note.textContent : null;
  });

  // The rest of the suite opens pages which have already seen the notice, so
  // these have to ask for the real thing.
  const openAfterSettling = async () => {
    if (page) await page.close();
    page = await browser.openApp(chrome, 'today', {announcement: 'show'});
    await page.bringToFront();
    await browser.waitForTasks(page);
    await new Promise((resolve) => setTimeout(resolve, SETTLE));
  };

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    page = await browser.openApp(chrome, 'today', {announcement: 'show'});
    await browser.assertSameAccountAs(page, user);
    // Whether this profile has been shown it already is remembered, so start
    // from not having seen it.
    await page.evaluate(
        (key) => window.localStorage.removeItem(key), SEEN_KEY);
  });

  after(async () => {
    if (page) await page.close();
    if (chrome) await chrome.close();
  });

  it('shows the notice, and remembers doing so', async () => {
    await openAfterSettling();
    const text = await noteText();
    assert.ok(text, 'expected a note to have been put up');
    assert.match(text, /working again/);
    assert.equal(
        await page.evaluate(
            (key) => window.localStorage.getItem(key), SEEN_KEY),
        ID);
  });

  it('does not show it again', async () => {
    await openAfterSettling();
    assert.equal(
        await noteText(), null,
        'the notice came back on a later page load');
  });
});
