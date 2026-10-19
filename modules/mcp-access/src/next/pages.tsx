// The token page, ready to mount with one line:
// `export { McpAccessPage as default } from "@softure-ai/mcp-access/next"`.
// A server component for the signed-in user; without a session it redirects to the login page and
// back. Its props come from `getTokenManagerProps`, the same builder an app's own page uses.
import { requireUser } from "@softure-ai/auth/next";
import { getSoftureConfig } from "@softure-ai/core/next";
import { Card } from "@softure-ai/ui";
import { getMcpAccessMessages, getMcpAccessRoutes } from "../server/options.js";
import { TokenManager, type IssueTokenAction } from "../ui/token-manager.js";
import { issueTokenAction, revokeGrantAction, revokeTokenAction } from "./actions.js";
import { getTokenManagerProps } from "./token-manager-props.js";

const LAYOUT_CLASS = "sft:mx-auto sft:box-border sft:w-full sft:sm:max-w-3xl sft:px-4 sft:py-4";

export interface McpAccessPageProps {
  /**
   * The app's own issue action, e.g. one that calls `issueToken` with a `beforeIssue` gate. Default:
   * `issueTokenAction`, which issues without a gate.
   */
  readonly issueAction?: IssueTokenAction;
}

export async function McpAccessPage({ issueAction = issueTokenAction }: McpAccessPageProps = {}) {
  const config = getSoftureConfig();
  const user = await requireUser({ next: getMcpAccessRoutes(config).page });
  const messages = getMcpAccessMessages(config);
  const props = await getTokenManagerProps({ userId: user.id, config });
  return (
    <main className={LAYOUT_CLASS}>
      <Card title={messages.page.title} subtitle={messages.page.lead}>
        <TokenManager
          {...props}
          issueAction={issueAction}
          revokeAction={revokeTokenAction}
          {...(props.grants === undefined ? {} : { revokeGrantAction })}
        />
      </Card>
    </main>
  );
}
