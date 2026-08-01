# todoist-shortcuts

Browser extension that adds GMail/vim-inspired keyboard shortcuts to Todoist.
Nearly all of the logic lives in `src/todoist-shortcuts.js` (~5k lines, one big
IIFE).  It works by driving Todoist's own DOM: finding elements by
`data-action-hint` / `data-testid` / class name and synthesizing clicks.  This
means Todoist UI changes break it regularly, so *verify fixes against the live
site* rather than reasoning from the source alone.

## Layout

| path | what |
| --- | --- |
| `src/manifest.json` | MV3 manifest.  Content script = `common.js` + `inject.js` |
| `src/inject.js` | Content script.  Copies options onto `<body>` attributes, then injects `mousetrap.js` and `todoist-shortcuts.js` as page scripts |
| `src/todoist-shortcuts.js` | Everything: keybindings, actions, DOM queries, help modal |
| `src/mousetrap.js` | Vendored copy of `mousetrap/mousetrap.js` (git submodule); `eslint.sh` checks the two are identical |
| `src/options-page.*` | Options UI |
| `etc/dev-server.py` | Serves `src/` with CORS, for injecting into a page without the extension (see below) |
| `changelog.md` | User-facing changelog; add an entry for behavior changes |

Style rules for changes are in `development.md`: defensive coding, `try`/
`finally` around state that must be undone, prefer querying the DOM over
storing state, mark unavoidable mutable state with a `MUTABLE` comment.

Run `./eslint.sh` before finishing (needs `npm install` once).

## Changelog entries

`changelog.md` is read by users, not by contributors.  An entry says what
changed for the person using the extension, in one or two sentences, and
nothing about how it was done.  Leave out what broke internally, which element
Todoist renamed, what the code used to look for, and how it works now — all of
that belongs in the commit message, which the issue link leads to anyway.

```
* Fixes scheduling for next month (`t m`), which did nothing.
```

not

```
* Fixes scheduling for next month (`t m`), which did nothing at all.
  Todoist's scheduler no longer has a "next month" button - it only has
  today, tomorrow, next week and next weekend - so the same day of the
  next month is now picked from the calendar, the way `t w` already
  worked.
```

Name the keys the shortcut uses, mention the issue it fixes as `[#123][]`, and
credit contributors ("Thanks to contribution from [@name][] in [#123][]!").
Reference definitions go at the end of the version's section; repeating one
that an older section already defines is fine and is what the file does.
Entries go under a heading for the next version, which is added by the release
commit that bumps `src/manifest.json`.

## Local Chrome setup

Two Chrome profiles are relevant on this machine:

* **Default** — mgsloan's personal Todoist account.  The Web Store build
  (`dehmghpdcahlffompjagejmgbcfahndp`) is installed but *disabled*; `src/` is
  loaded unpacked as `kpgmkpbeihaempnhkaaagnhfgjophlln`.
  **Never automate mutations here.**  See "Account safety" below.

* **todoist-shortcuts-dev** — the sandbox.  That is the profile's display name;
  its directory is `Profile 1`, which is what the launch flag wants:

  ```
  google-chrome --profile-directory="Profile 1"
  ```

  It is a local profile (no Google sign-in).  It has the Claude extension
  installed from the Web Store (installing it unpacked would change its
  extension id and break the native-messaging connection), is signed into
  claude.ai, has `src/` loaded unpacked via chrome://extensions → Developer
  mode → Load unpacked, and is logged into a throwaway Todoist account
  (`mgsloan+tsdev@gmail.com`).

### Dev loop

Editing `src/*.js` and **reloading the Todoist tab** is enough — the injected
page scripts are re-fetched from disk on every page load (verified).  Only
`manifest.json` changes require hitting reload on chrome://extensions, which
claude-in-chrome cannot do (extensions can't script `chrome://` pages), so ask
for that manually.

### Injecting without the extension

If a browser doesn't have the extension loaded, run `python3 etc/dev-server.py`
(serves `src/` on http://localhost:8765 with CORS) and evaluate this in the
Todoist tab:

```js
const inject = (n) => new Promise((res) => {
  const s = document.createElement('script');
  s.src = 'http://localhost:8765/' + n + '?t=' + Date.now();
  s.onload = () => res('ok'); s.onerror = () => res('err');
  document.body.appendChild(s);
});
await inject('mousetrap.js'); await inject('todoist-shortcuts.js');
```

Notes: Todoist's CSP blocks `eval`, so the code must be loaded via a script
element — that works because the CSP uses `'strict-dynamic'` and the element is
inserted from the main world.  Options fall back to defaults when the
`data-todoist-shortcuts-options` body attribute is missing.  Don't do this in a
tab where the extension is already active — you'll get double keybindings.

## Automated tests

`test/` holds an integration suite that drives a real browser against a real
(throwaway) Todoist account.  There is no way to test this extension without
one: it exists to poke at Todoist's DOM, so a mocked DOM would only test the
mock.

```
npm run test:login   # once: log the test account into the test profile
npm test             # node --test test/
npm run test:clean   # delete "ts-test " projects left by interrupted runs
```

* `test/lib/browser.js` launches Chrome (puppeteer-core, system Chrome) against
  its own user data directory — `~/.cache/todoist-shortcuts-test-profile`, or
  `TS_TEST_PROFILE`.  Set `TS_TEST_HEADLESS=1` to hide it.
* Chrome ignores `--load-extension` now, so the extension is installed with
  `browser.installExtension()` (CDP `Extensions.loadUnpacked`), which needs
  `--enable-unsafe-extension-debugging` and `pipe: true`.
* Puppeteer's keyboard events are trusted events, so they exercise the real
  keybindings.  DOM-dispatched `KeyboardEvent`s would not.
* `test/lib/api.js` seeds fixtures and checks results through the Todoist API,
  which is the point: several of the bugs this suite guards against are cases
  where the UI accepted a change that was never saved.
* The cursor has no marker class — it is drawn by generated CSS keyed on the
  task id — so `cursorContent` finds it by its border colour.

This suite hits the live service with a real account, so it is a local suite,
not something to run in CI.

## Account safety

Automating Todoist means creating, editing and deleting real tasks.  Only ever
do that against the sandbox account — the test profile, or the
**todoist-shortcuts-dev** Chrome profile.

Before any action that could mutate data (keystrokes, clicks on menu items,
drags), confirm which account the tab is logged in as:

```js
JSON.parse(localStorage.getItem('auth_identity')).email
```

The sandbox account is `mgsloan+todoist+shortcuts@gmail.com`; anything else is
a real account.  `browser.assertSameAccountAs` does this check for the test
suite, comparing against the account the API token belongs to.

Read-only probing (opening menus, reading the DOM, navigating) is safe
anywhere, but blind keystrokes are not: unfocused typing gets interpreted as
shortcuts, so `t`, `e`, `d` etc. hit real tasks.  Type into an element only
after confirming focus landed in it.

### API token

The sandbox account's REST API token lives in `etc/test-token` (gitignored).
Use it to seed and verify test data instead of doing it through the UI:

```
TOKEN=$(cat etc/test-token)
# create
curl -s -X POST https://api.todoist.com/rest/v2/tasks \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"ts-test alpha","priority":1}'
# read back (priority 4 = p1 in the UI, see below)
curl -s https://api.todoist.com/rest/v2/tasks -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

The typical loop: seed tasks via the API, perform the shortcut in the browser,
then assert the resulting state via the API.

## Probing Todoist's DOM

Use `mcp__claude-in-chrome__javascript_tool`.  It refuses to return large raw
HTML dumps ("BLOCKED: Cookie/query string data"), so extract attributes rather
than `outerHTML`:

```js
[...document.querySelectorAll('[data-action-hint]')]
  .map(e => e.getAttribute('data-action-hint'))
```

Task row action buttons (`task-edit`, `task-scheduler`, `task-overflow-menu`,
…) only exist while the row is hovered — dispatch `pointerover`/`mouseover` on
the row first, the way `withTaskHovered` does.

### Priority numbering

Todoist's internal numbering is inverted relative to the UI: internal 4 = "P1"
(urgent), internal 1 = "P4" (none).  `invertPriorityLevel` converts between
them.  The keybindings pass the *internal* level to `setPriority`, so `1` is
bound to `setPriority('4')`, and `data-action-hint="task-overflow-menu-priority-4"`
is the "Priority 1" menu item.
