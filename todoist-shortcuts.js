"use strict";

// ==UserScript==
// @name        todoist-shortcuts
// @namespace   http://mgsloan.com
// @description Todoist keyboard shortcuts
// @include     https://todoist.com/*
// @include     http://todoist.com/*
// @version     1
// @grant       none
// ==/UserScript==

// Some code inspired by https://github.com/beda42/tdtimer

function userscript_todoist_shortcuts() {
  var DEBUG = true;

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

  // https://github.com/greasemonkey/greasemonkey/issues/2724#issuecomment-354005162
  function add_style(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
    return style;
  }

  // Had a tough time finding a good function to scroll into view, so wrote my own...
  /*
  function vertical_scroll_into_view(el, top_margin, bottom_margin) {
    const rect = el.getBoundingClientRect();
    if (rect.top < 0) {
      window.scrollBy(0, rect.top - top_margin);
    } else if (rect.bottom > window.innerWidth) {
      window.scrollBy(0, rect.bottom -
    }
  }
  */

  // Decided to instead have it make big jumps, like gmail.
  function vertical_scroll_into_view(el) {
    const rect = el.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      const top = rect.top + window.scrollY;
      // FIXME: for large tasks, this could end up with the whole task not being in view.
      window.scrollTo(0, top - window.innerHeight / 2);
    }
  }

  function get_tasks() {
    const results = [];
    const items = document.getElementsByClassName("task_item");
    for (var i = 0; i < items.length; i++) {
      const item = items[i];
      // Skip elements which don't correspond to tasks.
      if (!item.classList.contains("reorder_item")) {
        results.push(item);
      }
    }
    return results;
  }

  var selected_id = null;
  const selection_class = "userscript_selected";

  // Given the element for a task, set it as the current selection.
  function set_selected_item(item_element) {
    const old_selected = document.getElementsByClassName(selection_class);
    for (var i = 0; i < old_selected.length; i++) {
      old_selected[i].classList.remove(selection_class);
    }
    if(item_element) {
      selected_id = item_element.id;
      style_selected();
      vertical_scroll_into_view(item_element);
    } else {
      selected_id = null;
    }
  }

  const style = add_style("");

  // This is unusual.  Usually you would not dynamically generate CSS that uses different IDs.  However, this is a nice hack in this case, because todoist frequently re-creates elements.
  function style_selected() {
    style.textContent =
      "#" + selected_id + " {" +
      "  border-left: 2px solid #4d90f0;" +
      "  margin-left: -4px;" +
      "  padding-left: 2px !important;" +
      "}";
  }

  function get_selected_index(tasks) {
    if (selected_id) {
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].id ===  selected_id) {
          return i;
        }
      }
    }
    return null;
  }

  function get_selected_element() {
    return document.getElementById(selected_id);
  }

  function with_selected_content(f) {
    const matched = get_selected_element().getElementsByClassName("content");
    if (matched.length != 1) {
      warn("Expected to find exactly one '.content' element'. Found:", matched);
    } else {
      f(matched[0]);
    }
  }

  // A functional-ish idiom to reduce boilerplate.
  function modify_selected_index(f) {
    const tasks = get_tasks();
    var new_index = f(get_selected_index(tasks), tasks);
    if (new_index < 0) {
      new_index = 0;
    }
    if (new_index >= tasks.length) {
      new_index = tasks.length - 1;
    }
    set_selected_item(tasks[new_index]);
  }

  debug("Setting initial selection");
  const initial_tasks = get_tasks();
  debug("initial_tasks", initial_tasks);
  if (initial_tasks.length > 0) {
    set_selected_item(initial_tasks[0]);
  }

  debug("Registering keydown listener");
  document.addEventListener("keydown", function(ev) {
    // This may be too restrictive, but better to use a whitelist than a blacklist here.
    debug("keydown", ev);
    if (ev.srcElement == document.body) {
      debug("keydown", ev);
      switch(ev.key) {
        case "j":
          modify_selected_index(function(ix) { return ix + 1; })
          break;
        case "k":
          modify_selected_index(function(ix) { return ix - 1; })
          break;
        case "Enter":
          with_selected_content(function(el) { el.dispatchEvent(new Event("mousedown")); });
          break;
          /*
        case "x":
          const ev = new Event("mousedown");
          ev.shiftKey = true;
          get_selected_element().dispatchEvent(ev);
          break;
          */
      }
    }
  });
}

userscript_todoist_shortcuts();
