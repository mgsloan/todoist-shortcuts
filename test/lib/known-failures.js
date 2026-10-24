// Verified upstream failures, scoped to the affected Todoist interface.
const UNDO = {
  experimental: 'Todoist experimental exposes no Undo popup; native Ctrl+Z ' +
    'also fails without the extension (verified 2026-10-23).',
};

module.exports = {UNDO};
