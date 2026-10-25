// Real Chrome settings and keyboard integration; no Todoist account is used.
const assert = require('node:assert/strict');
const path = require('node:path');
const {after, before, describe, it} = require('node:test');
const puppeteer = require('puppeteer-core');

const SRC = path.join(__dirname, '../src');
const selector = (action) =>
  'textarea[data-mode="default"][data-action="' + action + '"]';
const preferences = {
  'mouse-behavior': 'focus-follows-mouse',
  'cursor-movement': 'always-follows-task',
};

describe('shortcut editor and runtime', () => {
  let chrome = null;
  let extensionId = null;
  before(async () => {
    chrome = await puppeteer.launch({
      executablePath: process.env.TS_TEST_CHROME || '/opt/google/chrome/chrome',
      headless: true, pipe: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: ['--enable-unsafe-extension-debugging'],
    });
    extensionId = await chrome.installExtension(SRC);
  });
  after(async () => { if (chrome) await chrome.close(); });

  async function optionsPage(options, withPrefix) {
    const page = await chrome.newPage();
    page.setDefaultTimeout(5000);
    if (withPrefix) {
      // Exercise the optional control supplied by the independent prefix PR.
      // On the combined tree that real control is already present.
      await page.evaluateOnNewDocument(() => {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.getElementById('selection-prefix')) return;
          const select = document.createElement('select');
          select.id = 'selection-prefix';
          for (const value of ['*', ',', ';']) {
            const option = document.createElement('option');
            option.value = value; option.textContent = value;
            select.appendChild(option);
          }
          document.body.prepend(select);
        });
      });
    }
    await page.goto('chrome-extension://' + extensionId + '/options-page.html');
    await page.waitForSelector('input[name="mouse-behavior"]:checked');
    await page.evaluate(async (value) => {
      await chrome.storage.sync.set({options: JSON.stringify(value)});
    }, Object.assign({}, preferences, options));
    await page.reload();
    await page.waitForSelector('#always-follows-task:checked');
    return page;
  }
  async function saved(page) {
    return await page.evaluate(async () =>
      JSON.parse((await chrome.storage.sync.get('options')).options));
  }
  async function fill(page, action, value) {
    const query = selector(action);
    assert.ok(await page.$(query), 'action has a labeled editor: ' + action);
    await page.$eval(query, (el) => { el.value = ''; });
    await page.type(query, value);
  }
  async function saveShortcuts(page) {
    await page.click('#save-keybindings');
    await page.waitForFunction(() =>
      document.getElementById('keybindings-status').textContent ===
      'Shortcuts saved. Reload your Todoist tabs.');
  }
  async function localPage(options) {
    const page = await chrome.newPage();
    page.setDefaultTimeout(5000);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (/^https?:/.test(request.url())) request.abort();
      else request.continue();
    });
    await page.setContent(
        '<div id="todoist_app"><div id="content"></div></div>' +
        '<input id="typing">');
    await page.evaluate((value) => {
      document.onkeydown = () => {};
      document.onkeypress = () => {};
      document.onkeyup = () => {};
      document.body.setAttribute(
          'data-todoist-shortcuts-options', JSON.stringify(value));
      window.bodyClicks = 0;
      document.body.addEventListener('click', (event) => {
        if (event.target === document.body) window.bodyClicks++;
      });
    }, options);
    await page.addScriptTag({path: path.join(SRC, 'mousetrap.js')});
    await page.addScriptTag({path: path.join(SRC, 'todoist-shortcuts.js')});
    return page;
  }

  it('saves aliases, preserves fields and restores the form', async () => {
    const page = await optionsPage({
      'keybindings': {future_mode: {future_action: []}},
      'future-option': 'keep',
    });
    try {
      await fill(page, 'deselect-all', '; n\n; x');
      await saveShortcuts(page);
      let value = await saved(page);
      assert.deepEqual(value.keybindings.default['deselect-all'],
          ['; n', '; x']);
      assert.equal(value['future-option'], 'keep');
      assert.deepEqual(value.keybindings.future_mode, {future_action: []});
      await page.reload();
      await page.waitForSelector(selector('deselect-all'));
      assert.equal(await page.$eval(selector('deselect-all'), (el) => el.value),
          '; n\n; x');
      await page.click('#no-mouse-behavior');
      await page.waitForFunction(async () => {
        const values = await chrome.storage.sync.get('options');
        const value = JSON.parse(values.options);
        return value['mouse-behavior'] === 'no-mouse-behavior';
      });
      value = await saved(page);
      assert.deepEqual(value.keybindings.default['deselect-all'],
          ['; n', '; x']);
    } finally { await page.close(); }
  });

  it('rejects conflicts without writing invalid settings', async () => {
    const page = await optionsPage({keybindings: {}});
    try {
      await fill(page, 'deselect-all', 'd');
      await page.click('#save-keybindings');
      await page.waitForFunction(() =>
        document.getElementById('keybindings-errors').textContent
            .includes('conflicts'));
      assert.deepEqual((await saved(page)).keybindings, {});
    } finally { await page.close(); }
  });

  it('disables and resets actions only when saved', async () => {
    const page = await optionsPage({keybindings: {}});
    try {
      await fill(page, 'done', '');
      await saveShortcuts(page);
      assert.deepEqual((await saved(page)).keybindings.default.done, []);
      await page.click('button[data-reset="default:done"]');
      assert.equal(await page.$eval(selector('done'), (el) => el.value), 'd');
      assert.deepEqual((await saved(page)).keybindings.default.done, []);
      await saveShortcuts(page);
      assert.deepEqual((await saved(page)).keybindings, {});
      await fill(page, 'deselect-all', '; n');
      await saveShortcuts(page);
      await page.click('#reset-keybindings');
      assert.deepEqual((await saved(page)).keybindings.default['deselect-all'],
          ['; n']);
      await saveShortcuts(page);
      assert.deepEqual((await saved(page)).keybindings, {});
    } finally { await page.close(); }
  });

  it('revalidates against preferences changed by another page', async () => {
    const page = await optionsPage({keybindings: {}});
    try {
      await fill(page, 'deselect-all', '; a');
      await page.evaluate(async () => {
        const values = await chrome.storage.sync.get('options');
        const options = JSON.parse(values.options);
        options['selection-prefix'] = ';';
        await chrome.storage.sync.set({options: JSON.stringify(options)});
      });
      await page.click('#save-keybindings');
      await page.waitForFunction(() =>
        document.getElementById('keybindings-errors').textContent
            .includes('conflicts'));
      assert.deepEqual((await saved(page)).keybindings, {});
    } finally { await page.close(); }
  });

  it('autosave retains saved bindings and unsaved drafts', async () => {
    const page = await optionsPage({
      keybindings: {default: {'deselect-all': ['; n']}},
    });
    try {
      await fill(page, 'done', '');
      await page.click('#no-mouse-behavior');
      await page.waitForFunction(async () => {
        const values = await chrome.storage.sync.get('options');
        return JSON.parse(values.options)['mouse-behavior'] ===
          'no-mouse-behavior';
      });
      assert.deepEqual((await saved(page)).keybindings,
          {default: {'deselect-all': ['; n']}});
      assert.equal(await page.$eval(selector('done'), (el) => el.value), '');
    } finally { await page.close(); }
  });

  for (const invalid of [null, 'invalid']) {
    it('repairs displayed defaults for malformed mode ' + invalid, async () => {
      const page = await optionsPage({keybindings: {default: invalid}});
      try {
        await saveShortcuts(page);
        assert.deepEqual((await saved(page)).keybindings, {});
      } finally { await page.close(); }
    });
  }

  it('rejects a prefix change conflicting with saved overrides', async () => {
    const page = await optionsPage({
      'selection-prefix': '*',
      'keybindings': {default: {'deselect-all': ['; a']}},
    }, true);
    try {
      await page.select('#selection-prefix', ';');
      await page.waitForFunction(() =>
        document.getElementById('keybindings-errors').textContent
            .includes('conflicts'));
      assert.equal((await saved(page))['selection-prefix'], '*');
      assert.equal(
          await page.$eval('#selection-prefix', (el) => el.value), '*');
      assert.deepEqual((await saved(page)).keybindings,
          {default: {'deselect-all': ['; a']}});
    } finally { await page.close(); }
  });

  it('dispatches aliases, removes old keys, and protects typing', async () => {
    const page = await localPage({
      keybindings: {default: {'deselect-all': ['; n', '; x']}},
    });
    try {
      for (const key of [';', 'n', ';', 'x']) await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => window.bodyClicks), 2);
      for (const key of ['*', 'n']) await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => window.bodyClicks), 2);
      await page.focus('#typing');
      await page.keyboard.type(';n;x');
      assert.equal(await page.$eval('#typing', (el) => el.value), ';n;x');
      assert.equal(await page.evaluate(() => window.bodyClicks), 2);
    } finally { await page.close(); }
  });

  it('shows effective overrides and disabled actions in help', async () => {
    const page = await localPage({keybindings: {default: {
      'deselect-all': ['; n'], 'done': [],
    }}});
    try {
      await page.keyboard.press('?');
      await page.waitForSelector('.ts-active-bindings');
      const help = await page.$eval(
          '.ts-active-bindings', (el) => el.textContent);
      assert.ok(help.includes('; n'));
      assert.ok(help.includes('Disabled'));
    } finally { await page.close(); }
  });

  it('applies saved options through content-script startup', async () => {
    const options = await optionsPage({
      keybindings: {default: {'deselect-all': ['; n']}},
    });
    const page = await chrome.newPage();
    page.setDefaultTimeout(5000);
    try {
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        if (request.url() === 'https://app.todoist.com/app/prefix-test') {
          request.respond({contentType: 'text/html', body:
            '<div id="todoist_app"><div id="content"></div></div>' +
            '<script>document.onkeydown=()=>{};document.onkeypress=()=>{};' +
            'document.onkeyup=()=>{};window.bodyClicks=0;' +
            'document.body.addEventListener("click",e=>{' +
            'if(e.target===document.body)window.bodyClicks++});</script>'});
        } else if (/^https?:/.test(request.url())) request.abort();
        else request.continue();
      });
      await page.goto('https://app.todoist.com/app/prefix-test');
      await page.waitForFunction(() =>
        window.oldTodoistShortcutsDisableActions &&
        typeof window.TodoistShortcutsMousetrap === 'function');
      await page.keyboard.press(';');
      await page.keyboard.press('n');
      assert.equal(await page.evaluate(() => window.bodyClicks), 1);
    } finally {
      await options.close();
      await page.close();
    }
  });
});
