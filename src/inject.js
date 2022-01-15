// Injects the main script. This is necessary in order to bind a
// keyhandler.

function inject(scriptName) {
  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('src', chrome.extension.getURL(scriptName));
  document.getElementsByTagName('body')[0].appendChild(scriptEl)
}

inject('mousetrap.js');
inject('todoist-shortcuts.js');
