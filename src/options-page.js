document.addEventListener('DOMContentLoaded', () => {
  const registry = window.TodoistShortcutsKeybindings;
  const statusEl = document.getElementById('status');
  const errorsEl = document.getElementById('keybindings-errors');
  const shortcutsStatusEl = document.getElementById('keybindings-status');
  const editorEl = document.getElementById('keybindings-editor');
  const formEl = document.getElementById('keybindings-form');
  // MUTABLE. Defaults and drafts are refreshed when preferences change.
  let currentOptions = {};
  let currentCatalog = [];
  let clearStatusTimeout = null;
  let resetUnknown = false;

  function reportError(error) {
    errorsEl.textContent = String(error.message || error);
  }

  function draftOverrides() {
    // Keep unknown IDs from other versions unless Reset all was requested.
    const draft = resetUnknown ? {} : JSON.parse(
        JSON.stringify(currentOptions.keybindings || {}));
    for (const mode of currentCatalog) {
      if (draft[mode.id] === null || typeof draft[mode.id] !== 'object' ||
          Array.isArray(draft[mode.id])) delete draft[mode.id];
      for (const binding of mode.bindings) {
        // The form is the source of known actions, including recovery from
        // malformed settings; retain only unknown IDs from the saved object.
        if (draft[mode.id]) delete draft[mode.id][binding.id];
        if (binding.fixed) continue;
        const input = document.getElementById(mode.id + ':' + binding.id);
        const keys = input.value.split('\n').map((key) => key.trim())
            .filter((key) => key.length);
        if (JSON.stringify(keys) !== JSON.stringify(binding.keys)) {
          if (!draft[mode.id]) draft[mode.id] = {};
          draft[mode.id][binding.id] = keys;
        }
      }
      if (draft[mode.id] && !Object.keys(draft[mode.id]).length) {
        delete draft[mode.id];
      }
    }
    return draft;
  }

  function renderBindings(options, draft) {
    currentCatalog = registry.catalog(options);
    editorEl.textContent = '';
    for (const mode of currentCatalog) {
      if (!mode.bindings.some((binding) => !binding.fixed)) continue;
      const section = document.createElement('details');
      section.dataset.modeSection = mode.id;
      section.open = mode.id === 'default';
      const summary = document.createElement('summary');
      summary.textContent = mode.title;
      section.appendChild(summary);
      for (const binding of mode.bindings) {
        const row = document.createElement('div');
        row.className = 'binding-row';
        const label = document.createElement('label');
        label.textContent = binding.label;
        row.appendChild(label);
        const defaults = document.createElement('p');
        defaults.textContent = 'Default: ' + binding.keys.join(' or ') +
          (binding.fixed ? ' (fixed)' : '');
        row.appendChild(defaults);
        if (!binding.fixed) {
          const input = document.createElement('textarea');
          input.id = mode.id + ':' + binding.id;
          input.dataset.mode = mode.id;
          input.dataset.action = binding.id;
          input.rows = Math.max(1, binding.keys.length);
          label.htmlFor = input.id;
          defaults.id = input.id + ':defaults';
          input.setAttribute('aria-describedby', defaults.id);
          const override = draft[mode.id] && draft[mode.id][binding.id];
          input.value = (Array.isArray(override) ? override : binding.keys)
              .join('\n');
          row.appendChild(input);
          const reset = document.createElement('button');
          reset.type = 'button';
          reset.textContent = 'Reset ' + binding.label;
          reset.dataset.reset = input.id;
          reset.addEventListener('click', () => {
            input.value = binding.keys.join('\n');
            shortcutsStatusEl.textContent = 'Defaults restored in the form.';
          });
          row.appendChild(reset);
        }
        section.appendChild(row);
      }
      editorEl.appendChild(section);
    }
  }

  // Read again before writing so preference autosave does not discard a
  // shortcut configuration saved by another options page.
  function persist(update, done, failed) {
    todoistShortcutsLoadOptions((options) => {
      const previous = Object.assign({}, options);
      try {
        update(options);
      } catch (e) {
        reportError(e);
        if (failed) failed(previous);
        return;
      }
      todoistShortcutsSaveOptions(options, () => {
        if (chrome.runtime.lastError) {
          reportError(chrome.runtime.lastError);
          return;
        }
        currentOptions = options;
        done(options);
      });
    }, reportError);
  }

  function savePreferences() {
    const draft = draftOverrides();
    persist((options) => {
      for (const name of ['mouse-behavior', 'cursor-movement']) {
        const checked = document.querySelector(
            'input[name="' + name + '"]:checked');
        if (checked) options[name] = checked.id;
      }
      // Also supports the prefix control when used together with PR #297.
      const prefix = document.getElementById('selection-prefix');
      if (prefix && prefix.value !== options['selection-prefix']) {
        options['selection-prefix'] = prefix.value;
        const result = registry.resolve(options.keybindings, options);
        if (result.errors.length) throw new Error(result.errors.join('\n'));
      }
    }, (options) => {
      renderBindings(options, draft);
      statusEl.textContent = 'Changes saved.';
      if (clearStatusTimeout) clearTimeout(clearStatusTimeout);
      clearStatusTimeout = setTimeout(() => {
        statusEl.textContent = '';
      }, 1000);
    }, (previous) => {
      currentOptions = previous;
      const prefix = document.getElementById('selection-prefix');
      if (prefix) prefix.value = previous['selection-prefix'] || '*';
      for (const name of ['mouse-behavior', 'cursor-movement']) {
        const radios = document.querySelectorAll('input[name="' + name + '"]');
        for (const radio of radios) radio.checked = radio.id === previous[name];
      }
      renderBindings(previous, draft);
    });
  }

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    errorsEl.textContent = '';
    shortcutsStatusEl.textContent = '';
    const draft = draftOverrides();
    const result = registry.resolve(draft, currentOptions);
    if (result.errors.length) {
      errorsEl.textContent = result.errors.join('\n');
      return;
    }
    persist((options) => {
      // Another options page may have changed the prefix since this form
      // opened. Validate against the settings that will actually be saved.
      const latest = registry.resolve(draft, options);
      if (latest.errors.length) throw new Error(latest.errors.join('\n'));
      options.keybindings = draft;
    }, () => {
      resetUnknown = false;
      shortcutsStatusEl.textContent =
        'Shortcuts saved. Reload your Todoist tabs.';
    });
  });

  document.getElementById('reset-keybindings').addEventListener('click', () => {
    resetUnknown = true;
    renderBindings(currentOptions, {});
    errorsEl.textContent = '';
    shortcutsStatusEl.textContent = 'Defaults restored in the form.';
  });

  todoistShortcutsLoadOptions((options) => {
    currentOptions = options;
    for (const name of ['mouse-behavior', 'cursor-movement']) {
      const radios = document.querySelectorAll('input[name="' + name + '"]');
      for (const radio of radios) {
        radio.checked = radio.id === options[name];
        radio.addEventListener('click', savePreferences);
      }
    }
    const prefix = document.getElementById('selection-prefix');
    if (prefix) {
      prefix.value = options['selection-prefix'] || '*';
      prefix.addEventListener('change', savePreferences);
    }
    // Invalid saved settings are shown as defaults with an explanation. Saving
    // or resetting can repair them without preventing the options page opening.
    const result = registry.resolve(options.keybindings, options);
    if (result.errors.length) {
      errorsEl.textContent = result.errors.join('\n');
    }
    renderBindings(options,
        result.errors.length ? {} : options.keybindings || {});
  }, reportError);
});
