#!/bin/bash -ex

./make-zip.sh
./node_modules/grunt/bin/grunt webstore_upload

# FIXME: Why hasn't anyone automated this?! (as far as I can tell)

# http://addons-server.readthedocs.io/en/latest/topics/api/signing.html#uploading-without-an-id

# curl "https://addons.mozilla.org/api/v3/addons/" \
#  -g -XPOST -F "upload=@todoist-shortcuts.zip" -F "version=5" \
#  -H "Authorization: JWT <jwt-token>"
