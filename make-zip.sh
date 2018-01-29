#!/bin/sh

# Ensure that eslint passes.
./eslint.sh

rm -f todoist-shortcuts.zip
zip todoist-shortcuts.zip src/inject.js src/manifest.json src/todoist-shortcuts.js

# Turns out chrome webstore just wants a zip
#
# rm -f src.pem src.crx
# google-chrome --pack-extension=src --pack-extension-key=private/todoist-shortcuts.pem
# mv src.crx todoist-shortcuts.crx
