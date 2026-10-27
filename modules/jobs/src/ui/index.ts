// The jobs admin panel, to compose into the app's own page. It takes the server actions from `@softure-ai/jobs/next`
// as props: no `next/*` import here (docs/02-module-standard.md §5).
export {
  JobsPanel,
  type JobsPanelAction,
  type JobsPanelActions,
  type JobsPanelFilterLink,
  type JobsPanelJob,
  type JobsPanelProps,
  type JobsPanelQueue,
  type JobsPanelRun,
  type JobsPanelSlot,
  type JobsPanelSyncItem,
  type JobsPanelSyncSource,
} from "./jobs-panel.js";
