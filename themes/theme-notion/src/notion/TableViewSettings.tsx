"use client";

import { SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "../lib/utils.js";
import { en } from "../messages/en.js";
import { Button } from "../ui/button.js";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.js";
import { Switch } from "../ui/switch.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import { SortableHandle, SortableItem, SortableList } from "./Sortable.js";

/** One column of a table as the view settings list it. */
export interface TableViewColumn {
  /** A stable id, rendered as `data-column` on the column's row. */
  readonly id: string;
  /** The column's name, from the app's message layer. */
  readonly label: string;
  readonly isVisible: boolean;
  /** `false` for a column that is always shown (the selection checkbox, the title): its switch is disabled. */
  readonly canHide?: boolean;
}

export type TableViewSettingsMessages = { readonly [Key in keyof (typeof en)["tableViewSettings"]]: string };

export interface TableViewSettingsProps {
  /** Every column of the table, in the table's order. */
  readonly columns: readonly TableViewColumn[];
  /** Called with the ids of the columns to show, in the columns' order. */
  readonly onChange: (nextVisibleIds: string[]) => void;
  /** The button's accessible name; `messages.trigger` ("View settings") when not given. */
  readonly label?: string;
  /** The panel's copy, replaced key by key with the app's own wording. */
  readonly messages?: Partial<TableViewSettingsMessages>;
  /** The shown columns can be reordered by dragging their handle (or by keyboard). Off by default. */
  readonly canReorder?: boolean;
  /** Called with every column id in its new order: the shown ones as dropped, the hidden ones in their slots. */
  readonly onReorder?: (nextOrder: string[]) => void;
  /** The panel's edge against the button; `end` by default. */
  readonly align?: "start" | "center" | "end";
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Classes of the button. */
  readonly className?: string;
}

const isHideable = (column: TableViewColumn): boolean => column.canHide !== false;

/** The full order after the shown columns were reordered: hidden columns keep their slots. */
function mergeShownOrder(columns: readonly TableViewColumn[], shownOrder: readonly string[]): string[] {
  let next = 0;
  return columns.map((column) => {
    if (!column.isVisible) return column.id;
    const id = shownOrder[next] ?? column.id;
    next += 1;
    return id;
  });
}

// Below `md` a row is the 44 px touch target; the whole row toggles its switch through its label.
const ROW_CLASS =
  "flex min-h-8 items-center gap-2 rounded-md px-2 text-sm hover:bg-accent max-md:min-h-touch-target has-[[data-disabled]]:hover:bg-transparent";
const GROUP_HEADING_CLASS = "flex min-h-7 items-center justify-between gap-2 px-2 text-section-label text-muted-foreground";

interface ColumnRowProps {
  readonly column: TableViewColumn;
  readonly switchId: string;
  readonly onToggle: (column: TableViewColumn, isVisible: boolean) => void;
}

function ColumnRowBody({ column, switchId, onToggle }: ColumnRowProps) {
  return (
    <>
      <label htmlFor={switchId} className="min-w-0 flex-1 cursor-pointer truncate py-1 has-[+[data-disabled]]:cursor-default">
        {column.label}
      </label>
      <Switch
        id={switchId}
        checked={column.isVisible}
        disabled={!isHideable(column)}
        onCheckedChange={(isVisible) => onToggle(column, isVisible)}
      />
    </>
  );
}

/**
 * A table's view settings, as Notion's "Properties" menu: a ghost icon button for the table's toolbar that opens a
 * panel listing every column with a switch, the shown columns first under "Hide all", the hidden ones under "Show
 * all". A column with `canHide: false` keeps its switch on and disabled. With `canReorder` the shown columns are
 * dragged by a handle (or moved by keyboard) to reorder the table. Tab moves between switches, Space toggles, Escape
 * closes and returns focus to the button.
 */
export function TableViewSettings({
  columns,
  onChange,
  label,
  messages,
  canReorder = false,
  onReorder,
  align = "end",
  open,
  defaultOpen,
  onOpenChange,
  className,
}: TableViewSettingsProps) {
  const copy = { ...en.tableViewSettings, ...messages };
  const baseId = useId();
  const headingId = `${baseId}-heading`;
  const shown = columns.filter((column) => column.isVisible);
  const hidden = columns.filter((column) => !column.isVisible);
  const canHideAny = shown.some(isHideable);

  const emit = (isVisible: (column: TableViewColumn) => boolean) =>
    onChange(columns.filter(isVisible).map((column) => column.id));

  const toggle = (target: TableViewColumn, isVisible: boolean) =>
    emit((column) => (column.id === target.id ? isVisible || !isHideable(column) : column.isVisible));

  const switchIdOf = (column: TableViewColumn) => `${baseId}-${column.id}`;

  const renderRow = (column: TableViewColumn) => (
    <div key={column.id} data-slot="table-view-settings-row" data-column={column.id} className={ROW_CLASS}>
      <ColumnRowBody column={column} switchId={switchIdOf(column)} onToggle={toggle} />
    </div>
  );

  return (
    <Popover {...(open === undefined ? {} : { open })} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          data-slot="table-view-settings-trigger"
          aria-label={label ?? copy.trigger}
          className={cn("text-muted-foreground max-md:size-touch-target", className)}
        >
          <SlidersHorizontal strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="table-view-settings"
        align={align}
        aria-labelledby={headingId}
        className="flex max-h-(--radix-popover-content-available-height) w-64 flex-col gap-1 overflow-y-auto p-1"
      >
        <h2 id={headingId} className="px-2 pt-1.5 pb-1 text-sm font-semibold">
          {copy.title}
        </h2>
        {shown.length > 0 ? (
          <section data-slot="table-view-settings-group" data-group="shown" aria-labelledby={`${baseId}-shown`}>
            <div className={GROUP_HEADING_CLASS}>
              <h3 id={`${baseId}-shown`}>{copy.shown}</h3>
              {canHideAny ? (
                <Button type="button" variant="ghost" size="xs" data-slot="table-view-settings-hide-all" className="text-link max-md:h-touch-target" onClick={() => emit((column) => !isHideable(column))}>
                  {copy.hideAll}
                </Button>
              ) : null}
            </div>
            {canReorder ? (
              <SortableList
                label={copy.reorder}
                items={shown.map((column) => column.id)}
                dragBy="handle"
                getItemLabel={(id) => columns.find((column) => column.id === id)?.label ?? id}
                onReorder={(next) => onReorder?.(mergeShownOrder(columns, next))}
              >
                {shown.map((column) => (
                  <SortableItem key={column.id} id={column.id} data-column={column.id} className={cn(ROW_CLASS, "bg-transparent pl-0")}>
                    <SortableHandle className="-mr-1 shrink-0" />
                    <ColumnRowBody column={column} switchId={switchIdOf(column)} onToggle={toggle} />
                  </SortableItem>
                ))}
              </SortableList>
            ) : (
              shown.map(renderRow)
            )}
          </section>
        ) : null}
        {hidden.length > 0 ? (
          <section data-slot="table-view-settings-group" data-group="hidden" aria-labelledby={`${baseId}-hidden`}>
            <div className={GROUP_HEADING_CLASS}>
              <h3 id={`${baseId}-hidden`}>{copy.hidden}</h3>
              <Button type="button" variant="ghost" size="xs" data-slot="table-view-settings-show-all" className="text-link max-md:h-touch-target" onClick={() => emit(() => true)}>
                {copy.showAll}
              </Button>
            </div>
            {hidden.map(renderRow)}
          </section>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/** A column the app defines, for `useTableColumns`. */
export interface TableColumnDefinition {
  readonly id: string;
  readonly label: string;
  /** `false` keeps the column always shown. */
  readonly canHide?: boolean;
  /** Shown when nothing is stored for it yet; `true` by default. */
  readonly isVisibleByDefault?: boolean;
}

/** What `useTableColumns` keeps: the shown ids and the order of every column. */
export interface TableColumnsState {
  readonly visible: readonly string[];
  readonly order: readonly string[];
}

/** Where `useTableColumns` keeps its state: local storage, the URL or the app's settings API, as the app decides. */
export interface TableColumnsStore {
  /** The stored state, or `null` when nothing is stored. Called once, after the component mounts. */
  readonly load: () => TableColumnsState | null;
  /** Called with the new state on every change made through the hook. */
  readonly save: (state: TableColumnsState) => void;
}

export interface UseTableColumnsOptions {
  readonly columns: readonly TableColumnDefinition[];
  readonly store?: TableColumnsStore;
}

export interface TableColumnsView {
  /** Every column in its order with its visibility: `TableViewSettings`'s `columns`. */
  readonly columns: TableViewColumn[];
  /** The shown ids, in order: `applyColumnVisibility`'s `visibleIds`. */
  readonly visibleIds: string[];
  readonly order: string[];
  /** `TableViewSettings`'s `onChange`. */
  readonly setVisibleIds: (ids: readonly string[]) => void;
  /** `TableViewSettings`'s `onReorder`. */
  readonly setOrder: (ids: readonly string[]) => void;
  /** Back to the definitions' order and default visibility (saved too). */
  readonly reset: () => void;
}

/** The state merged with the definitions: unknown ids dropped, new columns added, always-shown columns shown. */
function resolveColumnsState(definitions: readonly TableColumnDefinition[], state: TableColumnsState | null): TableColumnsState {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));
  const known = (state?.order ?? []).filter((id, index, ids) => byId.has(id) && ids.indexOf(id) === index);
  const stored = new Set(known);
  const order = [...known, ...definitions.map((definition) => definition.id).filter((id) => !stored.has(id))];
  const storedVisible = new Set(state?.visible ?? []);
  const visible = order.filter((id) => {
    const definition = byId.get(id);
    if (definition === undefined) return false;
    if (definition.canHide === false) return true;
    return stored.has(id) ? storedVisible.has(id) : definition.isVisibleByDefault !== false;
  });
  return { visible, order };
}

/**
 * The column visibility and order of one table, kept in the app's `store`. It renders the definitions' defaults
 * first and loads the store after mount, so a store that reads browser storage never breaks hydration.
 */
export function useTableColumns({ columns: definitions, store }: UseTableColumnsOptions): TableColumnsView {
  const [state, setState] = useState<TableColumnsState | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    const loaded = storeRef.current?.load() ?? null;
    if (loaded !== null) setState(loaded);
  }, []);

  const resolved = useMemo(() => resolveColumnsState(definitions, state), [definitions, state]);

  const commit = useCallback(
    (next: TableColumnsState | null) => {
      const value = resolveColumnsState(definitions, next);
      setState(value);
      storeRef.current?.save(value);
    },
    [definitions],
  );

  const columns = useMemo(() => {
    const byId = new Map(definitions.map((definition) => [definition.id, definition]));
    const visible = new Set(resolved.visible);
    return resolved.order.flatMap((id): TableViewColumn[] => {
      const definition = byId.get(id);
      if (definition === undefined) return [];
      return [{ id, label: definition.label, isVisible: visible.has(id), ...(definition.canHide === undefined ? {} : { canHide: definition.canHide }) }];
    });
  }, [definitions, resolved]);

  return {
    columns,
    visibleIds: [...resolved.visible],
    order: [...resolved.order],
    setVisibleIds: (ids) => commit({ visible: ids, order: resolved.order }),
    setOrder: (ids) => commit({ visible: resolved.visible, order: ids }),
    reset: () => commit(null),
  };
}
