// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/*
// @include     http://todoist.com/*
// @version     1
// @grant       none
// ==/UserScript==

// Set timeout is a hack so that the mousetrap library will be in scope.
setTimeout(function() {
  'use strict';

  // Here's where the keybindings get specified. Of course, feel free to modify
  // this list, or modify this script in general.
  const bindings = [

    // Navigation
    ["j", move_down],
    ["k", move_up],
    ["h", collapse],
    ["l", expand],
    // TODO [["g g", "ctrl+k"], switch_project],
    ["g i", go_to_inbox],
    ["g t", go_to_today],
    ["g w", go_to_next_7],

    // Manipulation of tasks at cursor
    ["enter", edit],
    ['O', add_above],
    ['o', add_below],
    // TODO ["ctrl+right", indent],
    // TODO ["ctrl+left", dedent],

    // Selection
    ["x", toggle_select],
    ["* a", [select_all, cancel_empty_add]],
    ["* n", deselect_all],
    // NOTE: these are a bit different than gmail's "select unread" and similar,
    // as they add to the current selection. I think this is more useful.
    ["* 1", select_priority("1")],
    ["* 2", select_priority("2")],
    ["* 3", select_priority("3")],
    ["* 4", select_priority("4")],

    // Manipulation of selected items
    ["t", schedule],
    ["v", move_to_project],
    ["e", archive],
    ["#", delete_tasks],
    ["1", set_priority("1")],
    ["2", set_priority("2")],
    ["3", set_priority("3")],
    ["4", set_priority("4")],

    // Scheduling keybindings (requires schedule to be open)
    ["t", schedule_tomorrow],
    ["n", schedule_today],
    ["w", schedule_next_week],
    ["m", schedule_month],
    ["r", unschedule],

    // Misc
    // TODO: ["?", show_keybindings]
  ];

  // Which selection-oriented commands to apply to the cursor if there is no
  // selection. A few possible values:
  //
  // * "none" - never apply selection oriented commands to the cursor
  //
  // * "most" - apply to all commands that are easy to manually undo (everything
  //   but archive and delete)
  //
  // * "all" (default) - apply to all selection-oriented commands
  const apply_to_cursor = "all";

  // Set this to true to get more log output.
  const DEBUG = true;

  // Constants for various todoist ids, classes, and text. Non-exhaustive.
  const todoist_root_id = "todoist_app";
  const edit_click_class = "content";
  const actions_bar_class = "item_selecter";
  const project_complete_class = "ist_complete_select";
  const arrow_class = "arrow";
  const calendar_class = "minical_container";

  const schedule_text = "Schedule";
  const move_text = "Move to project";
  const archive_text = "Archive";
  const delete_text = "Delete";
  const add_above_text = "Add task above";
  const add_below_text = "Add task below";

  // NOTE: These do not need to be exhaustive, they just need to be sufficient
  // to uniquely identify the menu. At least in their current usage.
  const more_menu_items =
    [archive_text, "Duplicate", delete_text, "Add label", "Remove label"];
  const task_menu_items =
    [add_above_text, add_below_text];

  // This user script will get run on iframes and other todoist pages. Should
  // skip running anything if #todoist_app doesn't exist.
  const todoist_root_div = document.getElementById(todoist_root_id);
  if (!todoist_root_div) return;

  // Misc TODO:
  //
  // * Check todoist version number and give a warning if it hasn't been tested
  //   yet.
  //
  // * Allow using ctrl+arrows while editing text of a task.
  //
  // * In schedule view with nesting, some ids can occur multiple times,
  //   screwing up cursor movement.
  //
  // * In agenda view, cursor should be able to focus empty days, for the
  //   purpose of adding tasks.
  //
  // * Also have "s" mean schedule?
  //
  // * What is postpone?
  //
  // * Enter day of month + move between months.

  /*****************************************************************************
   * Actions
   */

  // Move the cursor up and down.
  function move_down() { modify_cursor_index(function(ix) { return ix + 1; });}
  function move_up() { modify_cursor_index(function(ix) { return ix - 1; }); }

  // Edit the task under the cursor.
  function edit() {
    with_unique_class(get_cursor(), edit_click_class, function(content) {
      content.dispatchEvent(new Event("mousedown"));
    });
  }

  // Toggles selection of the task focused by the cursor.
  function toggle_select() {
    const selected = get_selected_task_ids();
    if (cursor_id) {
      // See the docs for shift_click_task for why deselection is so much easier
      // than selection.
      if (selected[cursor_id]) {
        shift_click_task(get_cursor());
      } else {
        selected[cursor_id] = true;
        set_selections(selected);
      }
    } else {
      warn("No cursor, so can't select");
    }
  }

  // Clicks the "schedule" link when items are selected.
  function schedule() {
    // Only open calendar if it isn't already open. This allows "t" to also be
    // used for selecting "tomorrow".
    if (get_unique_class(document, calendar_class)) {
      debug("Not opening schedule because it is already open.");
    } else {
      with_id(actions_bar_class, function(parent) {
        click_link(parent, schedule_text);
      });
    }
  }

  // Click "today" in schedule. Only does anything if schedule is open.
  function schedule_today() {
    with_calendar(function(calendar) {
      with_unique_tag_text(calendar, "span", "2", function(el) {
        el.click();
      });
    });
  }

  // Click "tomorrow" in schedule. Only does anything if schedule is open.
  function schedule_tomorrow() {
    with_calendar(function(calendar) {
      with_unique_class(calendar, "cmp_scheduler_tomorrow", function(el) {
        el.click();
      });
    });
  }

  // Click "next week" in schedule. Only does anything if schedule is open.
  function schedule_next_week() {
    with_calendar(function(calendar) {
      with_unique_class(calendar, "cmp_scheduler_next_week", function(el) {
        el.click();
      });
    });
  }

  // Click "next month" in schedule. Only does anything if schedule is open.
  function schedule_month() {
    with_calendar(function(calendar) {
      with_unique_class(calendar, "cmp_scheduler_month", function(el) {
        el.click();
      });
    });
  }

  // Click "no due date" in schedule. Only does anything if schedule is open.
  function unschedule() {
    with_calendar(function(calendar) {
      with_unique_tag_text(calendar, "span", "X", function(el) {
        el.click();
      });
    });
  }

  // Clicks the "Move to project" link when items are selected.
  function move_to_project() {
    with_id(actions_bar_class, function(parent) {
      click_link(parent, move_text);
    });
    // The keyboard shortcut used to invoke this also ends up in the completion
    // box. I thought stopPropagation would fix this, but it doesn't. So, empty
    // the completion input.
    setTimeout(function() { fill_project_input(""); }, 0);
  }

  // Fills in the text of the project selection completion.
  function fill_project_input(text) {
    with_unique_class(document, project_complete_class, function(complete) {
      with_unique_tag(complete, "input", function(input) {
        input.value = text;
        // FIXME: Initially doesn't show projects list because setting 'value'
        // doesn't trigger any events. However, neither a bare keydown or change
        // work. Requires further investigation.
        //
        // input.dispatchEvent(new Event("keydown"));
      });
    });
  }

  // Sets the priority of the selected items to the specified level.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function set_priority(level) {
    return function() {
      with_unique_class(document, "priority_menu", function(menu) {
        with_unique_class(menu, "cmp_priority" + level, function(img) {
          with_restored_selections(function() { img.click(); });
        });
      });
    };
  }

  // Adds tasks matching the specified priority level to the current selection,
  // even if they are hidden by collapsing.
  //
  // TODO: Should it select items hidden by collapsing? Tricky call.
  //
  // NOTE: this returns a function so that it can be used conveniently in the
  // keybindings.
  function select_priority(level) {
    return function() {
      var actual_level = "";
      // Yup, todoist has mixed up conventions for priority number...
      if (level == "1") {
        actual_level = "4";
      } else if (level == "2") {
        actual_level = "3";
      } else if (level == "3") {
        actual_level = "2";
      } else if (level == "4") {
        actual_level = "1";
      } else {
        error("Unrecognized level in select_priority", level);
      }
      var all_tasks = get_tasks(true);
      const class_to_match = "priority_" + actual_level;
      const selected = get_selected_task_ids();
      var modified = false;
      for (var i = 0; i < all_tasks.length; i++) {
        const task = all_tasks[i];
        if (task.classList.contains(class_to_match)) {
          selected[task.id] = true;
          modified = true;
        }
      }
      if (modified) {
        set_selections(selected);
      }
    };
  }

  // Archive selected tasks. Note that this appears to be the same thing as
  // marking a task complete.
  function archive() { click_menu(more_menu, archive_text); }

  // Delete selected tasks. Todoist will prompt for deletion.
  function delete_tasks() { click_menu(more_menu, delete_text); }

  // Toggles collapse / expand task under the cursor, if it has children.
  function toggle_collapse() {
    with_unique_class(get_cursor(), arrow_class, function(el) {
      el.click();
    });
  }

  // Expands or collapses task under the cursor, that have children. Does
  // nothing if it's already in the desired state.
  function collapse() { if (cursor_is_expanded()) { toggle_collapse(); } }
  function expand() { if (cursor_is_collapsed()) { toggle_collapse(); } }

  // Clears all selections.
  function deselect_all() {
    const selected = get_selected_task_ids();
    for (var id in selected) with_id(id, shift_click_task);
  }

  // Selects all tasks, even those hidden by collapsing.
  function select_all() {
    select_all_internal();
  }

  // Clicks "cancel" on inline add of a task, if there's no task in the entry
  // box. This is a hacky workaround for usage of "a" in the default keybinding
  // for select_all.
  function cancel_empty_add() {
    setTimeout(function() {
      with_unique_class(document, "richtext_editor", function(editor) {
        if (editor.textContent == "") {
          cancel_add();
        } else {
          warn("Not cancelling add because it has text.");
        }
      });
    });
  }

  // Clicks "cancel" on inline add of a task.
  function cancel_add() {
    with_unique_class(document, "cancel", function(cancel) {
      cancel.click();
    });
  }

  // Add a tasks above / below cursor.
  function add_above() { click_task_menu(add_above_text); }
  function add_below() { click_task_menu(add_below_text); }

  // Navigate to inbox.
  function go_to_inbox() {
    with_unique_class(document, "cmp_filter_inbox", function(img) { img.click(); });
  }

  // Navigate to today.
  function go_to_today() {
    with_unique_class(document, "cmp_filter_today", function(img) { img.click(); });
  }

  // Navigate to today.
  function go_to_next_7() {
    with_unique_class(document, "cmp_filter_days", function(img) { img.click(); });
  }

  /*****************************************************************************
   * Utilities for manipulating the UI
   */

  var last_shift_clicked = null;

  // Given a task element, shift-clicks it. Unfortunately, todoist currently has
  // quite strange behavior:
  //
  // * Shift clicking a selected task deselects a single task.
  //
  // * Shift clicking an unselected task toggles the selection state of all the
  //   tasks between the current task and the other tasks.
  //
  // To work around this, when selecting a previously deselected item,
  // 'set_selections' is used.
  function shift_click_task(el) {
    const mde = new Event("mousedown");
    mde.shiftKey = true;
    el.dispatchEvent(mde);
    // TODO: Should handle this via a mousedown handler, so that it keeps track
    // of mouseclicks too.  Otherwise could get wonky behavior in
    last_shift_clicked = el.id;
  }

  // Like select_all, but returns the list of task elements.
  function select_all_internal() {
    deselect_all();
    const all_tasks = get_tasks(true);
    if (all_tasks.length > 0) {
      shift_click_task(all_tasks[0]);
      if (all_tasks.length > 1) {
        shift_click_task(all_tasks[all_tasks.length - 1]);
      }
    }
    return all_tasks;
  }

  // Ensures that the specified task ids are selected (specified by a set-like
  // object). The algorithm for this is quite ugly and inefficient, due to the
  // strange todoist behavior mentioned above.
  function set_selections(ids) {
    const start_time = Date.now();
    const all_tasks = select_all_internal();
    // Then deselect all of the things that shouldn't be selected.
    for (var i = 0; i < all_tasks.length; i++) {
      const task = all_tasks[i];
      if (!ids[task.id] && task_is_selected(task)) {
        shift_click_task(task);
      }
    }
    debug("set_selections timing:", Date.now() - start_time);
  }

  function register_top_bar_visibility_hack() {
    const observer = new MutationObserver(function() {
      // If there are selections but the top bar isn't visible, then toggle the
      // last clicked item.
      if(!get_id(actions_bar_class)) {
        const selections = get_selected_task_ids();
        if (!is_empty_map(selections)) {
          let last = document.getElementById(last_shift_clicked);
          if (last) {
            debug("Detected that top bar isn't visible when it should be.  Attempting workaround.");
            shift_click_task(last);
            shift_click_task(last);
            if (get_id(actions_bar_class)) {
              debug("Workaround successful!");
            } else {
              warn("Workaround failed...");
            }
          } else {
            warn("Actions bar isn't visible even though there are selections, and last clicked task is gone.");
          }
        }
      }
    });
    observer.observe(document.body, { childList: true });
  }

  // For some reason todoist clears the selections even after applying things
  // like priority changes. This restores the selections.
  function with_restored_selections(f) {
    const old_selections = get_selected_task_ids();
    try {
      f();
    } finally {
      set_selections(old_selections);
    }
  }

  // Finds a <a> element with the specified text and clicks it.
  function click_link(parent, text) {
    with_unique_tag_text(parent, "a", text, function(matched) {
      matched.click();
    });
  }

  // Finds a menu element. These do not have any unique class or ID, so instead
  // need to do it by looking at text content of the options.
  function find_menu(name, expected_items) {
    const results = [];
    with_class(document, "ist_menu", function(menu) {
      var matches = true;
      for (var i = 0; i < expected_items.length; i++) {
        if (!get_unique_tag_text(menu, "span", expected_items[i])) {
          matches = false;
          break;
        }
      }
      if (matches) {
        results.push(menu);
      }
    });
    if (results.length == 1) {
      return results[0];
    } else {
      warn("Couldn't find " + name + " menu element.");
      return null;
    }
  }

  // These are menus that are always in the DOM, but need to be located by text
  // matching their options.
  const more_menu = find_menu("'More...'", more_menu_items);

  function click_menu(menu, text) {
    if (menu) {
      with_unique_tag_text(menu, "span", text, function(el) {
        el.click();
      });
    } else {
      error("Can't perform action due to not finding menu element.");
    }
  }

  // Returns true if the node under the cursor has children and is collapsed.
  function cursor_is_collapsed() {
    return get_unique_class(get_cursor(), "cmp_open_arrow_right");
  }

  // Returns true if the node under the cursor has children and is expanded.
  function cursor_is_expanded() {
    return get_unique_class(get_cursor(), "cmp_open_arrow_down");
  }

  // Opens up the task's contextual menu and clicks an item via text match.
  function click_task_menu(text) {
    var menu = get_first_class(get_cursor(), "menu");
    menu.click();
    const task_menu = find_menu("task", task_menu_items);
    click_menu(task_menu, text);
  }

  function with_calendar(f) {
    const calendar = get_unique_class(document, calendar_class);
    if (calendar) {
      f(calendar);
    } else {
      debug("Calendar is not open");
    }
  }

  /* TODO Make it so that after adding a task, the cursor will be on it?

  function register_editor_keybindings() {
    with_id("#editor", function(editor) {
      const observer = new MutationObserver(function() {

      });
      // TODO: Figure out how to observe less? This seems fine for now.
      observer.observe(editor, { childList: true, subtree: true });
    });
  } */

  /* FIXME: Doesn't work out because the menu doesn't stick around if the
  selection is removed, which makes sense.

  // If there are no selections, then temporarily selects the cursor, so that
  // actions that apply to selections will apply to it.
  //
  // The first argument is a boolean called"dangerous", indicating whether it is
  // difficult for the user to undo the action (ignoring the existence of the
  // undo command). This argument is combined with the apply_to_cursor global
  // setting to determine whether to apply this behavior.
  //
  // NOTE: It might be better to avoid this hack, and instead invoke the more
  // direct actions.  However, I already wrote this and it seems to work.
  function maybe_with_cursor_selected(dangerous, f) {
    const should_apply = apply_to_cursor == "all" ||
                         (apply_to_cursor == "most" && !dangerous);
    if (should_apply) {
      const selections = get_selected_task_ids();
      if (is_empty_map(selections)) {
        const prev_cursor_id = cursor_id;
        const cursor = get_cursor();
        if (cursor) {
          shift_click_task(cursor);
          try {
            f();
          } finally {
            // Deselect the task so that it's like
            prev_cursor = get_id(prev_cursor_id);
            if (task_is_selected(prev_cursor)) {
              shift_click_task(prev_cursor);
            }
          }
        } else {
          debug("Skipping action because there is no selections or cursor");
        }
      } else {
        f();
      }
    } else {
      f();
    }
  }
  */

  /*****************************************************************************
   * Enumeration of tasks
   */

  // Get the <li> elements for all the tasks visible in the current view.
  function get_tasks(include_collapsed) {
    const results = [];
    with_class(document, "task_item", function(item) {
      // Skip elements which don't correspond to tasks, and skip nested tasks
      // that are not visible (if include_collapsed is not set).
      if (!item.classList.contains("reorder_item") &&
          (include_collapsed || item.style.display != "none")) {
        results.push(item);
      }
    });
    return results;
  }

  // This returns the ids of all the selected items as a set-like object.
  function get_selected_task_ids() {
    const results = {};
    const tasks = get_tasks(true);
    for (var i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task_is_selected(task)) {
        results[task.id] = true;
      }
    }
    return results;
  }

  function task_is_selected(task) {
    return task.classList.contains("selected");
  }

  /*****************************************************************************
   * Task cursor
   */

  // The id of the task that the cursor is on.
  var cursor_id = null;

  // Class used on the single task that the cursor is on.
  const cursor_class = "userscript_cursor";

  // Sets the cursor to the first task, if any exists.
  function set_cursor_to_first_task() {
    const tasks = get_tasks();
    if (tasks.length > 0) {
      set_cursor(tasks[0]);
    }
  }

  // Given the element for a task, set it as the current selection.
  function set_cursor(item_element) {
    with_class(document, cursor_class, function(old_cursor) {
      old_cursor.classList.remove(cursor_class);
    });
    if(item_element) {
      cursor_id = item_element.id;
      update_cursor_style();
      vertical_scroll_into_view(item_element);
    } else {
      cursor_id = null;
    }
  }

  // Static styling.  This does the following:
  //
  // * Makes it so that the actions bar doesn't animate its opacity. This way,
  //   the bug worked around by register_top_bar_visibility_hack is less
  //   apparent.
  add_style([
    "#" + actions_bar_class + " {",
    "  opacity: 1 !important;",
    "}",
    ].join("\n"));

  // A CSS style element, dynamically updated by update_cursor_style.
  const style = add_style("");

  // This is unusual. Usually you would not dynamically generate CSS that uses
  // different IDs. However, this is a nice hack in this case, because todoist
  // frequently re-creates elements.
  function update_cursor_style() {
    style.textContent = [
      "#" + cursor_id + " {",
      "  border-left: 2px solid #4d90f0;",
      "  margin-left: -4px;",
      "}",
      "#" + cursor_id + " .sel_checkbox_td {",
      "  padding-left: 2px;",
      "}",
      "#" + cursor_id + " .arrow, #" + cursor_id + " .drag_and_drop_handler {",
      "  margin-left: -16px;",
      "}",
      ].join("\n");
  }

  // Given a list of task elements (yielded by get_tasks), returns the index
  // that corresponds to cursor_id.
  function get_cursor_index(tasks) {
    if (cursor_id) {
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id ===  cursor_id) {
          return i;
        }
      }
    }
    return null;
  }

  // Returns the <li> element which corresponds to the current cursor_id.
  function get_cursor() {
    return document.getElementById(cursor_id);
  }

  // A functional-ish idiom to reduce boilerplate.
  function modify_cursor_index(f) {
    const tasks = get_tasks();
    var new_index = f(get_cursor_index(tasks), tasks);
    if (new_index < 0) {
      new_index = 0;
    }
    if (new_index >= tasks.length) {
      new_index = tasks.length - 1;
    }
    set_cursor(tasks[new_index]);
  }

  /*****************************************************************************
   * Utilities
   */

  function debug(...args) {
    if (DEBUG) {
       args.unshift("todoist-shortcuts:");
       console.log.apply(null, args);
    }
  }

  function warn(...args) {
    args.unshift("todoist-shortcuts:");
    console.warn.apply(null, args);
  }


  function error(...args) {
    args.unshift("todoist-shortcuts:");
    console.error.apply(null, args);
  }

  // https://github.com/greasemonkey/greasemonkey/issues/2724#issuecomment-354005162
  function add_style(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    return style;
  }

  // Scrolls the specified element into view by positioning the top of the
  // element in the middle of the window, but only if necessary to bring it into
  // view. Does not work well for elements that are larger than half a screen
  // full.
  function vertical_scroll_into_view(el) {
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      const top = rect.top + window.scrollY;
      // FIXME: for large tasks, this could end up with the whole task not being
      // in view.
      window.scrollTo(0, top - window.innerHeight / 2);
    }
  }

  // Alias for document.getElementById
  function get_id(id) { return document.getElementById(id); }

  // Invokes the function for the matching id, or logs a warning.
  function with_id(id, f) {
    const el = get_id(id);
    if (el) {
      return f(el);
    } else {
      warn("Couldn't find ID", id);
      return null;
    }
  }

  // Invokes the function for every child element that matches the class name.
  function with_class(parent, cls, f) {
    const els = parent.getElementsByClassName(cls);
    for (var i = 0; i < els.length; i++) {
      f(els[i]);
    }
  }

  // Returns first child that matches the specified class.
  function get_first_class(parent, cls) {
    const els = parent.getElementsByClassName(cls);
    if (els.length > 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the class name,
  // and returns it.  Returns null if it is not found or not unique.
  function get_unique_class(parent, cls) {
    const els = parent.getElementsByClassName(cls);
    if (els.length == 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the class name,
  // and invokes the function on it. Logs a warning if there isn't exactly one.
  function with_unique_class(parent, cls, f) {
    const result = get_unique_class(parent, cls);
    if (result) {
      return f(result);
    } else {
      warn("Couldn't find unique child with class", cls, "instead got", els);
      return null;
    }
  }

  // Checks that there is only one child element that matches the tag, and
  // returns it. Returns null if it is not found or not unique.
  function get_unique_tag(parent, tag) {
    const els = parent.getElementsByTagName(tag);
    if (els.length == 1) {
      return els[0];
    } else {
      return null;
    }
  }

  // Checks that there is only one child element that matches the tag, and
  // invokes the function on it. Logs a warning if there isn't exactly one.
  function with_unique_tag(parent, tag, f) {
    const result = get_unique_tag(parent, tag);
    if (result) {
      return f(result);
    } else {
      warn("Couldn't find unique child with tag", tag, "instead got", els);
      return null;
    }
  }

  // Attempts to find an element with the specified tag and textContent. Returns
  // null if it is not not found or not unique.
  function get_unique_tag_text(parent, tag, text) {
    var result = null;
    const els = parent.getElementsByTagName(tag);
    for (var i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.textContent == text) {
        if (!result) {
          result = el;
        } else {
          // Not a unique result, return null.
          return null;
        }
      }
    }
    return result;
  }

  // Attempts to find an element with the specified tag and textContent, and
  // invoked the function on it. Logs a warning if there isn't exactly one.
  function with_unique_tag_text(parent, tag, text, f) {
    var el = get_unique_tag_text(parent, tag, text);
    if (el) {
      f(el);
    } else {
      warn("Couldn't find", tag, "element matching the text", text);
    }
  }

  // Returns true if the map-like / set-like object is empty.
  function is_empty_map(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }

  /*****************************************************************************
   * Run todoist-shortcuts!
   */

  set_cursor_to_first_task();

  // Register mutation observers
  register_top_bar_visibility_hack();

  // Register key bindings
  for (var i = 0; i < bindings.length; i++) {
    if (bindings[i].length == 2) {
      var action = bindings[i][1];
      // Allow a list of functions to call.
      if (action instanceof Array) {
        const actions = action;
        action = function() {
          for (var j = 0; j < actions.length; j++) {
            actions[j]();
          }
        };
      }
      Mousetrap.bind(bindings[i][0], action);
    } else {
      error("Improper binding entry at index", i, "value is", bindings[i]);
    }
  }

}, 0);

/*****************************************************************************
 * mousetrap v1.6.1 craig.is/killing/mice
 */

(function(r,v,f){function w(a,b,g){a.addEventListener?a.addEventListener(b,g,!1):a.attachEvent("on"+b,g)}function A(a){if("keypress"==a.type){var b=String.fromCharCode(a.which);a.shiftKey||(b=b.toLowerCase());return b}return p[a.which]?p[a.which]:t[a.which]?t[a.which]:String.fromCharCode(a.which).toLowerCase()}function F(a){var b=[];a.shiftKey&&b.push("shift");a.altKey&&b.push("alt");a.ctrlKey&&b.push("ctrl");a.metaKey&&b.push("meta");return b}function x(a){return"shift"==a||"ctrl"==a||"alt"==a||
  "meta"==a}function B(a,b){var g,c,d,f=[];g=a;"+"===g?g=["+"]:(g=g.replace(/\+{2}/g,"+plus"),g=g.split("+"));for(d=0;d<g.length;++d)c=g[d],C[c]&&(c=C[c]),b&&"keypress"!=b&&D[c]&&(c=D[c],f.push("shift")),x(c)&&f.push(c);g=c;d=b;if(!d){if(!n){n={};for(var q in p)95<q&&112>q||p.hasOwnProperty(q)&&(n[p[q]]=q)}d=n[g]?"keydown":"keypress"}"keypress"==d&&f.length&&(d="keydown");return{key:c,modifiers:f,action:d}}function E(a,b){return null===a||a===v?!1:a===b?!0:E(a.parentNode,b)}function c(a){function b(a){a=
  a||{};var b=!1,l;for(l in n)a[l]?b=!0:n[l]=0;b||(y=!1)}function g(a,b,u,e,c,g){var l,m,k=[],f=u.type;if(!h._callbacks[a])return[];"keyup"==f&&x(a)&&(b=[a]);for(l=0;l<h._callbacks[a].length;++l)if(m=h._callbacks[a][l],(e||!m.seq||n[m.seq]==m.level)&&f==m.action){var d;(d="keypress"==f&&!u.metaKey&&!u.ctrlKey)||(d=m.modifiers,d=b.sort().join(",")===d.sort().join(","));d&&(d=e&&m.seq==e&&m.level==g,(!e&&m.combo==c||d)&&h._callbacks[a].splice(l,1),k.push(m))}return k}function f(a,b,c,e){h.stopCallback(b,
  b.target||b.srcElement,c,e)||!1!==a(b,c)||(b.preventDefault?b.preventDefault():b.returnValue=!1,b.stopPropagation?b.stopPropagation():b.cancelBubble=!0)}function d(a){"number"!==typeof a.which&&(a.which=a.keyCode);var b=A(a);b&&("keyup"==a.type&&z===b?z=!1:h.handleKey(b,F(a),a))}function p(a,c,u,e){function l(c){return function(){y=c;++n[a];clearTimeout(r);r=setTimeout(b,1E3)}}function g(c){f(u,c,a);"keyup"!==e&&(z=A(c));setTimeout(b,10)}for(var d=n[a]=0;d<c.length;++d){var m=d+1===c.length?g:l(e||
  B(c[d+1]).action);q(c[d],m,e,a,d)}}function q(a,b,c,e,d){h._directMap[a+":"+c]=b;a=a.replace(/\s+/g," ");var f=a.split(" ");1<f.length?p(a,f,b,c):(c=B(a,c),h._callbacks[c.key]=h._callbacks[c.key]||[],g(c.key,c.modifiers,{type:c.action},e,a,d),h._callbacks[c.key][e?"unshift":"push"]({callback:b,modifiers:c.modifiers,action:c.action,seq:e,level:d,combo:a}))}var h=this;a=a||v;if(!(h instanceof c))return new c(a);h.target=a;h._callbacks={};h._directMap={};var n={},r,z=!1,t=!1,y=!1;h._handleKey=function(a,
  c,d){var e=g(a,c,d),k;c={};var h=0,l=!1;for(k=0;k<e.length;++k)e[k].seq&&(h=Math.max(h,e[k].level));for(k=0;k<e.length;++k)e[k].seq?e[k].level==h&&(l=!0,c[e[k].seq]=1,f(e[k].callback,d,e[k].combo,e[k].seq)):l||f(e[k].callback,d,e[k].combo);e="keypress"==d.type&&t;d.type!=y||x(a)||e||b(c);t=l&&"keydown"==d.type};h._bindMultiple=function(a,b,c){for(var d=0;d<a.length;++d)q(a[d],b,c)};w(a,"keypress",d);w(a,"keydown",d);w(a,"keyup",d)}if(r){var p={8:"backspace",9:"tab",13:"enter",16:"shift",17:"ctrl",
  18:"alt",20:"capslock",27:"esc",32:"space",33:"pageup",34:"pagedown",35:"end",36:"home",37:"left",38:"up",39:"right",40:"down",45:"ins",46:"del",91:"meta",93:"meta",224:"meta"},t={106:"*",107:"+",109:"-",110:".",111:"/",186:";",187:"=",188:",",189:"-",190:".",191:"/",192:"`",219:"[",220:"\\",221:"]",222:"'"},D={"~":"`","!":"1","@":"2","#":"3",$:"4","%":"5","^":"6","&":"7","*":"8","(":"9",")":"0",_:"-","+":"=",":":";",'"':"'","<":",",">":".","?":"/","|":"\\"},C={option:"alt",command:"meta","return":"enter",
  escape:"esc",plus:"+",mod:/Mac|iPod|iPhone|iPad/.test(navigator.platform)?"meta":"ctrl"},n;for(f=1;20>f;++f)p[111+f]="f"+f;for(f=0;9>=f;++f)p[f+96]=f.toString();c.prototype.bind=function(a,b,c){a=a instanceof Array?a:[a];this._bindMultiple.call(this,a,b,c);return this};c.prototype.unbind=function(a,b){return this.bind.call(this,a,function(){},b)};c.prototype.trigger=function(a,b){if(this._directMap[a+":"+b])this._directMap[a+":"+b]({},a);return this};c.prototype.reset=function(){this._callbacks={};
  this._directMap={};return this};c.prototype.stopCallback=function(a,b){return-1<(" "+b.className+" ").indexOf(" mousetrap ")||E(b,this.target)?!1:"INPUT"==b.tagName||"SELECT"==b.tagName||"TEXTAREA"==b.tagName||b.isContentEditable};c.prototype.handleKey=function(){return this._handleKey.apply(this,arguments)};c.addKeycodes=function(a){for(var b in a)a.hasOwnProperty(b)&&(p[b]=a[b]);n=null};c.init=function(){var a=c(v),b;for(b in a)"_"!==b.charAt(0)&&(c[b]=function(b){return function(){return a[b].apply(a,
  arguments)}}(b))};c.init();r.Mousetrap=c;"undefined"!==typeof module&&module.exports&&(module.exports=c);"function"===typeof define&&define.amd&&define(function(){return c})}})("undefined"!==typeof window?window:null,"undefined"!==typeof window?document:null);
