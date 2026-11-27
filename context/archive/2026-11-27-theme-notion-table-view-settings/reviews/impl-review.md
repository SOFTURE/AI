# Implementation review: theme-notion-table-view-settings

Verdict: approve. The diff matches the plan: one new composition file (`src/notion/TableViewSettings.tsx`) with the
component, `applyColumnVisibility` and `useTableColumns`, its exports, seven messages (`tableViewSettings.*`) with
their message-test entries, 16 unit tests, two gallery cases (closed in a table's toolbar, open and isolated) with the
class fixture and visual baselines, README, CHANGELOG `Unreleased`. `Table` and the other ui files are untouched, so
upstream parity holds and the parallel #1528 change does not overlap in code. `onChange` always receives the ids in
the columns' order and never drops a `canHide: false` column (the toggle and "Hide all" both keep it); `onReorder`
returns a full order with hidden columns in their slots, which `applyColumnVisibility` applies directly. The hook
loads the store in an effect (SSR-safe), merges stored state with the definitions (unknown ids dropped, new columns by
default), saves only on changes made through it, and its tests cover defaults, merge, save and reset. The sortable
rows were first drawn on the page background inside the popover (dark theme); `bg-transparent` fixed it and the
baseline was regenerated. No Polish outside dictionaries; no new dependency.
