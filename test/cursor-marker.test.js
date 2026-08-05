// Tests for the bar the cursor is drawn as.
//
// It used to be a left border paid for with a negative margin, which had two
// problems.  A border is snapped to whole device pixels and a margin is not,
// so on a screen scaled by 1.25 they did not cancel out and the task under the
// cursor sat a fraction of a pixel to the left of where it sat without it.  And
// a task's body is positioned and reaches out past the left of the task, so
// when the task was selected the body's grey background covered the border and
// the cursor could not be seen at all.
//
// The tests run at a scale of 1.25 for the first of those: at 1 and 1.5 the
// rounding happened to come out even.

const assert = require('node:assert');
const {after, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 180000;

// The left edge of a task's text, which is what visibly moves if the marker
// takes up space.
const CONTENT_LEFT = `((wanted) => {
  const task = [...document.querySelectorAll('.task_list_item')].find((t) => {
    const c = t.querySelector('.task_content');
    return c && c.textContent === wanted;
  });
  if (!task) return null;
  return task.querySelector('.task_content').getBoundingClientRect().left;
})`;

describe('the cursor marker', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  let fixture = null;

  // A picture of the leftmost sliver of a task, which is where the marker is
  // drawn.  Comparing two of these is the only way to tell that the marker was
  // actually painted rather than merely asked for: a computed style says
  // nothing about what ended up on top.
  async function markerStrip(content) {
    const clip = await page.evaluate((wanted) => {
      const task = [...document.querySelectorAll('.task_list_item')].find(
          (t) => {
            const c = t.querySelector('.task_content');
            return c && c.textContent === wanted;
          });
      const r = task.getBoundingClientRect();
      return {x: r.left, y: r.top + 3, width: 2, height: r.height - 6};
    }, content);
    return await page.screenshot({clip: clip, encoding: 'base64'});
  }

  async function contentLeft(content) {
    return await page.evaluate(CONTENT_LEFT + '(' + JSON.stringify(content) +
        ')');
  }

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch({args: ['--force-device-scale-factor=1.25']});
    const first = await browser.openApp(chrome);
    await browser.assertSameAccountAs(first, user);
    await first.close();
    await fixtures.destroyStale();
    fixture = await fixtures.create('cursor-marker', ['mark-one', 'mark-two']);
    page = await browser.openApp(chrome, 'project/' + fixture.project.id);
    await page.bringToFront();
    await browser.waitForTasks(page);
  });

  after(async () => {
    if (page) await page.close();
    await fixtures.destroy(fixture);
    if (chrome) await chrome.close();
  });

  it('does not move the task it is on', async () => {
    await browser.putCursorOn(page, 'mark-one');
    const withCursor = await contentLeft('mark-one');
    await browser.press(page, 'j');
    await browser.waitForCursorOn(page, 'mark-two');
    const withoutCursor = await contentLeft('mark-one');
    assert.equal(
        withCursor, withoutCursor,
        'the task moved by ' + (withCursor - withoutCursor) +
        'px when the cursor arrived');
  });

  it('can still be seen when the task is selected', async () => {
    // The same task with the cursor and then without it, rather than two
    // different tasks: the selected background has a rounded corner at the top
    // of the run of them, so two tasks differ down their left edge whether the
    // marker is there or not.  Both are selected so that only the cursor moves
    // between the two pictures.
    await browser.putCursorOn(page, 'mark-one');
    await browser.press(page, 'x');
    await browser.press(page, 'j');
    await browser.press(page, 'x');
    await browser.waitForCursorOn(page, 'mark-two');
    assert.deepEqual(
        (await browser.selectedContents(page)).sort(),
        ['mark-one', 'mark-two'],
        'expected both tasks to be selected');
    const withCursor = await markerStrip('mark-two');
    await browser.press(page, 'k');
    await browser.waitForCursorOn(page, 'mark-one');
    const withoutCursor = await markerStrip('mark-two');
    assert.notEqual(
        withCursor, withoutCursor,
        'a selected task looks the same down its left edge with the cursor ' +
        'on it as without, so the marker is being painted over');
    await browser.press(page, 'x');
    await browser.press(page, 'j');
    await browser.press(page, 'x');
  });
});
