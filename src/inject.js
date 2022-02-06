// Injects the main script. This is necessary in order to bind a
// keyhandler.

function inject(scriptName) {
  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', chrome.extension.getURL(scriptName));
  // In testing doesn't seem to be necessary, but may lead to more
  // predictable execution order.
  scriptEl.setAttribute('defer', 'defer');
  document.getElementsByTagName('body')[0].appendChild(scriptEl);
}

inject('mousetrap.js');
inject('todoist-shortcuts.js');
