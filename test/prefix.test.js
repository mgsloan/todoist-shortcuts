// These tests need Chrome, but no Todoist account: they exercise synced
// settings and the bindings registered with the real Mousetrap on a local page.
const assert = require('node:assert');
const path = require('node:path');
const {after, before, describe, it} = require('node:test');
const puppeteer = require('puppeteer-core');

const SRC = path.join(__dirname, '..', 'src');
const CHROME = process.env.TS_TEST_CHROME || '/opt/google/chrome/chrome';
const SUFFIXES = [
  'a', 'n', 'o', 's', '1', '2', '3', '4', '0',
  'h', 'left', 'l', 'right', 't', 'v',
];

describe('configurable selection prefix', () => {
  let chrome = null;
  let extensionId = null;

  before(async () => {
    // Puppeteer creates and removes a disposable profile. Never use the
    // logged-in integration-test profile for these account-free tests.
    chrome = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      pipe: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--enable-unsafe-extension-debugging'],
    });
    extensionId = await chrome.installExtension(SRC);
  });

  after(async () => {
    if (chrome) await chrome.close();
  });

  async function optionsPage(options) {
    const page = await chrome.newPage();
    await page.goto('chrome-extension://' + extensionId + '/options-page.html');
    // Let the first load finish canonicalizing before seeding settings, or
    // its asynchronous default write can race with the fixture's write.
    await page.waitForSelector('input[name="mouse-behavior"]:checked');
    await page.evaluate(async (value) => {
      await chrome.storage.sync.set({options: JSON.stringify(value)});
    }, options);
    await page.reload();
    await page.waitForSelector('#focus-follows-mouse:checked');
    return page;
  }

  async function shortcutsPage(options) {
    const page = await chrome.newPage();
    page.setDefaultTimeout(5000);
    // The help guide is remote; this suite must stay account-free and offline.
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) request.abort();
      else request.continue();
    });
    await page.setContent(
        '<div id="todoist_app"><div id="content"></div></div>' +
        '<input id="typing">');
    await page.evaluate((value) => {
      // The core replaces Todoist's property handlers; the Mousetrap fork
      // deliberately does not install independent event listeners.
      document.onkeydown = () => {};
      document.onkeypress = () => {};
      document.onkeyup = () => {};
      document.body.setAttribute(
          'data-todoist-shortcuts-options', JSON.stringify(value));
    }, options);
    await page.addScriptTag({path: path.join(SRC, 'mousetrap.js')});
    await page.evaluate(() => {
      const Mousetrap = window.TodoistShortcutsMousetrap;
      window.TodoistShortcutsMousetrap = class extends Mousetrap {
        constructor(target) {
          super(target);
          window.prefixTestMousetrap = this;
        }
      };
      window.prefixTestBodyClicks = 0;
      document.body.addEventListener('click', (event) => {
        if (event.target === document.body) window.prefixTestBodyClicks++;
      });
    });
    await page.addScriptTag({path: path.join(SRC, 'todoist-shortcuts.js')});
    await page.waitForFunction(() =>
      window.prefixTestMousetrap &&
      window.prefixTestMousetrap._directMap.menu_list);
    return page;
  }

  async function boundKeys(page) {
    return await page.evaluate(() => Object.keys(
        window.prefixTestMousetrap._directMap.default)
        .map((key) => key.split(':')[0]));
  }

  for (const prefix of ['*', ',', ';']) {
    it('registers the entire family with ' + prefix, async () => {
      const page = await shortcutsPage({'selection-prefix': prefix});
      try {
        const keys = await boundKeys(page);
        for (const suffix of SUFFIXES) {
          assert.ok(keys.includes(prefix + ' ' + suffix), suffix);
        }
        if (prefix !== '*') {
          assert.ok(!keys.some((key) => key.startsWith('* ')));
        }
        assert.ok(keys.includes('x'), 'single-task selection stays bound');
        assert.ok(keys.includes('ctrl+,'), 'modified comma stays bound');
      } finally {
        await page.close();
      }
    });
  }

  for (const value of [undefined, null, '', 'g', 'ctrl+x', [], {}]) {
    it('falls back to * for ' + JSON.stringify(value), async () => {
      const page = await shortcutsPage({'selection-prefix': value});
      try {
        assert.ok((await boundKeys(page)).includes('* a'));
      } finally {
        await page.close();
      }
    });
  }

  it('handles the custom sequence and leaves input typing alone', async () => {
    const page = await shortcutsPage({'selection-prefix': ','});
    try {
      await page.keyboard.press(',');
      await page.keyboard.press('n');
      assert.equal(await page.evaluate(() => window.prefixTestBodyClicks), 1);
      await page.focus('#typing');
      await page.keyboard.type(',n');
      assert.equal(await page.$eval('#typing', (el) => el.value), ',n');
      assert.equal(await page.evaluate(() => window.prefixTestBodyClicks), 1);
    } finally {
      await page.close();
    }
  });

  it('saves the choice and preserves unrelated settings', async () => {
    const page = await optionsPage({
      'mouse-behavior': 'focus-follows-mouse',
      'cursor-movement': 'always-follows-task',
      'selection-prefix': '*',
      'future-option': 'keep-me',
    });
    try {
      assert.ok(await page.$('#selection-prefix'), 'prefix control is present');
      await page.select('#selection-prefix', ',');
      await page.waitForFunction(async () => {
        const values = await chrome.storage.sync.get('options');
        return JSON.parse(values.options)['selection-prefix'] === ',';
      });
      await page.reload();
      await page.waitForSelector('#always-follows-task:checked');
      assert.equal(
          await page.$eval('#selection-prefix', (el) => el.value), ',');
      await page.click('#no-mouse-behavior');
      await page.waitForFunction(async () => {
        const values = await chrome.storage.sync.get('options');
        return JSON.parse(values.options)['mouse-behavior'] ===
          'no-mouse-behavior';
      });
      const saved = await page.evaluate(async () =>
        JSON.parse((await chrome.storage.sync.get('options')).options));
      assert.deepEqual(saved, {
        'mouse-behavior': 'no-mouse-behavior',
        'cursor-movement': 'always-follows-task',
        'selection-prefix': ',',
        'future-option': 'keep-me',
      });
    } finally {
      await page.close();
    }
  });

  for (const value of [undefined, 'g', null]) {
    it('canonicalizes missing/unsupported saved prefix ' + value, async () => {
      const page = await optionsPage({
        'mouse-behavior': 'focus-follows-mouse',
        'cursor-movement': 'follows-task-within-section',
        'selection-prefix': value,
      });
      try {
        const saved = await page.evaluate(async () =>
          JSON.parse((await chrome.storage.sync.get('options')).options));
        assert.equal(saved['selection-prefix'], '*');
      } finally {
        await page.close();
      }
    });
  }

  it('shows the active prefix above the default printable guide', async () => {
    const page = await shortcutsPage({'selection-prefix': ';'});
    try {
      await page.keyboard.press('?');
      await page.waitForSelector('.todoist_shortcuts_help');
      const help = await page.$eval(
          '.todoist_shortcuts_help', (el) => el.textContent);
      assert.ok(help.includes('; a'), 'shows the active selection sequence');
      assert.ok(help.includes('; t'), 'shows the active bulk sequence');
    } finally {
      await page.close();
    }
  });
});
