// A signed-in chat: proxy.ts keeps visitors without a session off /account, and requireUser checks the session
// itself. The copy of the chat's own parts comes from ui's `chat` group; the page's and the tool card's from the app.
import { requireUser } from "@softure-ai/auth/next";
import { Card } from "@softure-ai/ui";
import { getMessages } from "../../../messages/index.ts";
import config from "../../../softure.config.ts";
import { ProjectChat } from "./chat.tsx";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  await requireUser({ next: "/account/chat" });
  const messages = getMessages(config.locale);
  return (
    <main className="page">
      <Card title={messages.chat.title} subtitle={messages.chat.lead}>
        <ProjectChat copy={messages.chat} />
      </Card>
    </main>
  );
}
