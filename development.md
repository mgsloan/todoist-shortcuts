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
tracker](https://github.com/mgsloan/todoist-shortcuts/issues) or the list of
TODO items below.

# Running eslint

First, install eslint:

```
npm install eslint eslint-config-es5
```

Then, run `eslint.sh` to use it to do checking.

# TODO

* Allow using ctrl+arrows while editing text of a task. Instead use
  shift+arrows to shift it around while editing.

* In agenda view, cursor should be able to focus empty days, for the purpose
of adding tasks.

* What is postpone?

* Enter day of month + move between months.

* e for Archive and d for Done, # for Delete, are awfully close to
eachother.  Is archive vs delete useful?

* Display of keybindings directly on elements suggests a library that mixes
querySelectorAll / mousetrap / the utilities here.  Design it also to be used
in normal applications?

* Document usage with vimium.  Right now I have vimium disabled, but my most
recently accumulated set of key disables was `hjklxvtqaAuspr1234noO`

* Youtube video?

* Blog post about the overall technique?

* Chrome webstore promotional tile images?

# Changes to todoist that would be very helpful

* Other than things like today / tomorrow / next week / next month, there is
no good way to reschedule a task to a particular day.  I think it would
generally be a good improvement if the rescheduling calendar always had a
box to input textual descriptions of the date.  This would allow things that
you can't currently easily do, like bulk scheduling tasks with repeating
dates.

# Todoist issues

* Undo does not work for multiple completions or deletions

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
