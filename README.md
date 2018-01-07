## Navigation

| keys          | action                           |
| ---           | ---                              |
| j             | move cursor down                 |
| k             | move cursor up                   |
| h             | collapse nested at cursor        |
| l             | expand nested at cursor          |
| g g OR Ctrl+k | switch project via search prompt |
| g i           | go to inbox                      |
| g t           | go to today                      |
| g w           | go to next 7 days                |

## Manipulation of tasks at cursor

| keys       | action                 |
| ---        | ---                    |
| enter      | edit task at cursor    |
| o          | add task after cursor  |
| shift+o    | add task before cursor |
| ctrl+right | indent task at cursor  |
| ctrl+left  | dedent task at cursor  |

## Selection

| keys | action                                |
| ---  | ---                                   |
| x    | add task at cursor to selection       |
| * a  | select all tasks                      |
| * n  | clear selection                       |
| * 1  | add all priority 1 tasks to selection |
| * 2  | add all priority 2 tasks to selection |
| * 3  | add all priority 3 tasks to selection |
| * 4  | add all priority 4 tasks to selection |

## Manipulation of selected items

If none are selected, then these will probably apply to the cursor instead.

| keys | action                            |
| ---  | ---                               |
| t    | schedule                          |
| v    | move to project via search prompt |
| e    | archive / complete                |
| #    | delete                            |
| 1    | set priority to 1                 |
| 2    | set priority to 2                 |
| 3    | set priority to 3                 |
| 4    | set priority to 4                 |

## Scheduling

When scheduling is opened via "t", the following keybindings will apply:

| keys    | date         |
| ---     | ---          |
| t       | tomorrow     |
| n       | today        |
| w       | next week    |
| m       | month        |
| r       | remove       |
| 1 .. 31 | day of month |

# Todoist bugs

* Undo will not work for multiple completions or deletions

* In agenda mode, ids get duplicated

* In agenda mode, if you shift click a task that is in two spots, shift click
  should probably select both.

  - If you move the tasks so they are in the same day, they do not recombine!
    Another bug.

# Vimium

TODO: How to disallow escape?

`hjklxvtqaAuspr1234noO`

# Linting

npm install eslint eslint-config-es5
./node_modules/eslint/bin/eslint.js todoist-shortcuts.js
