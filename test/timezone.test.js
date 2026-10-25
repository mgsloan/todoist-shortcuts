// Calendar checks must not pass only because CI and Todoist happen to be on
// the same date when the suite runs. Include midnight and DST boundaries.
const assert = require('node:assert');
const {it} = require('node:test');
const api = require('./lib/api');
const browser = require('./lib/browser');

const INSTANTS = [
  '2026-10-25T05:30:00Z',
  '2026-03-08T08:30:00Z',
  '2026-03-08T09:30:00Z',
  '2026-11-01T07:30:00Z',
  '2026-11-01T08:30:00Z',
].map(Date.parse);

// This function also runs in Chrome, so it has no module dependencies.
function localClocks(instants) {
  return instants.map((instant) => {
    const date = new Date(instant);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate(),
      date.getHours(), date.getMinutes()];
  });
}

it('keeps Node and Chrome clocks aligned with the Todoist account', {
  timeout: 60000,
}, async () => {
  const user = await api.getUser();
  const format = new Intl.DateTimeFormat('en', {
    timeZone: user.tz_info.timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  });
  const expected = INSTANTS.map((instant) => {
    const parts = Object.fromEntries(format.formatToParts(instant)
        .map(({type, value}) => [type, value]));
    return ['year', 'month', 'day', 'hour', 'minute']
        .map((field) => Number(parts[field]));
  });
  assert.deepEqual(localClocks(INSTANTS), expected,
      'Node must use the Todoist account timezone');
  let chrome = null;
  try {
    chrome = await browser.launch();
    const page = await browser.openApp(chrome);
    await browser.assertSameAccountAs(page, user);
    assert.deepEqual(await page.evaluate(localClocks, INSTANTS), expected,
        'Chrome must use the Todoist account timezone');
  } finally {
    if (chrome) await chrome.close();
  }
});
