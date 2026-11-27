# Plan review: theme-notion-table-view-settings

Verdict: approve. The plan builds on parts the package already tests (`Popover`, `Switch`, `SortableList`), adds one
new file and leaves `Table` alone, so it does not collide with #1528. The API is the issue's (`columns`, `onChange`,
`canHide`, an optional reorder, a pure helper, a store-backed hook). Loading the store after mount avoids a hydration
mismatch at the cost of one render with the defaults, which the README says. Keeping hidden columns in their slots on
reorder makes `onReorder` a full order the helper can apply directly. The tests cover the empty, boundary and
disabled cases. A minor release fits new exports.
