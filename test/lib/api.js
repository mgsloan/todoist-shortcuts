// Thin wrapper around the Todoist API, used to seed fixtures and to check
// results.  Checking via the API rather than the DOM matters: several of the
// bugs this suite exists to catch are cases where the UI appears to accept a
// change that never gets saved.

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.todoist.com/api/v1';
const TOKEN_FILE = path.join(__dirname, '..', '..', 'etc', 'test-token');

let cachedToken = null;

function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = process.env.TODOIST_TEST_TOKEN;
  if (!cachedToken) {
    try {
      cachedToken = fs.readFileSync(TOKEN_FILE, 'utf8').trim();
    } catch (e) {
      throw new Error(
          'No API token. Put the *test* account\'s token in ' + TOKEN_FILE +
          ' (Todoist Settings -> Integrations -> Developer), or set ' +
          'TODOIST_TEST_TOKEN.');
    }
  }
  if (!cachedToken) throw new Error('Empty API token in ' + TOKEN_FILE);
  return cachedToken;
}

async function request(method, endpoint, body) {
  const response = await fetch(BASE + endpoint, {
    method: method,
    headers: {
      'Authorization': 'Bearer ' + getToken(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
        method + ' ' + endpoint + ' failed: ' + response.status + ' ' +
        (await response.text()));
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

// The v1 API paginates list endpoints as {results, next_cursor}.
async function requestAll(endpoint) {
  const results = [];
  let cursor = null;
  do {
    const sep = endpoint.includes('?') ? '&' : '?';
    const page = await request(
        'GET', endpoint + (cursor ? sep + 'cursor=' + cursor : ''));
    results.push(...(page.results || page));
    cursor = page.next_cursor || null;
  } while (cursor);
  return results;
}

async function getUser() {
  return await request('GET', '/user');
}

async function createProject(name) {
  return await request('POST', '/projects', {name: name});
}

async function deleteProject(id) {
  return await request('DELETE', '/projects/' + id);
}

async function getProjects() {
  return await requestAll('/projects');
}

// `priority` here is the API's numbering, where 4 is p1 (urgent) and 1 is p4
// (no priority).  See priorityOfLevel.
async function createTask(fields) {
  return await request('POST', '/tasks', fields);
}

async function getTasks(projectId) {
  return await requestAll('/tasks?project_id=' + projectId);
}

async function getTask(id) {
  return await request('GET', '/tasks/' + id);
}

// Waits for the task to have the expected API priority, since changes made in
// the browser take a moment to reach the server.
async function waitForPriority(id, expected, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = (await getTask(id)).priority;
    if (last === expected) return last;
    if (Date.now() > deadline) {
      throw new Error(
          'Timed out waiting for task ' + id + ' to have priority ' +
          expected + ' (API numbering); it is ' + last);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Polls until the function returns something truthy, so that tests don't race
// changes made in the browser reaching the server.
async function waitFor(what, fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  for (;;) {
    last = await fn();
    if (last) return last;
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for ' + what);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

// Completed tasks are still readable, so this is how to tell.  Deleted ones
// are readable too - see contentsOfProject for spotting those.
async function isChecked(id) {
  return Boolean((await getTask(id)).checked);
}

async function contentsOfProject(projectId) {
  return (await getTasks(projectId)).map((task) => task.content);
}

// Converts a UI priority level ("1" is urgent) to the API's inverted
// numbering.  todoist-shortcuts calls this direction invertPriorityLevel.
function priorityOfLevel(level) {
  const result = 5 - Number(level);
  if (result < 1 || result > 4) throw new Error('Bad level: ' + level);
  return result;
}

module.exports = {
  contentsOfProject,
  createProject,
  createTask,
  deleteProject,
  getProjects,
  getTask,
  getTasks,
  getUser,
  isChecked,
  priorityOfLevel,
  request,
  waitFor,
  waitForPriority,
};
