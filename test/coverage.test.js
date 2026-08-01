// Checks that every keybinding in src/todoist-shortcuts.js is either tested or
// deliberately excluded, so that adding a shortcut without a test fails.
//
// This test runs no browser, so it is quick.

const assert = require('node:assert');
const {describe, it} = require('node:test');

const {bindingId, readBindings} = require('./lib/bindings');
const {COVERED_ELSEWHERE, EXCLUDED, TABLES} = require('./shortcuts');

// Every binding id which some table claims to test.
function testedBindings() {
  const tested = new Map();
  for (const [name, table] of Object.entries(TABLES)) {
    for (const entry of table) {
      for (const key of entry.keys) {
        const id = bindingId(entry.keymap, key);
        if (tested.has(id)) {
          throw new Error(
              id + ' is in both the ' + tested.get(id) + ' and ' + name +
              ' tables');
        }
        tested.set(id, name);
      }
    }
  }
  return tested;
}

describe('shortcut coverage', () => {
  const bindings = readBindings();
  const tested = testedBindings();

  it('tests or excludes every binding', () => {
    const missing = bindings
        .map((binding) => bindingId(binding.keymap, binding.key))
        .filter((id) => !tested.has(id) && !(id in EXCLUDED) &&
                        !(id in COVERED_ELSEWHERE));
    assert.deepEqual(
        missing, [],
        missing.length + ' shortcut(s) have no test: add one to a table in ' +
        'test/shortcuts, or a reason to EXCLUDED');
  });

  it('has no tests for bindings which no longer exist', () => {
    const ids = new Set(
        bindings.map((binding) => bindingId(binding.keymap, binding.key)));
    const stale = [...tested.keys(), ...Object.keys(EXCLUDED),
      ...Object.keys(COVERED_ELSEWHERE)]
        .filter((id) => !ids.has(id));
    assert.deepEqual(
        stale, [], 'these are tested or excluded but are not bound any more');
  });

  it('found the bindings at all', () => {
    // A parser which silently stops matching would make the checks above
    // pass while testing nothing.
    assert.ok(
        bindings.length > 100,
        'expected well over 100 key spellings, found ' + bindings.length);
    for (const keymap of ['default', 'schedule', 'task_view', 'menu_list']) {
      assert.ok(
          bindings.some((binding) => binding.keymap === keymap),
          'no bindings parsed for the ' + keymap + ' keymap');
    }
  });
});
