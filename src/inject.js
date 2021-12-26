// Injects the main script. This is necessary in order to bind a
// keyhandler.

const browser = window.browser || window.chrome;
function inject(scriptName) {
  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', browser.runtime.getURL(scriptName));
  // In testing doesn't seem to be necessary, but may lead to more
  // predictable execution order.
  scriptEl.setAttribute('defer', 'defer');
  document.getElementsByTagName('body')[0].appendChild(scriptEl);
}

// Set current options as an attribute on the body so that they are
// accessible to the injected scripts.
try {
  todoistShortcutsLoadOptions((options) => {
    document.body.setAttribute(
        'data-todoist-shortcuts-options', JSON.stringify(options));
  }, (e) => {
    console.warning('Failed to load settings:', e);
  });
} finally {
  // Inject the scripts
  inject('mousetrap.js');
  inject('todoist-shortcuts.js');

  // Set options URL so that help modal can link to it.
  document.body.setAttribute(
      'data-todoist-shortcuts-options-url',
      chrome.runtime.getURL('options-page.html'));
}
