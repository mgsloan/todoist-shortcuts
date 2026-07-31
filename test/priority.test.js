// Regression tests for setting priority with the 1-4 keys.
//
// https://github.com/mgsloan/todoist-shortcuts/issues/284: the cursor case
// left the task editor open awaiting a manual save, the multi-select case did
// nothing at all, and the task view case needed the key pressed twice.

const assert = require('node:assert');
const {after, before, beforeEach, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 120000;

// p4, the priority tasks get when none is specified.
const NONE = api.priorityOfLevel('4');

describe('setting priority', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const page = await browser.openApp(chrome);
    await browser.assertSameAccountAs(page, user);
    await page.close();
    await fixtures.destroyStale();
  });

  after(async () => {
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  beforeEach(async () => {
    if (page) await page.close();
    page = null;
    await fixtures.destroy(fixture);
    fixture = null;
  });

  const openFixture = async (name, contents) => {
    fixture = await fixtures.create(name, contents);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
    return fixture;
  };

  it('applies to the task at the cursor', async () => {
    await openFixture('cursor', [{content: 'alpha', priority: NONE}]);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, '1');
    const urgent = api.priorityOfLevel('1');
    assert.equal(
        await api.waitForPriority(fixture.id('alpha'), urgent), urgent);
  });

  it('does not leave an editor open awaiting a save', async () => {
    await openFixture('no-editor', [{content: 'alpha', priority: NONE}]);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, '2');
    await api.waitForPriority(fixture.id('alpha'), api.priorityOfLevel('2'));
    assert.equal(
        await page.$$eval('.task_editor', (els) => els.length), 0,
        'the task editor should not be open');
  });

  it('applies to every selected task', async () => {
    await openFixture('selection', [
      {content: 'alpha', priority: NONE},
      {content: 'beta', priority: NONE},
    ]);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 'x');
    await browser.press(page, 'j');
    await browser.press(page, 'x');
    await browser.press(page, '2');
    for (const content of ['alpha', 'beta']) {
      assert.equal(
          await api.waitForPriority(
              fixture.id(content), api.priorityOfLevel('2')),
          api.priorityOfLevel('2'),
          content + ' should have been given priority 2');
    }
  });

  it('applies in the task view on the first press', async () => {
    await openFixture('task-view', [{content: 'alpha', priority: NONE}]);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 'i');
    await page.waitForSelector('div[data-testid="task-details-modal"]');
    await browser.press(page, '3');
    const expected = api.priorityOfLevel('3');
    assert.equal(
        await api.waitForPriority(fixture.id('alpha'), expected), expected);
  });

  it('can clear the priority again', async () => {
    await openFixture('clear', [
      {content: 'alpha', priority: api.priorityOfLevel('1')},
    ]);
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, '4');
    assert.equal(await api.waitForPriority(fixture.id('alpha'), NONE), NONE);
  });
});
