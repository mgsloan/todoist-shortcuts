#!/bin/bash

./node_modules/eslint/bin/eslint.js src/todoist-shortcuts.js $@

CMP_STATUS="$(cmp --silent -- src/mousetrap.js mousetrap/mousetrap.js; echo $?)"
if [[ "$CMP_STATUS" -ne 0 ]]; then
  echo "ERROR: src/mousetrap.js and mousetrap/mousetrap.js should have same content."
  exit 1
fi
