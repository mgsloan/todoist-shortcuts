// Read-only checks before either account is allowed to create fixtures.
const fs = require('fs');
const api = require('./lib/api');
const browser = require('./lib/browser');
const {accountTimezone, getConfig, readSession} = require('./lib/targets');

async function main() {
  const config = getConfig();
  const user = await api.getUser();
  const timezone = accountTimezone(user);
  process.env.TZ = timezone;
  process.env.TS_TEST_TIMEZONE = timezone;
  const expectedEmail = config.email || readSession()?.email;
  if (expectedEmail && user.email !== expectedEmail) {
    throw new Error('The API token does not belong to ' + expectedEmail + '.');
  }
  let chrome = null;
  try {
    chrome = await browser.launch();
    const page = await browser.openApp(chrome, 'settings/general');
    await page.waitForFunction(() => Boolean(
        JSON.parse(localStorage.getItem('auth_identity') || '{}').email),
    {timeout: 15000});
    await browser.assertSameAccountAs(page, user);
    const query = 'input[name="isBetaEnabled"]';
    await page.waitForSelector(query, {timeout: 15000});
    const enabled = await page.$eval(query, (el) => el.checked);
    if (enabled !== config.experimental) {
      throw new Error(config.target + ' requires Experimental features ' +
          (config.experimental ? 'on' : 'off') + ' in Todoist settings.');
    }
    console.log(JSON.stringify({
      target: config.target, id: String(user.id), email: user.email,
      experimental: enabled, timezone,
      profile: fs.realpathSync(config.profile),
    }));
  } finally {
    if (chrome) await chrome.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
