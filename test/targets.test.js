// Guard against accidentally testing one account or profile twice.
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {describe, it} = require('node:test');
const {
  assertDistinctTargets, getConfig, readSession, readToken,
} = require('./lib/targets');

describe('test account configuration', () => {
  it('isolates both profiles and credentials', () => {
    const stable = getConfig({TS_TEST_TARGET: 'stable'});
    const experimental = getConfig({TS_TEST_TARGET: 'experimental'});
    assert.notEqual(stable.profile, experimental.profile);
    assert.notEqual(stable.tokenFile, experimental.tokenFile);
    assert.notEqual(stable.sessionFile, experimental.sessionFile);
    assert.equal(stable.experimental, false);
    assert.equal(experimental.experimental, true);
    assert.throws(() => getConfig({TS_TEST_TARGET: 'typo'}), /Unknown/);
  });

  it('rejects duplicate accounts and shared browser profiles', () => {
    const a = {id: 'a', profile: '/a'};
    assert.throws(() => assertDistinctTargets([a, {...a, profile: '/b'}]),
        /different accounts/);
    assert.throws(() => assertDistinctTargets([a, {...a, id: 'b'}]),
        /different profiles/);
    assert.doesNotThrow(() => assertDistinctTargets(
        [a, {id: 'b', profile: '/b'}]));
  });

  it('never falls back to stable credentials for experimental', (t) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ts-targets-'));
    t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
    const missing = path.join(dir, 'missing');
    const env = {
      TS_TEST_TARGET: 'experimental', TODOIST_TEST_TOKEN_FILE: missing,
      TODOIST_STABLE_TEST_TOKEN: 'stable-token',
    };
    assert.throws(() => readToken(env), /Missing experimental/);
    assert.equal(readToken({...env,
      TODOIST_EXPERIMENTAL_TEST_TOKEN: 'experimental-token'}),
    'experimental-token');
  });

  it('rejects invalid session secrets without printing them', () => {
    const session = {
      version: 1, target: 'experimental', email: 'sandbox@example.com',
      apiToken: 'private-token', cookies: [], localStorage: {},
    };
    const env = {TS_TEST_TARGET: 'experimental',
      TODOIST_TEST_SESSION: JSON.stringify(session)};
    assert.equal(readSession(env).email, session.email);
    assert.equal(readToken(env), session.apiToken);
    assert.throws(() => readSession({...env, TS_TEST_TARGET: 'stable'}),
        /does not match/);
    assert.throws(() => readSession({TODOIST_TEST_SESSION: 'private-token'}),
        (error) => !error.message.includes('private-token'));
  });
});
