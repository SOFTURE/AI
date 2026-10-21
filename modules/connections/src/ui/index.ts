// The connections panel, to compose into the app's own page. It takes the server actions from
// `@softure-ai/connections/next` as props: no `next/*` import here (docs/02-module-standard.md §5).
export {
  ConnectionsPanel,
  type ConnectionPanelAction,
  type ConnectionPanelActions,
  type ConnectionPanelRow,
  type ConnectionsPanelNotice,
  type ConnectionsPanelProps,
  type ConnectionsPanelSlot,
} from "./connections-panel.js";
