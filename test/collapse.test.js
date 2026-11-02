// Bulk toggles must wait for Todoist to update before clicking again. Delay
// clicks on the live UI so that a fast machine still exercises that wait.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');
const {pressBinding} = require('./lib/shortcut-runner');

describe('bulk collapse and expand with delayed updates', () => {
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
    fixture = await fixtures.create('bulk-collapse', ['root', 'other']);
    for (const root of ['root', 'other']) {
      const child = await api.createTask({
        content: root + '-child', project_id: fixture.project.id,
        parent_id: fixture.id(root),
      });
      await api.createTask({
        content: root + '-leaf', project_id: fixture.project.id,
        parent_id: child.id,
      });
    }
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
    await page.waitForFunction(
        () => document.querySelectorAll('.task_list_item').length === 6);
    await page.evaluate(() => {
      const replayed = new WeakSet();
      window.tsTestCollapseClicks = [];
      document.addEventListener('click', (event) => {
        const toggle = event.target.closest(
            '[data-action-hint=task-toggle-collapse]');
        if (!toggle || replayed.has(event)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        const task = toggle.closest('.task_list_item');
        window.tsTestCollapseClicks.push(
            task.querySelector('.task_content').textContent);
        setTimeout(() => {
          const next = new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window,
          });
          replayed.add(next);
          toggle.dispatchEvent(next);
        }, 120);
      }, true);
    });
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  for (const [collapse, expand] of [['* h', '* l'], ['* left', '* right']]) {
    it(collapse + ' collapses each parent once', {timeout: 30000}, async () => {
      await toggle(collapse, 2);
    });
    it(expand + ' expands every level once', {timeout: 30000}, async () => {
      await toggle(expand, 6);
    });
  }

  async function toggle(key, count) {
    await page.evaluate(() => {
      window.tsTestCollapseClicks = [];
    });
    await pressBinding(page, key);
    const clicks = await page.evaluate(() => window.tsTestCollapseClicks);
    assert.equal(new Set(clicks).size, clicks.length,
        key + ' clicked a parent again before its toggle finished: ' + clicks);
    await page.waitForFunction((expected) =>
      document.querySelectorAll('.task_list_item').length === expected,
    {timeout: 15000}, count);
    const finished = await page.evaluate(() => window.tsTestCollapseClicks);
    assert.equal(new Set(finished).size, finished.length,
        key + ' should toggle each parent at most once');
    if (count === 2) {
      // Collapse children before hiding them, so expanding must walk the
      // newly revealed levels. Todoist can also restore an expanded child
      // from its cache; expansion should leave those alone.
      assert.deepEqual(finished.sort(),
          ['other', 'other-child', 'root', 'root-child']);
    }
  }
});
