// Opens the test profile's browser at Todoist's login page and waits for you
// to log in.  The session then persists in the profile directory, so the tests
// can run unattended afterwards.
//
// Log in as the *test* account, not a real one - the tests create, modify and
// delete tasks.

const browser = require('./lib/browser');

async function main() {
  const chrome = await browser.launch();
  const [page] = await chrome.pages();
  await page.goto('https://app.todoist.com/auth/login');
  console.log('Log in as the test account in the browser window that opened.');
  console.log('Profile directory: ' + browser.PROFILE_DIR);
  await page.waitForFunction(
      () => location.pathname.startsWith('/app'),
      {polling: 1000, timeout: 0});
  const account = await browser.accountOfPage(page);
  console.log('Logged in as ' + account.email + ' (id ' + account.id + ').');
  console.log('Make sure etc/test-token holds this account\'s API token.');
  await chrome.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
