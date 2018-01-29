#!/bin/sh
rm -f src.pem src.crx
google-chrome --pack-extension=src --pack-extension-key=private/todoist-shortcuts.pem
mv src.crx todoist-shortcuts.crx