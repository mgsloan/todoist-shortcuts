document.addEventListener('DOMContentLoaded', () => {
  const MOUSE_BEHAVIOR = 'mouse-behavior';

  const mouseBehaviorOptionEls =
        document.querySelectorAll('input[name="mouse-behavior"]');
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
  }

  todoistShortcutsLoadOptions(initialize, (e) => {
    alert('Oops, error while loading saved options... Error is:\n' + e);
  });
});
