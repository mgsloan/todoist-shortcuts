#!/bin/sh -ex

# Ensure that eslint passes.
./eslint.sh

rm -f todoist-shortcuts.zip
cd src
zip ../todoist-shortcuts.zip inject.js manifest.json mousetrap.js todoist-shortcuts.js icon32.png icon48.png icon64.png icon128.png
cd ../
