// Per-run test data.  Every run gets its own project so that runs don't
// interfere with each other, and so cleanup can't touch anything else.

const api = require('./api');

const PROJECT_PREFIX = 'ts-test ';

class Fixture {
  constructor(project, tasks) {
    this.project = project;
    // Map from task content to the created task.
    this.tasks = tasks;
  }

  id(content) {
    const task = this.tasks[content];
    if (!task) throw new Error('No fixture task named ' + content);
    return task.id;
  }
}

// `contents` is a list of task contents, or of {content, priority} objects.
// Tasks are created in order, which is the order they appear in the project.
async function create(name, contents) {
  const project = await api.createProject(PROJECT_PREFIX + name);
  const tasks = {};
  for (const item of contents) {
    const fields = typeof item === 'string' ? {content: item} : item;
    tasks[fields.content] = await api.createTask(
        Object.assign({project_id: project.id}, fields));
  }
  return new Fixture(project, tasks);
}

async function destroy(fixture) {
  if (fixture && fixture.project) {
    await api.deleteProject(fixture.project.id);
  }
}

// Removes projects left behind by interrupted runs.
async function destroyStale() {
  const projects = await api.getProjects();
  const stale = projects.filter((p) => p.name.startsWith(PROJECT_PREFIX));
  for (const project of stale) {
    await api.deleteProject(project.id);
  }
  return stale.length;
}

module.exports = {Fixture, PROJECT_PREFIX, create, destroy, destroyStale};
