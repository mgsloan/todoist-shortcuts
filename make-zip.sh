#!/bin/sh

# Ensure that eslint passes.
./eslint.sh

rm -f todoist-shortcuts.zip
cd src
zip todoist-shortcuts.zip inject.js manifest.json todoist-shortcuts.js
cd ../
mv src/todoist-shortcuts.zip .

# Turns out chrome webstore just wants a zip
#
# rm -f src.pem src.crx
# google-chrome --pack-extension=src --pack-extension-key=private/todoist-shortcuts.pem
# mv src.crx todoist-shortcuts.crx
