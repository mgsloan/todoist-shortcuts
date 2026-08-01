// Tests for switching a view's layout with shift+v.
//
// https://github.com/mgsloan/todoist-shortcuts/issues/288

const assert = require('node:assert');
const {after, before, beforeEach, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 180000;

const LAYOUTS = ['list', 'board', 'calendar'];

describe('switching layout', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;
  let complaints = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
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

  const open = async (name) => {
    fixture = await fixtures.create(name, [{content: 'alpha'}]);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    complaints = browser.collectComplaints(page);
    await page.bringToFront();
    await browser.waitForTasks(page);
  };

  const layout = () => page.evaluate((layouts) => {
    const found = layouts.find((name) => document.querySelector(
        '[data-testid="project-' + name + '-view"]'));
    return found || 'unknown';
  }, LAYOUTS);

  // Presses shift+v and waits for the layout to change.
  const switchLayout = async () => {
    const before = await layout();
    await browser.pressShift(page, 'v');
    for (let i = 0; i < 40; i++) {
      const now = await layout();
      if (now !== before) return now;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return await layout();
  };

  it('cycles through the layouts and back to where it started', async () => {
    await open('cycle');
    assert.equal(await layout(), 'list');
    // How many layouts there are depends on the account's plan - the calendar
    // layout is only offered to Todoist Pro and Business customers - so this
    // presses until it comes back around rather than expecting a fixed
    // sequence.
    const visited = [];
    for (let i = 0; i < LAYOUTS.length; i++) {
      const now = await switchLayout();
      visited.push(now);
      if (now === 'list') break;
    }
    assert.ok(
        visited.includes('board'),
        'expected the board layout on the way round, visited ' + visited);
    assert.equal(
        visited[visited.length - 1], 'list',
        'expected to end up back on the list layout, visited ' + visited);
    assert.deepEqual(complaints, []);
  });

  it('leaves no menu open behind it', async () => {
    // The view options menu is how the layout gets switched. Leaving it open
    // would swallow the next press rather than switching layout again.
    await open('menu');
    await switchLayout();
    // The menu is closed after the layout has switched, so this waits rather
    // than checking the instant the layout changes.
    await page.waitForFunction(
        () => !document.querySelector('input[type="radio"][id="LIST"]'),
        {timeout: 15000});
  });
});
