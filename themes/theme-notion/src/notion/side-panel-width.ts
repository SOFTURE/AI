/**
 * The CSS variable that holds a `SidePanel`'s width; `page.css` registers it as non-inherited, so changing it restyles
 * only the panel, not its content (#1326). A `ResizeHandle liveVariable` writes it during a drag. Plain module, so a
 * Server Component can read it.
 */
export const SIDE_PANEL_WIDTH_VARIABLE = "--side-panel-width";
