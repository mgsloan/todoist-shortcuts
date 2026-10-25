// Read the same catalog used by the real options page, without a Todoist DOM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function readRegistry() {
  const context = {
    window: {},
    navigator: {userAgent: '', vendor: '', platform: 'MacIntel'},
    document: {getElementById: () => null},
  };
  try {
    vm.runInNewContext(fs.readFileSync(path.join(
        __dirname, '../../src/todoist-shortcuts.js'), 'utf8'), context);
  } catch (e) {
    // Before this feature the script rejected non-Todoist pages. Let the
    // missing-API assertion explain the red test rather than hiding that error.
    if (e.message !== 'no div with id "todoist_app"') throw e;
  }
  return context.window.TodoistShortcutsKeybindings;
};
