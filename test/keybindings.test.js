const assert = require('node:assert/strict');
const {describe, it} = require('node:test');
const readRegistry = require('./lib/registry');
const {readBindings} = require('./lib/bindings');

const plain = (value) => JSON.parse(JSON.stringify(value));
function registry() {
  const api = readRegistry();
  assert.ok(api, 'the options page can read the binding registry');
  return api;
}
function keys(result, mode, id) {
  return plain(result.keymaps.find((m) => m.id === mode)
      .bindings.find((b) => b.id === id).keys);
}

describe('persistent action bindings', () => {
  it('keeps every existing default spelling and inherited override', () => {
    const result = registry().resolve({});
    assert.deepEqual(plain(result.errors), []);
    for (const mode of ['default', 'schedule', 'task_view', 'menu_list']) {
      const actual = plain(result.keymaps.find((m) => m.id === mode).bindings
          .flatMap((b) => b.keys)).sort();
      const original = readBindings().filter((b) => b.keymap === mode)
          .map((b) => b.key).sort();
      assert.deepEqual(actual, original, mode);
    }
    assert.deepEqual(keys(result, 'schedule', 'keep-scheduled-task'),
        ['j', 'k', 'up', 'down']);
    assert.deepEqual(keys(result, 'bulk_schedule', 'cursor-down'),
        ['j', 'down']);
  });

  it('replaces every alias of one action and permits disabling', () => {
    const result = registry().resolve({default: {
      'delete-tasks': ['ctrl+e', '; e'],
      'deselect-all': [],
    }});
    assert.deepEqual(plain(result.errors), []);
    assert.deepEqual(keys(result, 'default', 'delete-tasks'),
        ['ctrl+e', '; e']);
    assert.deepEqual(keys(result, 'default', 'deselect-all'), []);
    assert.deepEqual(keys(result, 'task_view', 'delete-task'), ['e', '#']);
  });

  it('applies explicit overrides after the configured prefix', () => {
    const result = registry().resolve({default: {'select-all': ['; a']}},
        {'selection-prefix': ','});
    assert.deepEqual(plain(result.errors), []);
    assert.deepEqual(keys(result, 'default', 'select-all'), ['; a']);
    assert.deepEqual(keys(result, 'default', 'deselect-all'), [', n']);
  });

  it('allows the same sequence in different modes', () => {
    const result = registry().resolve({
      default: {'deselect-all': ['; a']},
      task_view: {'close-task-view': ['; a']},
    });
    assert.deepEqual(plain(result.errors), []);
  });

  for (const [what, overrides] of [
    ['a collision with an unchanged action',
      {default: {'deselect-all': ['d']}}],
    ['a sequence starting with an existing action',
      {default: {'deselect-all': ['g x']}}],
    ['duplicate equivalent aliases',
      {default: {'deselect-all': ['ctrl+left', 'control+ArrowLeft']}}],
    ['a conflicting uppercase spelling',
      {default: {'deselect-all': ['shift+g']}}],
    ['a shifted punctuation collision',
      {default: {'deselect-all': ['shift+3']}}],
    ['a shifted sequence collision',
      {default: {'help': ['shift+8 n']}}],
    ['an unsupported special key',
      {default: {'deselect-all': ['pause']}}],
    ['a reserved escape key',
      {default: {'deselect-all': ['escape x']}}],
    ['modifying a protected action',
      {schedule: {'keep-scheduled-task': []}}],
    ['a malformed combination', {default: {'deselect-all': ['ctrl+oops']}}],
    ['a modifier without a key', {default: {'deselect-all': ['ctrl']}}],
    ['a fallback handler', {default: {'deselect-all': ['fallback']}}],
    ['an invalid action value', {default: {'deselect-all': 'n'}}],
    ['an invalid mode value', {default: []}],
    ['an invalid top-level value', []],
  ]) {
    it('rejects ' + what + ' and keeps defaults usable', () => {
      const result = registry().resolve(overrides);
      assert.ok(result.errors.length, what);
      assert.deepEqual(keys(result, 'default', 'deselect-all'), ['* n']);
      assert.deepEqual(keys(result, 'default', 'done'), ['d']);
    });
  }

  it('ignores unknown future IDs without losing known overrides', () => {
    const result = registry().resolve({default: {
      'future-action': ['; z'], 'deselect-all': ['; n'],
    }, future_mode: {'other-action': []}});
    assert.deepEqual(plain(result.errors), []);
    assert.deepEqual(keys(result, 'default', 'deselect-all'), ['; n']);
  });

  it('does not mutate defaults across repeated resolutions', () => {
    const api = registry();
    api.resolve({default: {'delete-tasks': []}});
    assert.deepEqual(keys(api.resolve({}), 'default', 'delete-tasks'),
        ['e', '#']);
  });

  for (const [input, expected] of [
    ['Ctrl+Esc', 'ctrl+escape'],
    ['option+ArrowLeft', 'alt+left'],
    ['G', 'shift+g'],
    ['CTRL++', 'ctrl+shift+='],
    [';   n', '; n'],
    ['mod+x', 'meta+x'],
  ]) {
    it('recognizes equivalent spelling ' + input, () => {
      assert.equal(registry().normalize(input), expected);
    });
  }
});

describe('content-script startup ordering', () => {
  it('waits for options and injects ordered scripts once, even after an error',
      () => {
        const fs = require('node:fs');
        const path = require('node:path');
        const vm = require('node:vm');
        const scripts = [];
        const attributes = {};
        let loaded = null;
        let failed = null;
        const body = {
          setAttribute: (key, value) => { attributes[key] = value; },
          appendChild: (script) => {
            assert.ok(attributes['data-todoist-shortcuts-options']);
            assert.equal(script.async, false);
            scripts.push(script.src);
          },
        };
        vm.runInNewContext(fs.readFileSync(path.join(
            __dirname, '../src/inject.js'), 'utf8'), {
          document: {
            body,
            getElementsByTagName: () => [body],
            createElement: () => ({
              setAttribute(key, value) { this[key] = value; },
            }),
          },
          chrome: {runtime: {getURL: (value) => value}},
          console: {warn: () => {}},
          todoistShortcutsLoadOptions: (ok, error) => {
            loaded = ok; failed = error;
          },
        });
        assert.deepEqual(scripts, [], 'storage is still loading');
        failed(new Error('Storage unavailable'));
        loaded({keybindings: {}});
        assert.deepEqual(scripts, ['mousetrap.js', 'todoist-shortcuts.js']);
        assert.deepEqual(JSON.parse(
            attributes['data-todoist-shortcuts-options']), {});
      });
});

describe('damaged synced options', () => {
  for (const stored of ['null', '[]', '"invalid"', '{']) {
    it('loads usable defaults from ' + stored, () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const vm = require('node:vm');
      let loaded = null;
      const context = {
        console: {debug: () => {}},
        chrome: {storage: {sync: {
          get: (defaults, done) => done({options: stored}),
          set: (value, done) => { if (done) done(); },
        }}},
      };
      vm.createContext(context);
      vm.runInContext(fs.readFileSync(path.join(
          __dirname, '../src/common.js'), 'utf8'), context);
      context.todoistShortcutsLoadOptions(
          (options) => { loaded = options; }, () => {});
      assert.ok(loaded, 'damaged storage does not prevent initialization');
      assert.equal(Array.isArray(loaded), false);
      assert.equal(loaded['mouse-behavior'], 'focus-follows-mouse');
      assert.deepEqual(plain(loaded.keybindings), {});
    });
  }
});


describe('Mousetrap event identity', () => {
  for (const [sequence, code, shift, control] of [
    ['insert', 45, false, false],
    ['ctrl++', 187, true, true],
    ['ctrl+?', 191, true, true],
  ]) {
    it('dispatches the real library event for ' + sequence, () => {
      const fs = require('node:fs');
      const path = require('node:path');
      const vm = require('node:vm');
      const context = {window: {}, document: {}, navigator: {platform: 'Mac'}};
      vm.runInNewContext(fs.readFileSync(path.join(
          __dirname, '../src/mousetrap.js'), 'utf8'), context);
      const trap = new context.window.TodoistShortcutsMousetrap(
          context.document);
      let fired = 0;
      trap.bind(registry().normalize(sequence), () => { fired++; });
      trap.handleKeyEvent({
        type: 'keydown', which: code, keyCode: code, target: context.document,
        shiftKey: shift, ctrlKey: control, altKey: false, metaKey: false,
      });
      assert.equal(fired, 1);
    });
  }
});

describe('asynchronous storage failure', () => {
  it('reports errors so injection can install defaults', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const vm = require('node:vm');
    let callback = null;
    let error = null;
    let loaded = false;
    const context = {
      chrome: {runtime: {lastError: null}, storage: {sync: {
        get: (defaults, done) => { callback = done; },
      }}},
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(
        __dirname, '../src/common.js'), 'utf8'), context);
    context.todoistShortcutsLoadOptions(
        () => { loaded = true; }, (value) => { error = value; });
    context.chrome.runtime.lastError = {message: 'Storage unavailable'};
    assert.doesNotThrow(() => callback(undefined));
    assert.equal(loaded, false);
    assert.match(error.message, /Storage unavailable/);
  });
});
