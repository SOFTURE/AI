---
change_id: theme-notion-sortable-gaps-771
---

# Research: theme-notion SortableList gaps (issue #771)

Read on master cac1e8e, `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0.

- `SortableList` builds one `DndContext` + `SortableContext` and renders its own `<ul>`; `SortableItem` calls
  `useSortable({ id, attributes: { role: "listitem" } })` and, in `row` mode, spreads `attributes` and `listeners`
  on the `<li>`; `SortableHandle` takes them through a context. `onReorder` fires only on a drop that changes the
  order (`handleDragEnd`).
- Disabled: `useSortable({ disabled })` takes a boolean or `{ draggable, droppable }`; `SortableContext` takes a
  list-wide `disabled` that the item value overrides. When draggable is disabled, `listeners` is `undefined` but
  `attributes` still carry `tabIndex: 0`, `aria-disabled` and the role description, so a read-only row would stay
  focusable unless the part stops spreading them.
- Groups: a droppable with `disabled: true` is left out of collision detection
  (`droppableContainers.getEnabled()`) and out of `sortableKeyboardCoordinates`, so a row whose group differs from
  the lifted row's never becomes `over`, by pointer or keyboard. The lifted row is readable inside the item through
  `useDndContext().active`, and `useSortable({ data })` carries the group to `active.data.current`.
- Callbacks: `DndContext` has `onDragStart`, `onDragEnd` (also when `over` is null: dropped outside) and
  `onDragCancel` (Escape, a resize, the page hidden).
- Listener names: `MouseSensor` binds `onMouseDown`, `TouchSensor` `onTouchStart`, `KeyboardSensor` `onKeyDown`.
  The keyboard sensor starts only when the key's target is the activator node (`setActivatorNodeRef`, the draggable
  node by default), so a key pressed on a button inside the row does not pick the row up. On the activator itself
  Space or Enter is `preventDefault`ed, which would swallow a button's own click: the keyboard pick-up cannot sit on
  an app button whose Enter already means something.
- `Slot` from `radix-ui` (`Slot.Root`, used by `Button asChild`) merges props, handlers and the ref onto the child.
- Click after a drop: the pointer sensors add a capture `click` listener on the document that stops propagation once
  a drag has started and remove it 50 ms after the end, so a click that follows a mouse drop already does not reach
  the row (the issue's optional point).
- Gallery cases render `SortableList[dragBy=row|handle]` and `tests/fixtures/notion-slots.json` pins their classes;
  a new class on the item would change that snapshot.
