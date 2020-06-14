#!/bin/bash -ex

./make-zip.sh
./node_modules/grunt/bin/grunt webstore_upload
