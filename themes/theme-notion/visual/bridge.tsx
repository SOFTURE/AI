import { Button, Card, EmptyState, FormError, ProgressBar } from "@softure-ai/ui";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { PageFrame } from "../src/index.js";

/** Where a ui screen sits in a Notion app; `visual/bridge.spec.ts` reads the scopes by `data-bridge-scope`. */
type BridgeScope = "shell" | "frame" | "dark-band";

/** ui components as an app screen uses them: a card with a progress bar, the two main buttons, an error and an empty state. */
function UiScreen({ scope }: { scope: BridgeScope }) {
  return (
    <div data-bridge-scope={scope} className="flex min-w-0 flex-col gap-3 p-4">
      <Card title="Weekly report" subtitle="3 of 5 sections">
        <ProgressBar value={60} label="Sections written" />
      </Card>
      <div className="flex gap-2">
        <Button variant="primary">Send</Button>
        <Button variant="secondary">Retry</Button>
      </div>
      <FormError message="The model did not answer. Try again." />
      <EmptyState title="No messages yet">Ask about the report.</EmptyState>
    </div>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-2">
      <h2 className="px-4 pt-4 text-small text-muted-foreground">{label}</h2>
      {children}
    </section>
  );
}

/** The same screen in the app shell (no frame), in a `PageFrame`, and in a `.dark` band of the page. */
function BridgePage() {
  return (
    <main className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4">
      <Section label="In the app shell">
        <UiScreen scope="shell" />
      </Section>
      <Section label="In a PageFrame">
        {/* The frame's own window height would only add an empty band to the screenshot. */}
        <div className="[&>[data-page-frame]]:min-h-0">
          <PageFrame>
            <UiScreen scope="frame" />
          </PageFrame>
        </div>
      </Section>
      <div className="dark bg-background text-foreground">
        <Section label="In a dark band">
          <UiScreen scope="dark-band" />
        </Section>
      </div>
    </main>
  );
}

const container = document.getElementById("bridge");
if (container === null) throw new Error("the bridge page has no #bridge element");
createRoot(container).render(
  <StrictMode>
    <BridgePage />
  </StrictMode>,
);
