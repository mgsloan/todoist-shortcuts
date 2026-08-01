// The tables of shortcut tests, and the list of shortcuts deliberately left
// untested.
//
// Each table entry describes one key spelling:
//
//   {
//     keymap: 'default',
//     keys: ['j', 'down'],   // one test is generated per key
//     what: 'moves the cursor down',
//     tasks: ['alpha', 'beta'],   // fixture contents, optional
//     setUp: async (t) => {},     // optional, runs before the key is pressed
//     check: async (t) => {},     // asserts the key did something
//     tearDown: async (t) => {},  // optional, e.g. closing what was opened
//   }
//
// `t` is the context from test/lib/shortcut-runner.js: {page, fixture, api,
// browser, key, press}.

const cursor = require('./cursor');
const menuList = require('./menu-list');
const mutation = require('./mutation');
const opens = require('./opens');
const schedule = require('./schedule');
const selection = require('./selection');
const taskView = require('./task-view');
const misc = require('./misc');

const TABLES = {
  cursor,
  selection,
  mutation,
  opens,
  misc,
  schedule,
  'task-view': taskView,
  'menu-list': menuList,
};

// Shortcuts which have a test of their own elsewhere, rather than a smoke
// test in these tables.
const COVERED_ELSEWHERE = {
  'default:1': 'priority.test.js',
  'default:2': 'priority.test.js',
  'default:3': 'priority.test.js',
  'default:4': 'priority.test.js',
  'default:0': 'priority.test.js',
  'task_view:1': 'priority.test.js',
  'task_view:2': 'priority.test.js',
  'task_view:3': 'priority.test.js',
  'task_view:4': 'priority.test.js',
  'task_view:0': 'priority.test.js',
  'default:o': 'add-task.test.js',
  'default:shift+o': 'add-task.test.js',
  'default:a': 'add-task.test.js',
  'default:`': 'sidebar.test.js',
  'default:shift+`': 'sidebar.test.js',
  'default:shift+v': 'layout.test.js',
  'schedule:t': 'schedule.test.js',
  'schedule:n': 'schedule.test.js',
  'schedule:m': 'schedule.test.js',
};

// Shortcuts which are not tested, and why. The coverage test requires a reason
// here for anything missing from the tables above, so this list is the
// complete account of what isn't covered.
const EXCLUDED = {
  'default:shift+c':
    'Clicks the separate toggl-button extension, which is not installed.',
  'task_view:shift+c':
    'Clicks the separate toggl-button extension, which is not installed.',
  'default:ctrl+s':
    'Asks Todoist to sync, which has no outcome to assert.',
  'default:!':
    'Opens Todoist\'s notifications, which a fresh test account has none of.',
};

module.exports = {COVERED_ELSEWHERE, EXCLUDED, TABLES};
