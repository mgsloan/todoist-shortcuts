// The keymap for moving around an open menu, reached here with `w`.

const assert = require('node:assert');

const MENU = '[role="menu"], .reactist_menulist';

const openMenu = async (t) => {
  await t.press('w');
  await t.page.waitForSelector(MENU, {timeout: 15000});
  await t.sleep(500);
};

// Which item the menu considers focused. Todoist marks it rather than moving
// the document's focus.
const focusedItem = (t) => t.page.evaluate((selector) => {
  const menu = document.querySelector(selector);
  if (!menu) return null;
  const item = menu.querySelector(
      '[data-active-item], [aria-selected="true"], :focus');
  return item ? (item.textContent || '').trim().slice(0, 30) : null;
}, MENU);

const menuIsOpen = async (t) => Boolean(await t.page.$(MENU));

const focusAnItem = async (t) => {
  await openMenu(t);
  await t.press('j');
  await t.sleep(400);
};

module.exports = [
  {
    keymap: 'menu_list',
    keys: ['j', 'down', 'tab'],
    what: 'focuses the next menu item',
    setUp: openMenu,
    check: async (t) => assert.ok(
        await focusedItem(t), t.key + ' did not focus a menu item'),
  },
  {
    keymap: 'menu_list',
    keys: ['k', 'up', 'shift+tab'],
    what: 'focuses the previous menu item',
    setUp: async (t) => {
      await openMenu(t);
      await t.press('j');
      await t.sleep(400);
    },
    check: async (t) => assert.ok(
        await focusedItem(t), t.key + ' did not focus a menu item'),
  },
  {
    keymap: 'menu_list',
    keys: ['space'],
    what: 'selects the focused menu item',
    setUp: focusAnItem,
    settle: 2000,
    check: async (t) => assert.equal(
        await menuIsOpen(t), false, 'the menu should have closed'),
  },
  {
    keymap: 'menu_list',
    keys: ['enter'],
    what: 'selects the focused menu item',
    setUp: focusAnItem,
    settle: 2000,
    check: async (t) => assert.equal(
        await menuIsOpen(t), false, 'the menu should have closed'),
  },
];
