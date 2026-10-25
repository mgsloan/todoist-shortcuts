// Load settings before page scripts can register bindings. Dynamic scripts
// execute in insertion order when async is false.
function inject(scriptName) {
  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', chrome.runtime.getURL(scriptName));
  scriptEl.async = false;
  document.body.appendChild(scriptEl);
}

// MUTABLE. The options loader can report a recoverable error before returning
// defaults. That must not install a second copy of the keyboard handlers.
let scriptsInjected = false;
function start(options) {
  if (scriptsInjected) return;
  scriptsInjected = true;
  document.body.setAttribute(
      'data-todoist-shortcuts-options', JSON.stringify(options));
  document.body.setAttribute(
      'data-todoist-shortcuts-options-url',
      chrome.runtime.getURL('options-page.html'));
  inject('mousetrap.js');
  inject('todoist-shortcuts.js');
}

todoistShortcutsLoadOptions(start, (e) => {
  console.warn('Failed to load settings; using defaults:', e);
  start({});
});
