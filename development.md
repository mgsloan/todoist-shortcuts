This is a file containing general notes about the development of
todoist-shortcuts.

# Contributing

Please ensure the following when opening a PR:

* Your change passes eslint (see `Running eslint` below).

* Your changes are written in a defensive style.  For example:

  - If it puts things in a state that should always be undone before the
action exits, then `try` / `finally` should be used.

  - It should check assumptions when possible.  For example, many parts of the
code find classes with the assumption that there is only one matching
element.  Rather than just using the first one, it ensures that there is
only one match.

* Your changes minimize use of mutable state between actions.

  - If possible, as much state should be queried from the DOM state.  This
makes it less likely that things will be out of sync.  In particular, the DOM
often gets refereshed, so storing references to nodes is often useless.

  - In cases where mutability is unavoidable, mark it with `MUTABLE` in a
comment.

For stuff to work on, take a look at [the issue
tracker](https://github.com/mgsloan/todoist-shortcuts/issues). Or,
propose a new feature!

# Running eslint

First, install eslint. The `package.json` only contains the dev
dependencies for eslint and upload automation:

```
npm install
```

Then, run `eslint.sh` to use it to do checking.

# Automated upload of extensions

This is probably only useful to me for uploading the extension, but I figured
I'd document it anyway incase someone wondered what's up with the
`Gruntfile.js`.  It is used to automate extension upload.

Install grunt and https://github.com/c301/grunt-webstore-upload via

```
npm install grunt grunt-webstore-upload addons-linter
```

Then, populate `etc/secrets.json` with a json object with `chrome_client_id` and
`chrome_client_secret` fields. Finally, you can run `./make-and-upload.sh` to
make the zip and upload it!


Firefox is not yet automated, for now I just visit
https://addons.mozilla.org/en-US/developers/addon/todoist-shortcuts/edit

# Testing both Todoist interfaces

Use two disposable Todoist accounts, one with Experimental features off and
one with it on (Settings → General → Advanced). Keep their language, time
zone, and subscription plan the same. The setting is account-wide, so two
browser profiles signed into the same account do not give both interfaces.

`npm test` runs the full suite twice, starting both accounts concurrently.
Tests within each account remain sequential because they share fixtures and
a browser profile. Both accounts are checked before either suite creates
data: their browser and API identities must match, their experimental
settings must be correct, and the accounts and profile directories must
be distinct. One suite failing does not cancel the other suite.

Confirmed upstream Todoist failures can be marked as TODO for the affected
target. They still execute in both suites. Currently the experimental
interface has no Undo popup, and native Ctrl+Z also fails with the extension
disabled (verified 2026-10-23). Its four undo checks are TODOs; stable undo
remains a strict check. Reasons live in `test/lib/known-failures.js`.
New, unrecognized failures still fail CI.

```
npm run test:login -- --target stable
npm run test:login -- --target experimental
npm run test:check
TS_TEST_HEADLESS=1 npm test
```

The stable account uses `etc/test-token` and the existing
`~/.cache/todoist-shortcuts-test-profile`. The experimental account uses
`etc/test-token-experimental` and
`~/.cache/todoist-shortcuts-experimental-test-profile`. Both token files are
gitignored. Put each account's API token in its corresponding file.

Use `npm run test:stable` or `npm run test:experimental` to run just one
account. Select `.test.js` files or globs; directory discovery also includes
helper scripts, so the runner rejects directories. Node test flags are
forwarded. Use `--name=value` for other Node options. For example:

```
TS_TEST_HEADLESS=1 npm test -- test/drag.test.js test/priority.test.js
TS_TEST_HEADLESS=1 npm test -- --test-name-pattern=priority
npm run test:clean
```

`TS_TEST_PROFILE` and `TODOIST_TEST_TOKEN_FILE` override the selected
account's paths. `TODOIST_STABLE_TEST_TOKEN` and
`TODOIST_EXPERIMENTAL_TEST_TOKEN` supply tokens without files.
`TODOIST_TEST_TOKEN` overrides the token for a single selected target;
do not use one generic token for a dual-account run. `TODOIST_TEST_EMAIL`
optionally pins the expected account email.

## Daily GitHub Actions runs

`.github/workflows/daily-tests.yml` runs two independent Ubuntu jobs at
09:17 UTC daily (early morning in Denver) and supports manual dispatch.
Both jobs start concurrently, have separate Chrome profiles, and always
run the same complete suite. Each job restores its account's session from
a secret; no browser profile is uploaded or cached.

To create the two session secrets from logged-in local test profiles:

```
npm run test:export-session
gh secret set TODOIST_STABLE_TEST_SESSION < etc/test-session-stable.json
gh secret set TODOIST_EXPERIMENTAL_TEST_SESSION < etc/test-session-experimental.json
```

The exported files contain the API token, Todoist login cookies, and login
storage. They are gitignored and created with owner-only permissions.
Session secrets are bound to their target and account email. To verify
restoration locally, set `TODOIST_TEST_SESSION` to the exported JSON and
run a selected target with `TS_TEST_PROFILE` pointing to a fresh directory.
If Todoist expires or revokes a session, log in locally and export and
update that account's secret again.

Use these same two accounts locally and in Actions. GitHub concurrency
prevents overlapping CI runs per account, but cannot see a local run:
avoid local runs during the nightly jobs, since fixture cleanup in one
run can delete another run's data. GitHub may disable public-repository
schedules after 60 days of inactivity; check the workflow remains enabled.
