"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { createContext, useContext, useId, useRef, type ComponentProps, type ReactNode } from "react";

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

// `row`: the whole row is dragged (a phone list); `handle`: only `SortableHandle` starts a drag (a desktop list).
export type SortableDragBy = "row" | "handle";

export interface SortableListProps extends Omit<ComponentProps<"ul">, "children"> {
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
  readonly children: ReactNode;
}

const HANDLE_MOUSE_DISTANCE = 4;

// The row follows the pointer up and down only.
const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function fillAnnouncement(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

interface SortableItemContextValue {
  readonly dragBy: SortableDragBy;
}

const SortableListContext = createContext<SortableItemContextValue>({ dragBy: "row" });

type SortableHandleBinding = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners" | "setActivatorNodeRef">;

const SortableHandleContext = createContext<SortableHandleBinding | null>(null);

// A list whose rows are reordered by dragging: a long press lifts a row on a touch screen (a swipe before the hold
// still scrolls, a tap still activates the row), a mouse drags it, the keyboard picks it up with Space or Enter and
// moves it with the arrows. The order stays with the app: `onReorder` gets the new one.
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
  className,
  children,
  ...props
}: SortableListProps) {
  const contextId = useId();
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

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.indexOf(String(active.id));
    const to = items.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove([...items], from, to), { id: String(active.id), from, to });
  }

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{ announcements: liveAnnouncements, screenReaderInstructions: { draggable: instructions } }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...items]} strategy={verticalListSortingStrategy}>
        <SortableListContext.Provider value={{ dragBy }}>
          <ul
            aria-label={label}
            data-slot="sortable-list"
            data-drag-by={dragBy}
            className={cn("flex flex-col", className)}
            {...props}
          >
            {children}
          </ul>
        </SortableListContext.Provider>
      </SortableContext>
    </DndContext>
  );
}

export interface SortableItemProps extends ComponentProps<"li"> {
  // The row's id, one of the list's `items`.
  readonly id: string;
}

// The lifted row floats on `accent-strong` with `shadow-menu`, above its siblings; `data-dragging` marks it.
const SORTABLE_ITEM =
  "rounded-md bg-background outline-none touch-manipulation select-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring data-[dragging]:relative data-[dragging]:z-10 data-[dragging]:bg-accent-strong data-[dragging]:shadow-menu";

// One row of a `SortableList`. In `row` mode the row itself is the drag target and is focusable; in `handle` mode a
// `SortableHandle` inside it is.
export function SortableItem({ id, className, style, children, ...props }: SortableItemProps) {
  const { dragBy } = useContext(SortableListContext);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    attributes: { role: "listitem" },
  });
  const rowBinding = dragBy === "row" ? { ...attributes, ...listeners } : {};
  return (
    <SortableHandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>
      <li
        ref={setNodeRef}
        data-slot="sortable-item"
        data-id={id}
        data-dragging={isDragging ? "" : undefined}
        className={cn(SORTABLE_ITEM, className)}
        style={{ ...style, transform: CSS.Translate.toString(transform), transition }}
        {...rowBinding}
        {...props}
      >
        {children}
      </li>
    </SortableHandleContext.Provider>
  );
}

export interface SortableHandleProps extends Omit<ComponentProps<typeof Button>, "children"> {
  // The handle's accessible name.
  readonly label?: string;
}

// A grip button that drags its row, for a list with `dragBy="handle"`.
export function SortableHandle({ label = messages.sortable.handle, className, ...props }: SortableHandleProps) {
  const binding = useContext(SortableHandleContext);
  if (!binding) throw new Error("SortableHandle failed: it must be rendered inside a SortableItem");
  const { attributes, listeners, setActivatorNodeRef } = binding;
  return (
    <Button
      ref={setActivatorNodeRef}
      type="button"
      variant="ghost"
      size="icon-sm"
      data-slot="sortable-handle"
      className={cn("cursor-grab touch-none text-muted-foreground active:cursor-grabbing", className)}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={label}
      {...props}
    >
      <GripVertical aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} />
    </Button>
  );
}
