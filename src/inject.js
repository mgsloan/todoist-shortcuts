// Injects the main script. This is necessary in order to bind a
// keyhandler.

const scriptEl = document.createElement('script');
scriptEl.setAttribute('src', chrome.extension.getURL('todoist-shortcuts.js'));
document.getElementsByTagName('body')[0].appendChild(scriptEl)
