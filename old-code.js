// Code that is no longer used, which might be useful in the future.
//
// True, it could be fetched out of git history, but it's easier to keep track
// of useful chunks this way, without cluttering the code with commented out
// regions.

  // TODO: add issue tracker link.
  var TEMP_ITEM_TEXT =
      'todoist-shortcuts temporary item.  It\'s a bug if this sticks around.';

// Navigate to a project.
function goToProject() {
  var isAgenda = checkIsAgendaMode();
  withProjectSelection(isAgenda);
}


  function withProjectSelection(isAgenda) {
    withTempTask(isAgenda, function(task) {
      clickTaskMenu(task, MOVE_TEXT);
      withId('GB_window', function(modal) {
        withUniqueTag(modal, 'input', function(input) {
          // TODO: Center window
          //
          // FIXME: what happened to up / down arrows?
          var oldOnkeydown = input.onkeydown;
          input.onkeydown = function(ev) {
            if (ev.keyCode === 13) {
              console.log('Caught enter!');
              var match = getUniqueClass(modal, 'current_match');
              console.log(match);
            } else {
              oldOnkeydown(ev);
            }
          };
        });
      });
    });
  }

  function withTempTask(isAgenda, f) {
    var addClass = isAgenda ? 'agenda_add_task' : 'action_add_item';
    var addEls = document.getElementsByClassName(addClass);
    if (addEls.length > 0) {
      withHidden('.manager', function() {
        var addEl = addEls[addEls.length - 1];
        click(addEl);
        withUniqueClass(document, 'submit_btn', matchingText('Add Task'), function(submit) {
          withUniqueClass(document, 'richtext_editor', unconditional, function(editor) {
            // Create a CSS rule to hide the new task before it's even added.
            var hideSelecter = null;
            /* FIXME This got hairy doesn't work right, and probably won't be able to
            if (isAgenda) {
            } else {
              withUniqueClass(document, 'list_editor', unconditional, function(listEditor) {
                withUniqueClass(listEditor, 'items', unconditional, function(list) {
                  var items = listEditor.getElementsByTagName('li');
                  hideSelecter = [
                    '.list_editor > ul > li.item_task:last-child',
                    '.list_editor > ul > li.item_task:nth-last-child(2)'
                    ].join(', ');
                });
              });
            }
            */
            hide(hideSelecter);
            try {
              // Enter some text in and create the new item.
              editor.textContent = TEMP_ITEM_TEXT;
              click(submit);
              var allTasks = getTasks(true);
              if (allTasks.length === 0) {
                error('Expected to find tasks after adding temporary task');
                return;
              }
              var tempTask = allTasks[allTasks.length - 1];
              var tempTaskId = tempTask.id;
              cancelEmptyAdd();
            } catch (e) {
              show(hideSelecter);
              throw(e);
            }
            // TODO: Ideally could skip this timeout, but it seems that without
            // it, the task won't be initialized yet. (but verify this when
            // rechecking this)
            setTimeout(function() {
              try {
                f(tempTask);
              } finally {
                try {
                  withUniqueClass(tempTask, 'sel_item_content', function(content) {
                    // Sanity check to ensure we aren't deleting a user's task.
                    content.textContent = TEMP_ITEM_TEXT;
                    clickTaskMenu(tempTask, DELETE_TASK_TEXT);
                    confirmDelete();
                  });
                } finally {
                  show(hideSelecter);
                }
              }
            });
          });
        });
      });
    } else {
      warn('Couldn\'t find button to add task');
    }
  }

  // Press delete confirm button.
  function confirmDelete() {
    withUniqueClass(document, 'ist_button_red', matchingText(DELETE_CONFIRM_TEXT), click);
  }

  // A CSS style element, used to temporarily hide UI elements when they are
  // being manipulated.
  var hiddenStyle = addCss('');
  var hiddenSelecters = {};

  function updateHiddenStyle() {
    var selecters = [];
    for (var selecter in hiddenSelecters) {
      selecters.push(selecter);
    }
    if (selecters.length > 0) {
      hiddenStyle.textContent = selecters.join(', ') + ' { display: none; }';
    } else {
      hiddenStyle.textContent = '';
    }
  }

  function hide(selecter) {
    hiddenSelecters[selecter] = true;
    updateHiddenStyle();
  }

  function show(selecter) {
    delete hiddenSelecters[selecter];
    updateHiddenStyle();
  }

  function withHidden(selecter, f) {
    hide(selecter);
    try {
      f();
    } finally {
      show(selecter);
    }
  }


  /* FIXME: Doesn't work out because the menu doesn't stick around if the
  selection is removed, which makes sense.

  // If there are no selections, then temporarily selects the cursor, so that
  // actions that apply to selections will apply to it.
  //
  // The first argument is a boolean called "dangerous", indicating whether it is
  // difficult for the user to undo the action (ignoring the existence of the
  // undo command). This argument is combined with the WHAT_CURSOR_APPLIES_TO
  // global setting to determine whether to apply this behavior.
  //
  // NOTE: It might be better to avoid this hack, and instead invoke the more
  // direct actions.  However, I already wrote this and it seems to work.
  function maybe_with_cursor_selected(dangerous, f) {
    var should_apply = WHAT_CURSOR_APPLIES_TO == "all" ||
                         (WHAT_CURSOR_APPLIES_TO == "most" && !dangerous);
    if (should_apply) {
      var selections = getSelectedTaskKeys();
      if (isEmptyMap(selections)) {
        var prev_cursor_id = cursor_id;
        var cursor = getCursor();
        if (cursor) {
          shiftClickTask(cursor);
          try {
            f();
          } finally {
            // Deselect the task so that it's like
            prev_cursor = getId(prev_cursor_id);
            if (checkTaskIsSelected(prev_cursor)) {
              shiftClickTask(prev_cursor);
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
