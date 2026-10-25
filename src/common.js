function todoistShortcutsSaveOptions(options, callback) {
  console.debug('Saving options: ', Object.assign({}, options));
  chrome.storage.sync.set({options: JSON.stringify(options)}, callback);
}

// eslint-disable-next-line no-unused-vars
function todoistShortcutsLoadOptions(handleOptions, handleError) {
  const MOUSE_BEHAVIOR = 'mouse-behavior';
  const FOCUS_FOLLOWS_MOUSE = 'focus-follows-mouse';
  const NO_MOUSE_BEHAVIOR = 'no-mouse-behavior';

  const CURSOR_MOVEMENT = 'cursor-movement';
  const FOLLOWS_TASK_WITHIN_SECTION = 'follows-task-within-section';

  try {
    chrome.storage.sync.get({options: '{}'}, (storedValues) => {
      const failure = chrome.runtime && chrome.runtime.lastError;
      if (failure || !storedValues) {
        handleError(new Error(failure ? failure.message :
          'Storage did not return options.'));
        return;
      }
      const serializedOptions = storedValues['options'];
      let options = {};
      if (serializedOptions) {
        try {
          options = JSON.parse(serializedOptions);
          if (options === null || typeof options !== 'object' ||
              Array.isArray(options)) {
            throw new Error('Saved options must be an object.');
          }
        } catch (e) {
          options = {};
          handleError(e);
        }
      }

      console.debug(
          'Todoist shortcuts options before canonicalization: ',
          Object.assign({}, options));

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
      if (!(CURSOR_MOVEMENT in options)) {
        options[CURSOR_MOVEMENT] = FOLLOWS_TASK_WITHIN_SECTION;
      }

      if (!options.keybindings || typeof options.keybindings !== 'object' ||
          Array.isArray(options.keybindings)) {
        options.keybindings = {};
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
          'Todoist shortcuts options after canonicalization: ',
          Object.assign({}, options));
      handleOptions(options);
    });
  } catch (e) {
    handleError(e);
  }
}
