// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChatComposer,
  ChatEmptyState,
  ChatError,
  ChatLog,
  ChatMessage,
  type ChatStatus,
  ReasoningDisclosure,
  ToolCallCard,
  UiLocaleProvider,
} from "../src/index.js";

// Issue #1259: chat primitives on the --sft-* tokens, with plain props and no AI SDK types.

afterEach(() => {
  cleanup();
});

async function getAxeViolations(container: HTMLElement): Promise<readonly string[]> {
  // Layout-based rules need a real browser; happy-dom renders no boxes.
  const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  return result.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.html).join(", ")}`);
}

function FullChat({ status, isStreaming }: { readonly status: ChatStatus; readonly isStreaming: boolean }) {
  return (
    <main>
      <ChatLog isStreaming={isStreaming} announcement="The project is on track.">
        <ChatMessage role="user">How is the project going?</ChatMessage>
        <ChatMessage role="assistant" status={isStreaming ? "streaming" : "done"} meta="0.004 USD">
          <ReasoningDisclosure isStreaming={isStreaming}>Looking up the project first.</ReasoningDisclosure>
          <ToolCallCard title="Project status" state={isStreaming ? "pending" : "done"}>
            <p>On track</p>
          </ToolCallCard>
          {isStreaming ? null : "The project is on track."}
        </ChatMessage>
        <ChatMessage role="assistant" status="streaming" />
      </ChatLog>
      {status === "error" ? <ChatError onRetry={() => undefined} /> : null}
      <ChatComposer status={status} onSend={() => undefined} onStop={() => undefined} onRetry={() => undefined} />
    </main>
  );
}

describe("ChatLog", () => {
  it("is a named log that is busy and silent while an answer streams", () => {
    render(
      <ChatLog isStreaming announcement="Done answer">
        <ChatMessage role="user">Hi</ChatMessage>
      </ChatLog>,
    );
    const log = screen.getByRole("log", { name: "Conversation" });
    expect(log.getAttribute("aria-busy")).toBe("true");
    expect(log.getAttribute("aria-live")).toBe("off");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("announces the finished answer once streaming ends, through a polite atomic status", () => {
    const { rerender } = render(<ChatLog isStreaming announcement="The project is on track." />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(status.textContent).toBe("");
    rerender(<ChatLog isStreaming={false} announcement="The project is on track." />);
    expect(screen.getByRole("status")).toBe(status);
    expect(status.textContent).toBe("The project is on track.");
    expect(screen.getByRole("log").getAttribute("aria-busy")).toBe("false");
  });

  it("announces nothing without an announcement", () => {
    render(<ChatLog />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("takes its name from the label, the props' copy or the provider", () => {
    const { rerender } = render(<ChatLog label="Support chat" />);
    expect(screen.getByRole("log", { name: "Support chat" })).toBeTruthy();
    rerender(<ChatLog messages={{ logLabel: "Unterhaltung" }} />);
    expect(screen.getByRole("log", { name: "Unterhaltung" })).toBeTruthy();
    rerender(
      <UiLocaleProvider messages={{ chat: { logLabel: "Gespräch" } }}>
        <ChatLog />
      </UiLocaleProvider>,
    );
    expect(screen.getByRole("log", { name: "Gespräch" })).toBeTruthy();
  });
});

describe("ChatMessage", () => {
  it("is a list item with its role and status as data attributes and the role's name", () => {
    render(
      <ChatLog>
        <ChatMessage role="user">Hi</ChatMessage>
        <ChatMessage role="assistant" status="error">
          Sorry
        </ChatMessage>
        <ChatMessage role="system" name="Notice">
          Model switched
        </ChatMessage>
      </ChatLog>,
    );
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => [item.dataset.role, item.dataset.status])).toEqual([
      ["user", "done"],
      ["assistant", "error"],
      ["system", "done"],
    ]);
    expect(within(items[0]!).getByText("You")).toBeTruthy();
    expect(within(items[1]!).getByText("Assistant")).toBeTruthy();
    expect(within(items[2]!).getByText("Notice")).toBeTruthy();
  });

  it("shows a typing indicator while streaming with no content, and the content once it arrives", () => {
    const { rerender } = render(
      <ChatLog>
        <ChatMessage role="assistant" status="streaming" />
      </ChatLog>,
    );
    expect(screen.getByText("Writing…")).toBeTruthy();
    rerender(
      <ChatLog>
        <ChatMessage role="assistant" status="streaming">
          The
        </ChatMessage>
      </ChatLog>,
    );
    expect(screen.queryByText("Writing…")).toBeNull();
    expect(screen.getByText("The")).toBeTruthy();
  });

  it("renders text as text, never as HTML", () => {
    render(
      <ChatLog>
        <ChatMessage role="assistant">{"<img src=x onerror=alert(1)>"}</ChatMessage>
      </ChatLog>,
    );
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });

  it("shows meta and actions, takes slot classes and drops its defaults when unstyled", () => {
    render(
      <ChatLog>
        <ChatMessage role="assistant" meta="0.004 USD" actions={<button type="button">Copy</button>} classNames={{ bubble: "app-bubble" }}>
          Hi
        </ChatMessage>
        <ChatMessage role="user" unstyled classNames={{ root: "app-root" }}>
          Plain
        </ChatMessage>
      </ChatLog>,
    );
    expect(screen.getByText("0.004 USD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(screen.getByText("Hi").className).toContain("app-bubble");
    expect(screen.getByText("Hi").className).toContain("sft:rounded-card");
    const plain = screen.getAllByRole("listitem")[1]!;
    expect(plain.className).toBe("app-root");
    expect(screen.getByText("Plain").className).toBe("");
  });
});

describe("ChatComposer", () => {
  it("sends the trimmed text on Enter and clears itself", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.change(input, { target: { value: "  Hello  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledExactlyOnceWith("Hello");
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("does not send on Shift+Enter, during an IME composition, or with blank text", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    const input = screen.getByRole("textbox", { name: "Message" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false);
  });

  it("sends with the Send button, which is disabled while the text is blank", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send.hasAttribute("disabled")).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hi" } });
    fireEvent.click(send);
    expect(onSend).toHaveBeenCalledExactlyOnceWith("Hi");
  });

  it.each<ChatStatus>(["submitted", "streaming"])("shows Stop instead of Send and sends nothing while %s", (status) => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    render(<ChatComposer status={status} onSend={onSend} onStop={onStop} defaultValue="Next" />);
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledOnce();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("keeps a disabled Send while busy when there is no onStop", () => {
    render(<ChatComposer status="streaming" onSend={() => undefined} defaultValue="Next" />);
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("offers Retry after an error, next to Send", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ChatComposer status="ready" onSend={() => undefined} onRetry={onRetry} />);
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    rerender(<ChatComposer status="error" onSend={() => undefined} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
  });

  it("works controlled: shows the value and reports changes and the clear after send", () => {
    const onValueChange = vi.fn();
    const onSend = vi.fn();
    render(<ChatComposer value="Draft" onValueChange={onValueChange} onSend={onSend} />);
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(input.value).toBe("Draft");
    fireEvent.change(input, { target: { value: "Draft 2" } });
    expect(onValueChange).toHaveBeenLastCalledWith("Draft 2");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSend).toHaveBeenCalledExactlyOnceWith("Draft");
    expect(onValueChange).toHaveBeenLastCalledWith("");
  });

  it("sends nothing when disabled", () => {
    const onSend = vi.fn();
    render(<ChatComposer disabled defaultValue="Hi" onSend={onSend} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSend).not.toHaveBeenCalled();
    expect((screen.getByRole<HTMLTextAreaElement>("textbox")).disabled).toBe(true);
  });

  it("takes its copy from the props", () => {
    render(<ChatComposer onSend={() => undefined} messages={{ composer: { label: "Nachricht", send: "Senden" } }} />);
    expect(screen.getByRole("textbox", { name: "Nachricht" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Senden" })).toBeTruthy();
  });
});

describe("ToolCallCard", () => {
  it("is busy and shows no output while pending", () => {
    render(
      <ToolCallCard title="Project status" state="pending">
        <p>Output</p>
      </ToolCallCard>,
    );
    const card = screen.getByRole("region", { name: "Project status" });
    expect(card.dataset.state).toBe("pending");
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Running…")).toBeTruthy();
    expect(screen.queryByText("Output")).toBeNull();
  });

  it("shows the output when done", () => {
    render(
      <ToolCallCard title="Project status" state="done">
        <p>Output</p>
      </ToolCallCard>,
    );
    const card = screen.getByRole("region", { name: "Project status" });
    expect(card.dataset.state).toBe("done");
    expect(card.getAttribute("aria-busy")).toBe("false");
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Output")).toBeTruthy();
  });

  it("shows the error text and no output when failed", () => {
    render(
      <ToolCallCard title="Project status" state="error" errorText="The project was not found.">
        <p>Output</p>
      </ToolCallCard>,
    );
    expect(screen.getByRole("region", { name: "Project status" }).dataset.state).toBe("error");
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("The project was not found.")).toBeTruthy();
    expect(screen.queryByText("Output")).toBeNull();
  });
});

describe("ReasoningDisclosure", () => {
  it("is folded by default and reads Thinking while it streams", () => {
    const { rerender, container } = render(<ReasoningDisclosure isStreaming>Step one</ReasoningDisclosure>);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(screen.getByText("Thinking…")).toBeTruthy();
    rerender(<ReasoningDisclosure defaultOpen>Step one</ReasoningDisclosure>);
    expect(container.querySelector("details")!.open).toBe(true);
    expect(screen.getByText("Reasoning")).toBeTruthy();
  });
});

describe("ChatEmptyState and ChatError", () => {
  it("offers suggestions as buttons that report the picked prompt", () => {
    const onSuggestion = vi.fn();
    render(<ChatEmptyState description="Ask about a project." suggestions={["Status?", "Risks?"]} onSuggestion={onSuggestion} />);
    expect(screen.getByText("Start a conversation")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Suggestions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Risks?" }));
    expect(onSuggestion).toHaveBeenCalledExactlyOnceWith("Risks?");
  });

  it("renders no suggestion list without suggestions", () => {
    render(<ChatEmptyState title="Ask anything" />);
    expect(screen.getByText("Ask anything")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("announces the error and retries", () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ChatError onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong. Try again.");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    rerender(<ChatError message="The model is busy." />);
    expect(screen.getByRole("alert").textContent).toBe("The model is busy.");
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("axe", () => {
  it.each<[ChatStatus, boolean]>([
    ["streaming", true],
    ["ready", false],
    ["error", false],
  ])("finds no violations in a full chat while %s", async (status, isStreaming) => {
    const { container } = render(<FullChat status={status} isStreaming={isStreaming} />);
    expect(await getAxeViolations(container)).toEqual([]);
  });

  it("finds no violations in the empty state", async () => {
    const { container } = render(
      <main>
        <ChatEmptyState suggestions={["Status?"]} onSuggestion={() => undefined} />
        <ChatComposer onSend={() => undefined} />
      </main>,
    );
    expect(await getAxeViolations(container)).toEqual([]);
  });
});
