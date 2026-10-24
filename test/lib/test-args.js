// Node's default discovery also runs helpers under test/, including the login
// and cleanup scripts. Always supply our glob when only filters are requested.
const VALUE_FLAGS = new Set([
  '--test-concurrency', '--test-coverage-branches', '--test-coverage-exclude',
  '--test-coverage-functions', '--test-coverage-include',
  '--test-coverage-lines',
  '--test-global-setup', '--test-isolation', '--experimental-test-isolation',
  '--test-name-pattern', '--test-random-seed', '--test-reporter',
  '--test-reporter-destination', '--test-rerun-failures', '--test-shard',
  '--test-skip-pattern', '--test-timeout', '--require', '-r', '--import',
  '--conditions', '-C',
]);
const BOOLEAN_FLAGS = new Set([
  '--test-only', '--test-force-exit', '--test-randomize',
  '--test-update-snapshots', '--experimental-test-coverage',
  '--experimental-test-module-mocks',
]);

function assertTestPath(arg) {
  if (!arg.endsWith('.test.js')) {
    throw new Error('Select .test.js files or globs, not helper scripts: ' +
        arg);
  }
}

function testArgs(args) {
  let hasPaths = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--') {
      args.slice(index + 1).forEach(assertTestPath);
      hasPaths = hasPaths || index + 1 < args.length;
      break;
    }
    if (VALUE_FLAGS.has(arg)) {
      if (args[index + 1] === undefined || args[index + 1].startsWith('--')) {
        throw new Error('Missing value for ' + arg);
      }
      index++;
    } else if (arg.startsWith('-')) {
      if (!arg.includes('=') && !BOOLEAN_FLAGS.has(arg)) {
        throw new Error('Unsupported option ' + arg +
            '. Use --name=value for other Node options.');
      }
    } else {
      assertTestPath(arg);
      hasPaths = true;
    }
  }
  return [...args, ...(hasPaths ? [] : ['test/**/*.test.js'])];
}

module.exports = {testArgs};
