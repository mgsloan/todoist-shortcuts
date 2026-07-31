// Regression tests for cycling through the sidebar with ` and shift+`.
//
// https://github.com/mgsloan/todoist-shortcuts/issues/232 and
// https://github.com/mgsloan/todoist-shortcuts/issues/239.

const assert = require('node:assert');
const {after, afterEach, before, describe, it} = require('node:test');

const api = require('./lib/api');
const browser = require('./lib/browser');
const fixtures = require('./lib/fixtures');

const TIMEOUT = 180000;

describe('sidebar navigation', {timeout: TIMEOUT}, () => {
  let chrome = null;
  let page = null;
  const projects = [];

  const addProject = async (name, isFavorite) => {
    const project = await api.request('POST', '/projects', {
      name: fixtures.PROJECT_PREFIX + name,
      is_favorite: Boolean(isFavorite),
    });
    projects.push(project);
    return project;
  };

  const open = async (where) => {
    if (page) await page.close();
    page = await browser.openApp(chrome, where);
    await page.bringToFront();
    await page.waitForSelector('#top-menu li a', {timeout: 30000});
    const project = /^project\/(.+)$/.exec(where || '');
    if (project) {
      // Projects made moments ago are not in the sidebar immediately, and
      // navigating relative to the current item only works once it is there.
      await waitForSidebarLink('#left-menu-projects-panel', project[1]);
    }
    return page;
  };

  const waitForSidebarLink = async (panel, projectId) => {
    await page.waitForSelector(
        panel + ' a[href$="' + projectId + '"]', {timeout: 30000});
  };

  const path = () => page.evaluate(() => window.location.pathname);

  // Todoist rewrites project urls to include a slug, so compare by the
  // trailing id instead of by the whole path.
  const pathId = (pathname) =>
    pathname.substring(pathname.lastIndexOf('-') + 1);

  // Presses the key and returns the path it navigated to.
  const cycle = async (key) => {
    const before = await path();
    if (key === 'prev') {
      // Not keyboard.press('~'): that arrives without the shift modifier,
      // which is what the binding is on.
      await page.keyboard.down('Shift');
      await page.keyboard.press('`');
      await page.keyboard.up('Shift');
    } else {
      await page.keyboard.press('`');
    }
    for (let i = 0; i < 40; i++) {
      if (await path() !== before) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    // Let the sidebar catch up with the navigation.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return await path();
  };

  before(async () => {
    const user = await api.getUser();
    chrome = await browser.launch();
    page = await browser.openApp(chrome);
    await browser.assertSameAccountAs(page, user);
    await fixtures.destroyStale();
  });

  after(async () => {
    if (page) await page.close();
    for (const project of projects) await api.deleteProject(project.id);
    if (chrome) await chrome.close();
  });

  afterEach(async () => {
    while (projects.length) {
      await api.deleteProject(projects.pop().id);
    }
  });

  it('cycles forwards and backwards through the top items', async () => {
    await open('inbox');
    assert.equal(await cycle('next'), '/app/today');
    assert.equal(await cycle('next'), '/app/upcoming');
    assert.equal(await cycle('prev'), '/app/today');
    assert.equal(await cycle('prev'), '/app/inbox');
  });

  it('works when there are no favorites', async () => {
    // The favorites panel is absent when nothing is favorited, which used to
    // make every sidebar navigation throw before it clicked anything.
    await addProject('plain', false);
    await open('inbox');
    assert.equal(
        await page.$$eval('#left-menu-favorites-panel', (els) => els.length), 0,
        'this test is pointless if the account has favorites');
    assert.equal(await cycle('next'), '/app/today');
  });

  it('continues from the project being viewed', async () => {
    // Rather than starting over from the first item, which is what happened
    // when the current item was found by counting obfuscated class names.
    const first = await addProject('aaa', false);
    const second = await addProject('bbb', false);
    await open('project/' + first.id);
    await waitForSidebarLink('#left-menu-projects-panel', second.id);
    assert.equal(pathId(await cycle('next')), second.id);
  });

  it('does not bounce off a favorited project\'s other entry', async () => {
    // A favorited project is listed in both the favorites and the projects
    // panel. Moving off of the projects entry used to resume from the
    // favorites entry instead, which sent you back up out of the project
    // list - the loop reported in #232.
    const favorite = await addProject('aaa', true);
    const plain = await addProject('bbb', false);
    await open('project/' + plain.id);
    await waitForSidebarLink('#left-menu-favorites-panel', favorite.id);
    await waitForSidebarLink('#left-menu-projects-panel', favorite.id);
    assert.equal(
        pathId(await cycle('prev')), favorite.id,
        'expected to reach the favorited project by its projects entry');
    const back = await cycle('prev');
    assert.ok(
        back.startsWith('/app/project/'),
        'expected to stay in the project list, but went to ' + back);
  });
});
