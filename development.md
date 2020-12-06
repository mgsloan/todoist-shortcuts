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

First, install eslint:

```
npm install --dev eslint eslint-config-google
```

Then, run `eslint.sh` to use it to do checking.

# Automated upload of extensions

This is probably only useful to me for uploading the extension, but I figured
I'd document it anyway incase someone wondered what's up with the
`Gruntfile.js`.  It is used to automate extension upload.

Install grunt and https://github.com/c301/grunt-webstore-upload via

```
npm install grunt grunt-webstore-upload
```

Then, populate `etc/secrets.json` with a json object with `chrome_client_id` and
`chrome_client_secret` fields. Finally, you can run `./make-and-upload.sh` to
make the zip and upload it!


Firefox is not yet automated, for now I just visit
https://addons.mozilla.org/en-US/developers/addon/todoist-shortcuts/edit
