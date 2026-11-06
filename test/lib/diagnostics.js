// Only inspect UI state: never dump page HTML, storage, cookies or inputs.
async function taskViewState(page) {
  return await page.evaluate(() => {
    const view = document.querySelector('[data-testid="task-details-modal"]');
    const describe = (el) => el ? {
      tag: el.tagName,
      label: el.getAttribute('aria-label'),
      testid: el.getAttribute('data-testid'),
      role: el.getAttribute('role'),
      disabled: el.matches(':disabled') ||
        el.getAttribute('aria-disabled') === 'true',
      visible: el.getClientRects().length > 0,
    } : null;
    return {
      open: Boolean(view),
      title: view?.querySelector('.task_content')?.textContent || null,
      focused: describe(document.activeElement),
      buttons: view ? [...view.querySelectorAll('button')].map(describe) : [],
    };
  });
}

// Diagnostic failures must not replace the original test failure, including
// when its page has crashed or closed. Each field can fail independently.
async function reportShortcutFailure(test, context, before, phase) {
  const {page, chrome, complaints} = context;
  const inspect = async (read) => {
    try {
      return await read();
    } catch (error) {
      return {unavailable: error.name};
    }
  };
  const [browserVersion, after] = await Promise.all([
    inspect(() => chrome.version()),
    inspect(() => taskViewState(page)),
  ]);
  test.diagnostic(JSON.stringify({
    phase,
    nodeVersion: process.version,
    browserVersion,
    before,
    after,
    complaints,
  }, null, 2));
}

module.exports = {reportShortcutFailure, taskViewState};
