// Separate accounts, credentials and browser profiles for each Todoist UI.
const fs = require('fs');
const os = require('os');
const path = require('path');

const TARGETS = ['stable', 'experimental'];
const ROOT = path.join(__dirname, '..', '..');

function getConfig(env = process.env) {
  const target = env.TS_TEST_TARGET || 'stable';
  if (!TARGETS.includes(target)) {
    throw new Error('Unknown test target: ' + target);
  }
  const experimental = target === 'experimental';
  return {
    target,
    experimental,
    profile: path.resolve(env.TS_TEST_PROFILE || path.join(
        os.homedir(), '.cache', experimental ?
          'todoist-shortcuts-experimental-test-profile' :
          'todoist-shortcuts-test-profile')),
    tokenFile: path.resolve(env.TODOIST_TEST_TOKEN_FILE || path.join(
        ROOT, 'etc', experimental ? 'test-token-experimental' : 'test-token')),
    sessionFile: path.join(ROOT, 'etc', 'test-session-' + target + '.json'),
    email: env.TODOIST_TEST_EMAIL || '',
  };
}

function readToken(env = process.env) {
  const config = getConfig(env);
  const specific = 'TODOIST_' + config.target.toUpperCase() + '_TEST_TOKEN';
  const token = (env.TODOIST_TEST_TOKEN || env[specific] ||
      readSession(env)?.apiToken ||
      (fs.existsSync(config.tokenFile) ?
        fs.readFileSync(config.tokenFile, 'utf8') : '')).trim();
  if (!token) {
    throw new Error('Missing ' + config.target + ' test token. Put it in ' +
        config.tokenFile + ' or set ' + specific + '.');
  }
  return token;
}

function readSession(env = process.env) {
  if (!env.TODOIST_TEST_SESSION) return null;
  let session;
  try {
    session = JSON.parse(env.TODOIST_TEST_SESSION);
  } catch (e) {
    // JSON parser errors can quote credentials from the input.
    throw new Error('Invalid TODOIST_TEST_SESSION JSON. Export it again.');
  }
  const target = env.TS_TEST_TARGET || 'stable';
  if (!session || session.version !== 1 || session.target !== target ||
      typeof session.apiToken !== 'string' || !session.apiToken.trim() ||
      typeof session.email !== 'string' ||
      !Array.isArray(session.cookies) || !session.localStorage ||
      typeof session.localStorage !== 'object') {
    throw new Error('TODOIST_TEST_SESSION does not match target ' + target);
  }
  return session;
}

function assertDistinctTargets(accounts) {
  if (new Set(accounts.map((a) => a.id)).size !== accounts.length) {
    throw new Error('Stable and experimental must use different accounts.');
  }
  if (new Set(accounts.map((a) => a.profile)).size !== accounts.length) {
    throw new Error('Stable and experimental must use different profiles.');
  }
}

module.exports = {
  TARGETS, assertDistinctTargets, getConfig, readSession, readToken,
};
