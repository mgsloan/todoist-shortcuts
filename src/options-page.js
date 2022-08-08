document.addEventListener('DOMContentLoaded', () => {
  const MOUSE_BEHAVIOR = 'mouse-behavior';
  const CURSOR_MOVEMENT = 'cursor-movement';

  const mouseBehaviorOptionEls =
        document.querySelectorAll('input[name="mouse-behavior"]');
  const cursorMovementOptionEls =
        document.querySelectorAll('input[name="cursor-movement"]');
  const statusEl = document.getElementById('status');
  let clearStatusTimeout = null;

  function save() {
    const options = {};
    for (const radioButton of mouseBehaviorOptionEls) {
      if (radioButton.checked) {
        options[MOUSE_BEHAVIOR] = radioButton.id;
        break;
      }
    }
    for (const radioButton of cursorMovementOptionEls) {
      if (radioButton.checked) {
        options[CURSOR_MOVEMENT] = radioButton.id;
        break;
      }
    }
    todoistShortcutsSaveOptions(options, () => {
      statusEl.textContent = 'Changes saved.';
      if (clearStatusTimeout) {
        clearTimeout(clearStatusTimeout);
      }
      clearStatusTimeout = setTimeout(() => {
        statusEl.textContent = '';
      }, 1000);
    });
  }

  function initialize(options) {
    const mouseBehavior = options[MOUSE_BEHAVIOR];
    let foundMouseBehaviorOption = false;
    for (const radioButton of mouseBehaviorOptionEls) {
      radioButton.addEventListener('click', save);
      if (radioButton.id === mouseBehavior) {
        radioButton.checked = true;
        foundMouseBehaviorOption = true;
      }
    }
    if (!foundMouseBehaviorOption) {
      console.warn('No mouse behavior option matching ' + mouseBehavior);
    }

    const cursorMovement = options[CURSOR_MOVEMENT];
    let foundCursorMovementOption = false;
    for (const radioButton of cursorMovementOptionEls) {
      radioButton.addEventListener('click', save);
      if (radioButton.id === cursorMovement) {
        radioButton.checked = true;
        foundCursorMovementOption = true;
      }
    }
    if (!foundCursorMovementOption) {
      console.warn('No cursor movement option matching ' + cursorMovement);
    }
  }

  todoistShortcutsLoadOptions(initialize, (e) => {
    alert('Oops, error while loading saved options... Error is:\n' + e);
  });
});
