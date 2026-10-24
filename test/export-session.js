// Exports only Todoist cookies and login state, never the Chrome profile.
// The output contains credentials and belongs in an Actions secret.
const fs = require('fs');
const api = require('./lib/api');
const browser = require('./lib/browser');
const {getConfig, readToken} = require('./lib/targets');

async function main() {
  const config = getConfig();
  const user = await api.getUser();
  let chrome = null;
  try {
    chrome = await browser.launch();
    const page = await browser.openApp(chrome);
    await browser.assertSameAccountAs(page, user);
    const cookies = (await chrome.defaultBrowserContext().cookies())
        .filter((cookie) => cookie.domain === 'todoist.com' ||
          cookie.domain.endsWith('.todoist.com'));
    const storage = await page.evaluate(() => {
      const result = {};
      for (const key of ['auth_identity', 'User']) {
        const value = localStorage.getItem(key);
        if (value !== null) result[key] = value;
      }
      return result;
    });
    const session = {
      version: 1, target: config.target, email: user.email,
      apiToken: readToken(), cookies, localStorage: storage,
    };
    const json = JSON.stringify(session);
    if (Buffer.byteLength(json) > 48 * 1024) {
      throw new Error('Session exceeds the Actions secret size limit.');
    }
    fs.writeFileSync(config.sessionFile, json, {mode: 0o600});
    fs.chmodSync(config.sessionFile, 0o600);
    console.log('Exported ' + config.target + ' session to ' +
        config.sessionFile);
  } finally {
    if (chrome) await chrome.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
