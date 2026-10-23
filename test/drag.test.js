// Horizontal drags must change one level of nesting without reordering the
// task. A drop outside the row used to either do nothing or dedent too far.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');
const {pressBinding} = require('./lib/shortcut-runner');

describe('changing task nesting', {timeout: 120000}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;
  let parent = null;
  let child = null;

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create('nesting', ['nest-root', 'nest-last']);
    parent = await api.createTask({
      content: 'nest-parent', project_id: fixture.project.id,
      parent_id: fixture.id('nest-root'),
    });
    child = await api.createTask({
      content: 'nest-child', project_id: fixture.project.id,
      parent_id: parent.id,
    });
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  async function changeNesting(content, id, key, expectedParent) {
    await browser.putCursorOn(page, content);
    await pressBinding(page, key);
    await api.waitFor(content + ' to change parent with ' + key, async () =>
      (await api.getTask(id)).parent_id === expectedParent);
    await browser.waitForCursorOn(page, content);
    assert.deepEqual(
        await page.$$eval('#content .task_content', (els) =>
          els.map((el) => el.textContent)),
        ['nest-root', 'nest-parent', 'nest-child', 'nest-last'],
        'changing nesting should preserve task order');
  }

  it('changes one level at a time while keeping the cursor', async () => {
    await changeNesting(
        'nest-child', child.id, 'shift+h', fixture.id('nest-root'));
    await changeNesting('nest-child', child.id, 'shift+l', parent.id);
    await changeNesting(
        'nest-last', fixture.id('nest-last'), 'shift+l',
        fixture.id('nest-root'));
    await changeNesting(
        'nest-last', fixture.id('nest-last'), 'shift+h', null);
  });
});
