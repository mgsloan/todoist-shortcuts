document.addEventListener('DOMContentLoaded', () => {
  const FOCUS_FOLLOWS_MOUSE = 'focus-follows-mouse';
  const focusFollowsMouseEl = document.getElementById(FOCUS_FOLLOWS_MOUSE);
  const statusEl = document.getElementById('status');
  let clearStatusTimeout = null;

  function save() {
    const options = {};
    options[FOCUS_FOLLOWS_MOUSE] = focusFollowsMouseEl.checked;
    const valuesToSave = {options: JSON.stringify(options)};
    console.log('valuesToSave = ', valuesToSave);
    chrome.storage.sync.set(valuesToSave, () => {
      statusEl.textContent = 'Changes saved.';
      if (clearStatusTimeout) {
        clearTimeout(clearStatusTimeout);
      }
      clearStatusTimeout = setTimeout(() => {
        statusEl.textContent = '';
      }, 1000);
    });
  }

  function initialize(storedValues) {
    const serializedOptions = storedValues['options'];
    console.log('serializedOptions = ', serializedOptions);
    let options = {};
    if (serializedOptions) {
      try {
        options = JSON.parse(serializedOptions);
      } catch (e) {
        alert('Oops, failed to parse saved options.. Error is:\n' + e);
      }
    }
    focusFollowsMouseEl.checked = options[FOCUS_FOLLOWS_MOUSE];
    focusFollowsMouseEl.addEventListener('change', save);
  }

  chrome.storage.sync.get({options: '{}'}, initialize);
});
