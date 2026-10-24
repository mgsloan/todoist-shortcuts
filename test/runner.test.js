const assert = require('node:assert');
const {describe, it} = require('node:test');
const {testArgs} = require('./lib/test-args');

describe('suite file selection', () => {
  it('restricts default discovery to test files', () => {
    assert.deepEqual(testArgs([]), ['test/**/*.test.js']);
    assert.deepEqual(testArgs(['--test-only']),
        ['--test-only', 'test/**/*.test.js']);
  });

  it('keeps the file restriction when filtering by name', () => {
    for (const args of [
      ['--test-name-pattern=undo'],
      ['--test-name-pattern', 'undo'],
      ['--test-name-pattern', 'priority.test.js'],
      ['--test-skip-pattern', 'undo', '--test-reporter', 'spec'],
    ]) {
      assert.deepEqual(testArgs(args), [...args, 'test/**/*.test.js']);
    }
  });

  it('preserves explicitly selected test paths', () => {
    for (const args of [
      ['test/drag.test.js'],
      ['--test-name-pattern', 'undo', 'test/bulk.test.js'],
      ['--', 'test/drag.test.js', 'test/priority.test.js'],
    ]) {
      assert.deepEqual(testArgs(args), args);
    }
  });

  it('rejects missing option values before launching Node', () => {
    assert.throws(() => testArgs(['--test-name-pattern']), /Missing value/);
    assert.throws(() => testArgs([
      '--test-name-pattern', '--test-only',
    ]), /Missing value/);
  });

  it('rejects ambiguous options and helper or directory paths', () => {
    assert.throws(() => testArgs(['--inspect-port', '9229']), /Unsupported/);
    assert.deepEqual(testArgs(['--inspect-port=9229']),
        ['--inspect-port=9229', 'test/**/*.test.js']);
    const invalid = [['test/'], ['test/clean.js'], ['--', 'test/login.js']];
    for (const args of invalid) {
      assert.throws(() => testArgs(args), /Select .test.js/);
    }
  });
});
