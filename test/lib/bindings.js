// Reads the keybindings out of src/todoist-shortcuts.js.
//
// The point of this is the coverage test: parsing the real bindings means a
// shortcut cannot be added without also being tested or explicitly excluded.
// It parses the source rather than running it because the bindings live inside
// an IIFE which expects to be in a page with Todoist loaded.

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
    __dirname, '..', '..', 'src', 'todoist-shortcuts.js');

// Which array of bindings ends up in which keymap.  The cursor bindings are
// concatenated into the default keymap, and are also wrapped into the schedule
// keymap by a loop over them, so they appear in both.
const ARRAYS = [
  {array: 'CURSOR_BINDINGS', keymaps: ['default', 'schedule']},
  {array: 'KEY_BINDINGS', keymaps: ['default']},
  {array: 'SCHEDULE_BINDINGS', keymaps: ['schedule']},
  {array: 'TASK_VIEW_BINDINGS', keymaps: ['task_view']},
  {array: 'MENU_LIST_BINDINGS', keymaps: ['menu_list']},
];

// Finds the text of `const <name> = ...;` up to the line which closes it.
function arrayBody(source, name) {
  const start = source.indexOf('const ' + name + ' = ');
  if (start < 0) throw new Error('No ' + name + ' in ' + SOURCE);
  // Every one of these arrays ends with a line consisting of `]);` or `];`.
  const rest = source.substring(start);
  const match = /^[\s\S]*?\n\s*\]\)?;/.exec(rest);
  if (!match) throw new Error('Could not find the end of ' + name);
  return match[0];
}

// Entries look like ['x', action] or [['x', 'y'], action].
const ENTRY = /^\s*\[\s*(\[[^\]]*\]|'(?:[^'\\]|\\.)*')\s*,\s*([A-Za-z0-9_]+)/gm;

function parseKeys(text) {
  if (!text.startsWith('[')) {
    return [unquote(text)];
  }
  return (text.match(/'(?:[^'\\]|\\.)*'/g) || []).map(unquote);
}

function unquote(text) {
  return text.replace(/^'|'$/g, '').replace(/\\(.)/g, '$1');
}

// Returns [{keymap, key, keys, action}], one entry per key spelling.
//
// A key bound twice in the same keymap keeps the later binding, which is what
// mousetrap does. That is not hypothetical: the schedule keymap takes the
// cursor bindings and then binds j / k / up / down to noop, so those keys do
// nothing while the scheduler is open.
function readBindings() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const found = new Map();
  for (const {array, keymaps} of ARRAYS) {
    const body = arrayBody(source, array);
    ENTRY.lastIndex = 0;
    let match = null;
    while ((match = ENTRY.exec(body)) !== null) {
      const keys = parseKeys(match[1]);
      for (const keymap of keymaps) {
        for (const key of keys) {
          found.set(bindingId(keymap, key), {
            keymap, key, keys, action: match[2],
          });
        }
      }
    }
  }
  if (!found.size) throw new Error('Parsed no bindings at all');
  return [...found.values()];
}

// 'default:x' etc, which is how tables and exclusions refer to a binding.
function bindingId(keymap, key) {
  return keymap + ':' + key;
}

module.exports = {SOURCE, bindingId, readBindings};
