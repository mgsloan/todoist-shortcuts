#!/bin/bash -e

./node_modules/eslint/bin/eslint.js src/inject.js src/options-page.js $@

CMP_STATUS="$(cmp --silent -- src/mousetrap.js mousetrap/mousetrap.js; echo $?)"
if [[ "$CMP_STATUS" -ne 0 ]]; then
  echo "ERROR: src/mousetrap.js and mousetrap/mousetrap.js should have same content."
  exit 1
fi
