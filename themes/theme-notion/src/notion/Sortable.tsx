"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDndContext,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Slot } from "radix-ui";
import { createContext, useContext, useId, useCallback, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";

import { en as messages } from "../messages/en.js";
import { cn } from "../lib/utils.js";
import { Button } from "../ui/button.js";
import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

// What a screen reader hears while a row moves. `{item}` is the row's label, `{position}` and `{total}` its place.
export interface SortableAnnouncements {
  readonly pickedUp: string;
  readonly moved: string;
  readonly dropped: string;
  readonly cancelled: string;
}

export interface SortableMove {
  readonly id: string;
  readonly from: number;
  readonly to: number;
}

// `row`: the whole row is dragged (a phone list); `handle`: only `SortableHandle` starts a drag (a desktop list);
// `activator`: a press on the app's own `SortableActivator` inside the row lifts it, with the row's hold, while the
// keyboard still picks up the focused row.
export type SortableDragBy = "row" | "handle" | "activator";

export interface SortableListProps
  extends Omit<ComponentProps<"ul">, "children" | "ref" | "onDragStart" | "onDragEnd"> {
  readonly ref?: Ref<HTMLUListElement | HTMLOListElement>;
  // The list's accessible name.
  readonly label: string;
  // The rows' ids in their current order; the app owns the order.
  readonly items: readonly string[];
  // Called on a drop that changes the order, with the new order and the move.
  readonly onReorder: (next: string[], move: SortableMove) => void;
  readonly dragBy?: SortableDragBy;
  // How long a press holds before the row lifts, in ms; a mouse in `handle` mode starts at once.
  readonly holdDelay?: number;
  // How far the pointer may move during the hold, in px; moving further scrolls instead of lifting.
  readonly tolerance?: number;
  // How to reorder from the keyboard, read when a row (or its handle) gets focus.
  readonly instructions?: string;
  readonly announcements?: Partial<SortableAnnouncements>;
  // A row's name in the announcements; defaults to its id.
  readonly getItemLabel?: (id: string) => string;
  // No row lifts by touch, mouse or keyboard; the rows still render and keep their own handlers.
  readonly disabled?: boolean;
  // The list element: `ol` for a numbered list. Children that are not a `SortableItem` stay in place.
  readonly as?: "ul" | "ol";
  // Called when a row lifts.
  readonly onDragStart?: (id: string) => void;
  // Called on every drop, with the move when the order changed and `null` when it did not.
  readonly onDragEnd?: (id: string, move: SortableMove | null) => void;
  // Called when a drag is cancelled (Escape, or the page lost focus).
  readonly onDragCancel?: (id: string) => void;
  readonly children: ReactNode;
}

const HANDLE_MOUSE_DISTANCE = 4;

// The row follows the pointer up and down only.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function fillAnnouncement(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node);
  else if (ref) ref.current = node;
}

// A row's group travels in the drag data; dnd-kit types that data loosely, so it is read as unknown.
function readGroup(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("group" in data)) return undefined;
  return typeof data.group === "string" ? data.group : undefined;
}

type SortableListeners = ReturnType<typeof useSortable>["listeners"];

// The keyboard sensor binds `onKeyDown`; the pointer sensors bind the rest.
function splitListeners(listeners: SortableListeners): { keyboard: SortableListeners; pointer: SortableListeners } {
  const entries = Object.entries(listeners ?? {});
  return {
    keyboard: Object.fromEntries(entries.filter(([name]) => name === "onKeyDown")),
    pointer: Object.fromEntries(entries.filter(([name]) => name !== "onKeyDown")),
  };
}

interface SortableListContextValue {
  readonly dragBy: SortableDragBy;
  readonly isDisabled: boolean;
}

const SortableListContext = createContext<SortableListContextValue>({ dragBy: "row", isDisabled: false });

interface SortableItemBinding extends Pick<ReturnType<typeof useSortable>, "attributes" | "listeners" | "setActivatorNodeRef"> {
  readonly dragBy: SortableDragBy;
  readonly isDisabled: boolean;
}

const SortableItemContext = createContext<SortableItemBinding | null>(null);

// A list whose rows are reordered by dragging: a long press lifts a row on a touch screen (a swipe before the hold
// still scrolls, a tap still activates the row), a mouse drags it, the keyboard picks it up with Space or Enter and
// moves it with the arrows. The order stays with the app: `onReorder` gets the new one. While a row is lifted the
// list carries `data-sorting`.
export function SortableList({
  label,
  items,
  onReorder,
  dragBy = "row",
  holdDelay = 500,
  tolerance = 8,
  instructions = messages.sortable.instructions,
  announcements,
  getItemLabel = (id) => id,
  disabled = false,
  as: List = "ul",
  onDragStart,
  onDragEnd,
  onDragCancel,
  ref,
  className,
  children,
  ...props
}: SortableListProps) {
  const contextId = useId();
  const [isSorting, setIsSorting] = useState(false);
  const hold = { delay: holdDelay, tolerance };
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: dragBy === "handle" ? { distance: HANDLE_MOUSE_DISTANCE } : hold,
    }),
    useSensor(TouchSensor, { activationConstraint: hold }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const copy = { ...messages.sortable, ...announcements };
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const total = items.length;

  function announce(template: string, id: UniqueIdentifier, overId?: UniqueIdentifier): string {
    const position = items.indexOf(String(overId ?? id)) + 1;
    return fillAnnouncement(template, { item: getItemLabel(String(id)), position, total });
  }

  const liveAnnouncements: Announcements = {
    onDragStart: ({ active }) => {
      lastOverId.current = active.id;
      return announce(copy.pickedUp, active.id);
    },
    onDragOver: ({ active, over }) => {
      // The first `over` of a drag is the row's own place: keep the "picked up" announcement.
      if (!over || over.id === lastOverId.current) return undefined;
      lastOverId.current = over.id;
      return announce(copy.moved, active.id, over.id);
    },
    onDragEnd: ({ active, over }) => announce(over ? copy.dropped : copy.cancelled, active.id, over?.id),
    onDragCancel: ({ active }) => announce(copy.cancelled, active.id),
  };

  // The move a drop makes, or null when it keeps the order (no target, the row's own place, another group).
  function getMove({ active, over }: DragEndEvent): SortableMove | null {
    if (!over || active.id === over.id) return null;
    if (readGroup(active.data.current) !== readGroup(over.data.current)) return null;
    const from = items.indexOf(String(active.id));
    const to = items.indexOf(String(over.id));
    if (from < 0 || to < 0) return null;
    return { id: String(active.id), from, to };
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsSorting(false);
    const move = getMove(event);
    if (move) onReorder(arrayMove([...items], move.from, move.to), move);
    onDragEnd?.(String(event.active.id), move);
  }

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{ announcements: liveAnnouncements, screenReaderInstructions: { draggable: instructions } }}
      onDragStart={({ active }) => {
        setIsSorting(true);
        onDragStart?.(String(active.id));
      }}
      onDragEnd={handleDragEnd}
      onDragCancel={({ active }) => {
        setIsSorting(false);
        onDragCancel?.(String(active.id));
      }}
    >
      <SortableContext items={[...items]} strategy={verticalListSortingStrategy}>
        <SortableListContext.Provider value={{ dragBy, isDisabled: disabled }}>
          <List
            ref={(node: HTMLUListElement | HTMLOListElement | null) => assignRef(ref, node)}
            aria-label={label}
            data-slot="sortable-list"
            data-drag-by={dragBy}
            data-disabled={disabled ? "" : undefined}
            data-sorting={isSorting ? "" : undefined}
            className={cn("flex flex-col", className)}
            {...props}
          >
            {children}
          </List>
        </SortableListContext.Provider>
      </SortableContext>
    </DndContext>
  );
}

export interface SortableItemProps extends ComponentProps<"li"> {
  // The row's id, one of the list's `items`.
  readonly id: string;
  // A lifted row lands only among rows of its own group; rows without one form a group of their own.
  readonly group?: string;
  // This row does not lift; it wins over the list's `disabled`. Other rows may still move past it.
  readonly disabled?: boolean;
}

// The lifted row floats on `accent-strong` with `shadow-menu`, above its siblings; `data-dragging` marks it.
const SORTABLE_ITEM =
  "rounded-md bg-background outline-none touch-manipulation select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring data-[dragging]:relative data-[dragging]:z-10 data-[dragging]:bg-accent-strong data-[dragging]:shadow-menu";

// The drag props the row element itself carries.
function getRowBinding(binding: SortableItemBinding) {
  if (binding.isDisabled || binding.dragBy === "handle") return {};
  if (binding.dragBy === "activator") return { ...binding.attributes, ...splitListeners(binding.listeners).keyboard };
  return { ...binding.attributes, ...binding.listeners };
}

// One row of a `SortableList`. In `row` mode the row itself is the drag target and is focusable; in `handle` mode a
// `SortableHandle` inside it is; in `activator` mode a `SortableActivator` takes the press and the row the keyboard.
// The drag's own pointer and key handlers win over the same props on the drag target; a key pressed on a control
// inside the row stays with that control.
export function SortableItem({ id, group, disabled, className, style, children, ...props }: SortableItemProps) {
  const list = useContext(SortableListContext);
  const { active } = useDndContext();
  const isDisabled = disabled ?? list.isDisabled;
  const isOtherGroup = active !== null && readGroup(active.data.current) !== group;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { group },
    attributes: { role: "listitem" },
    disabled: { draggable: isDisabled, droppable: isOtherGroup },
  });
  const binding: SortableItemBinding = { attributes, listeners, setActivatorNodeRef, dragBy: list.dragBy, isDisabled };
  const isRowActivator = list.dragBy !== "handle";
  // The row is the keyboard's activator outside `handle` mode, so a key on a control inside the row stays there.
  const setRowRef = useCallback(
    (node: HTMLLIElement | null) => {
      setNodeRef(node);
      if (isRowActivator) setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef, isRowActivator],
  );
  return (
    <SortableItemContext.Provider value={binding}>
      <li
        ref={setRowRef}
        data-slot="sortable-item"
        data-id={id}
        data-group={group}
        data-disabled={isDisabled ? "" : undefined}
        data-dragging={isDragging ? "" : undefined}
        className={cn(SORTABLE_ITEM, className)}
        style={{ ...style, transform: CSS.Translate.toString(transform), transition }}
        {...props}
        {...getRowBinding(binding)}
      >
        {children}
      </li>
    </SortableItemContext.Provider>
  );
}

function useSortableItemBinding(part: string): SortableItemBinding {
  const binding = useContext(SortableItemContext);
  if (!binding) throw new Error(`${part} failed: it must be rendered inside a SortableItem`);
  return binding;
}

export type SortableActivatorProps = ComponentProps<typeof Slot.Root>;

// The app's own element inside a row (a button, a title) that lifts the row on a press, for a list with
// `dragBy="activator"`; a press elsewhere in the row does nothing. Its own click and keys keep working. In the other
// modes, or on a disabled row, it renders its child unchanged.
export function SortableActivator(props: SortableActivatorProps) {
  const binding = useSortableItemBinding("SortableActivator");
  const isBound = binding.dragBy === "activator" && !binding.isDisabled;
  const pointer = isBound ? splitListeners(binding.listeners).pointer : {};
  return <Slot.Root data-slot="sortable-activator" {...props} {...pointer} />;
}

export interface SortableHandleProps extends Omit<ComponentProps<typeof Button>, "children"> {
  // The handle's accessible name.
  readonly label?: string;
}

// A grip button that drags its row, for a list with `dragBy="handle"`.
// On a disabled row it is a disabled button.
export function SortableHandle({ label = messages.sortable.handle, className, disabled, ...props }: SortableHandleProps) {
  const { attributes, listeners, setActivatorNodeRef, isDisabled } = useSortableItemBinding("SortableHandle");
  const dragProps = isDisabled ? {} : { ...attributes, ...listeners };
  return (
    <Button
      ref={setActivatorNodeRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      data-slot="sortable-handle"
      className={cn("cursor-grab touch-none text-muted-foreground active:cursor-grabbing", className)}
      disabled={isDisabled || disabled}
      {...props}
      {...dragProps}
      role="button"
      aria-label={label}
    >
      <GripVertical aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
    </Button>
  );
}
