// Deletes test projects left behind by interrupted runs.

const api = require('./lib/api');
const fixtures = require('./lib/fixtures');

async function main() {
  const user = await api.getUser();
  const count = await fixtures.destroyStale();
  console.log(
      'Deleted ' + count + ' "' + fixtures.PROJECT_PREFIX + '" project(s) ' +
      'from ' + user.email + '.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
