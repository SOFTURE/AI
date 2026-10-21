// The connections page, ready to mount with one line:
// `export { ConnectionsPage as default } from "@softure-ai/connections/next"`.
// A server component: anyone without the page's role, signed in or not, gets Next's "not found". It renders its
// own `<main>` and title; an app with its own page shell composes the same parts (README §4): `listConnections`,
// `toConnectionPanelRows`, `ConnectionsPanel` and the three actions.
import { requireRole } from "@softure-ai/auth/next";
import { formatMessage } from "@softure-ai/core";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { getConnectionsErrorMessage } from "../messages/index.js";
import { getConnectionsOptions } from "../server/options.js";
import { listConnections } from "../server/list.js";
import { ConnectionsPanel, type ConnectionsPanelNotice } from "../ui/connections-panel.js";
import { disconnectAction, saveCredentialAction, startConnectionAction } from "./actions.js";
import { getConnectionsContext } from "./context.js";
import { getConnectionsMessages } from "./messages.js";
import { readPageNotice } from "./notice.js";
import { toConnectionPanelRows } from "./panel-rows.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export interface ConnectionsPageProps {
  readonly searchParams?: SearchParams;
}

function toQuery(params: Record<string, string | string[] | undefined> | undefined): URLSearchParams {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(name, first);
  }
  return query;
}

export async function ConnectionsPage({ searchParams }: ConnectionsPageProps = {}) {
  const config = getSoftureConfig();
  await requireRole(getConnectionsOptions(config).panelRole);
  const messages = getConnectionsMessages(config);
  const views = await listConnections(await getConnectionsContext(config));
  const rows = toConnectionPanelRows(views, messages, config);
  const notice = readPageNotice(toQuery(await searchParams));
  let panelNotice: ConnectionsPanelNotice = null;
  if (notice.kind === "error") panelNotice = { tone: "error", text: getConnectionsErrorMessage(messages, notice.code) };
  if (notice.kind === "connected") {
    const view = views.find((candidate) => candidate.provider === notice.provider && candidate.accountId === notice.accountId);
    if (view !== undefined) panelNotice = { tone: "success", text: formatMessage(messages.page.connectedNotice, { provider: view.label }) };
  }
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead}>
        <ConnectionsPanel
          rows={rows}
          notice={panelNotice}
          actions={{ start: startConnectionAction, save: saveCredentialAction, disconnect: disconnectAction }}
          messages={messages}
          locale={config.locale}
        />
      </Card>
    </main>
  );
}
