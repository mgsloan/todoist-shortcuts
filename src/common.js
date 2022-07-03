function todoistShortcutsSaveOptions(options, callback) {
  console.debug('Saving options: ', {...options});
  chrome.storage.sync.set({options: JSON.stringify(options)}, callback);
}

function todoistShortcutsLoadOptions(handleOptions, handleError) {
  const MOUSE_BEHAVIOR = 'mouse-behavior';
  const FOCUS_FOLLOWS_MOUSE = 'focus-follows-mouse';
  const NO_MOUSE_BEHAVIOR = 'no-mouse-behavior';

  try {
    chrome.storage.sync.get({options: '{}'}, (storedValues) => {
      const serializedOptions = storedValues['options'];
      let options = {};
      if (serializedOptions) {
        try {
          options = JSON.parse(serializedOptions);
        } catch (e) {
          handleError(e);
        }
      }

      console.debug(
        'Todoist shortcuts options before canonicalization: ', {...options});

      // Handle old settings
      let changed = false;
      if (FOCUS_FOLLOWS_MOUSE in options) {
        if (options[FOCUS_FOLLOWS_MOUSE]) {
          options[MOUSE_BEHAVIOR] = FOCUS_FOLLOWS_MOUSE;
        } else {
          options[MOUSE_BEHAVIOR] = NO_MOUSE_BEHAVIOR;
        }
        delete options[FOCUS_FOLLOWS_MOUSE];
        changed = true;
      }

      // Set defaults
      if (!(MOUSE_BEHAVIOR in options)) {
        options[MOUSE_BEHAVIOR] = FOCUS_FOLLOWS_MOUSE;
        changed = true;
      }

      // Save if canonicalization changed the options
      if (changed) {
        try {
          todoistShortcutsSaveOptions(options);
        } catch (e) {
          handleError(e);
        }
      }

      console.debug(
        'Todoist shortcuts options after canonicalization: ', {...options});
      handleOptions(options);
    });
  } catch (e) {
    handleError(e);
  }
}
