// The id of the one-time announcement, read out of the source.
//
// The tests need it to say "this browser has already been shown that", which
// is keyed on the exact id. Reading it rather than repeating it here means
// announcing something new doesn't quietly turn the suppression off.

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(
    __dirname, '..', '..', 'src', 'todoist-shortcuts.js');

function readAnnouncement() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const key = /const ANNOUNCEMENT_SEEN_KEY = '([^']*)'/.exec(source);
  const id = /const ANNOUNCEMENT_ID = '([^']*)'/.exec(source);
  if (!key || !id) {
    throw new Error('No ANNOUNCEMENT_SEEN_KEY / ANNOUNCEMENT_ID in ' + SOURCE);
  }
  return {seenKey: key[1], id: id[1]};
}

module.exports = {readAnnouncement};
