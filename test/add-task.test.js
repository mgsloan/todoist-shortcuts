// Tests for adding tasks with `o`, `shift+o` and `a`.
//
// These broke when Todoist replaced the `.task_editor` element that the
// extension looked for with a differently structured one.

const assert = require('node:assert');
const {after, before, beforeEach, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 180000;

describe('adding tasks', {timeout: TIMEOUT}, () => {
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
    fixture = await fixtures.create(name, [
      {content: 'alpha'},
      {content: 'beta'},
    ]);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    complaints = browser.collectComplaints(page);
    await page.bringToFront();
    await browser.waitForTasks(page);
  };

  // Types into the editor which the shortcut just opened, and saves.
  const typeTask = async (content) => {
    await page.waitForFunction(
        () => Boolean(document.querySelector('.ProseMirror-focused')),
        {timeout: 30000});
    await new Promise((resolve) => setTimeout(resolve, 400));
    await page.keyboard.type(content);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await page.keyboard.press('Enter');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.keyboard.press('Escape');
    await new Promise((resolve) => setTimeout(resolve, 1500));
  };

  const contents = () => page.$$eval(
      '.task_list_item',
      (tasks) => tasks.map((task) => {
        const content = task.querySelector('.task_content');
        return content ? content.textContent : null;
      }));

  it('adds below the cursor with `o`', async () => {
    await open('below');
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 'o');
    await typeTask('added');
    assert.deepEqual(await contents(), ['alpha', 'added', 'beta']);
    assert.deepEqual(complaints, []);
  });

  it('adds above the cursor with `shift+o`', async () => {
    await open('above');
    await browser.putCursorOn(page, 'beta');
    await browser.pressShift(page, 'o');
    await typeTask('added');
    assert.deepEqual(await contents(), ['alpha', 'added', 'beta']);
    assert.deepEqual(complaints, []);
  });

  it('adds at the end with `a`', async () => {
    await open('bottom');
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 'a');
    await typeTask('added');
    assert.deepEqual(await contents(), ['alpha', 'beta', 'added']);
    assert.deepEqual(complaints, []);
  });

  it('leaves the cursor on the task just added', async () => {
    await open('cursor');
    await browser.putCursorOn(page, 'alpha');
    await browser.press(page, 'a');
    await typeTask('added');
    assert.equal(await browser.cursorContent(page), 'added');
  });
});
