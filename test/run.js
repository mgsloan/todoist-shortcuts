// Run the same suite concurrently against two isolated Todoist accounts.
const {spawn} = require('child_process');
const path = require('path');
const readline = require('readline');
const {TARGETS, assertDistinctTargets} = require('./lib/targets');
const {testArgs} = require('./lib/test-args');

const ROOT = path.join(__dirname, '..');
// MUTABLE. Forward interruptions to every running preflight or test process.
const children = new Set();

function child(target, args, options = {}) {
  const {capture, timezone} = options;
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {...process.env, TS_TEST_TARGET: target,
        ...(timezone ? {TZ: timezone, TS_TEST_TIMEZONE: timezone} : {})},
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    children.add(proc);
    let output = '';
    for (const stream of [proc.stdout, proc.stderr]) {
      readline.createInterface({input: stream}).on('line', (line) => {
        if (capture && stream === proc.stdout) output += line + '\n';
        else console.log('[' + target + '] ' + line);
      });
    }
    proc.on('error', reject);
    proc.on('close', (code, signal) => {
      children.delete(proc);
      resolve({code: code === null ? (signal === 'SIGINT' ? 130 : 143) : code,
        output});
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const index = args.indexOf('--target');
  let targets = TARGETS;
  if (index !== -1) {
    const target = args[index + 1];
    if (!TARGETS.includes(target)) throw new Error('Invalid --target.');
    targets = [target];
    args.splice(index, 2);
  }
  const mode = ['--check', '--login', '--clean', '--export-session']
      .find((flag) => args.includes(flag));
  if (mode) args.splice(args.indexOf(mode), 1);
  if (args[0] === '--') args.shift();
  if (mode === '--login') {
    const result = await child(targets[0], ['test/login.js']);
    process.exitCode = result.code;
    return;
  }
  const command = mode === '--clean' ? ['test/clean.js'] :
    mode === '--export-session' ? ['test/export-session.js'] :
      ['--test', '--test-concurrency=1', ...testArgs(args)];
  const checks = await Promise.all(targets.map(async (target) => {
    const result = await child(target, ['test/preflight.js'], {capture: true});
    if (result.code !== 0) throw new Error(target + ' preflight failed.');
    return JSON.parse(result.output);
  }));
  assertDistinctTargets(checks);
  for (const check of checks) {
    console.log('[' + check.target + '] Verified ' + check.email +
        ', experimental features ' + (check.experimental ? 'on' : 'off') +
        ', timezone ' + check.timezone);
  }
  if (mode === '--check') return;
  const results = await Promise.all(targets.map(async (target) => {
    const {timezone} = checks.find((check) => check.target === target);
    const result = await child(target, command, {timezone});
    console.log('[' + target + '] ' + (result.code === 0 ? 'PASS' : 'FAIL'));
    return result;
  }));
  process.exitCode = results.every((r) => r.code === 0) ? 0 : 1;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const proc of children) proc.kill(signal);
    process.exitCode = signal === 'SIGINT' ? 130 : 143;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
