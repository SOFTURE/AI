// @vitest-environment happy-dom
// The WebMCP runtime in a browser-like page: detection, both registration generations, and the inline boot script.
import {
  buildWebMcpBootScript,
  errorResult,
  fetchMarkdown,
  findModelContext,
  registerWebMcpTool,
  stripFrontmatter,
  textResult,
  type ModelContextLike,
  type WebMcpTool,
} from "@softure-ai/agent-ready/webmcp";
import { afterEach, describe, expect, it, vi } from "vitest";

const TOOL: WebMcpTool = {
  name: "read_page",
  description: "Reads the page.",
  inputSchema: { type: "object", properties: {} },
  execute: () => Promise.resolve(textResult("page")),
};

interface TestWindow {
  __exampleWebMcp?: boolean;
}

function setModelContext(target: "document" | "navigator", value: unknown): void {
  Object.defineProperty(target === "document" ? document : navigator, "modelContext", { value, configurable: true, writable: true });
}

afterEach(() => {
  setModelContext("document", undefined);
  setModelContext("navigator", undefined);
  delete (window as unknown as TestWindow).__exampleWebMcp;
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

function runScript(source: string): void {
  // The boot script is meant to run inline in <head>; here it runs the same way, as a function body.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the test executes the generated script on purpose
  (new Function(source) as () => void)();
}

describe("results and detection", () => {
  it("builds results in the MCP shape", () => {
    expect(textResult("ok")).toEqual({ content: [{ type: "text", text: "ok" }] });
    expect(errorResult("no")).toEqual({ content: [{ type: "text", text: "no" }], isError: true });
  });

  it("finds document.modelContext first, then navigator.modelContext, else null", () => {
    expect(findModelContext()).toBeNull();
    const fromNavigator = { registerTool: vi.fn() };
    setModelContext("navigator", fromNavigator);
    expect(findModelContext()).toBe(fromNavigator);
    const fromDocument = { registerTool: vi.fn() };
    setModelContext("document", fromDocument);
    expect(findModelContext()).toBe(fromDocument);
    setModelContext("document", { registerTool: "not a function" });
    expect(findModelContext()).toBe(fromNavigator);
  });
});

describe("registerWebMcpTool", () => {
  it("passes the signal to the current API", () => {
    const registerTool = vi.fn<ModelContextLike["registerTool"]>();
    const controller = new AbortController();
    registerWebMcpTool({ registerTool }, TOOL, controller.signal);
    expect(registerTool).toHaveBeenCalledWith(TOOL, { signal: controller.signal });
  });

  it("unregisters on abort with the older API's handle, sync or async", async () => {
    const unregister = vi.fn();
    const controller = new AbortController();
    registerWebMcpTool({ registerTool: () => ({ unregister }) }, TOOL, controller.signal);
    const later = vi.fn();
    registerWebMcpTool({ registerTool: () => Promise.resolve({ unregister: later }) }, TOOL, controller.signal);
    await Promise.resolve();
    controller.abort();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });

  it("logs a rejected or throwing registration instead of throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const signal = new AbortController().signal;
    registerWebMcpTool({ registerTool: () => Promise.reject(new Error("denied")) }, TOOL, signal);
    registerWebMcpTool(
      {
        registerTool: () => {
          throw new Error("duplicate");
        },
      },
      TOOL,
      signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn.mock.calls.map((call) => String(call[0]))).toEqual(["WebMCP: read_page: duplicate", "WebMCP: read_page: denied"]);
  });
});

describe("Markdown helpers", () => {
  it("strips a leading frontmatter block only", () => {
    expect(stripFrontmatter("---\ntitle: x\n---\n\n# Page\n---\n")).toBe("# Page\n---\n");
    expect(stripFrontmatter("# Page")).toBe("# Page");
  });

  it("asks for Markdown without cookies and names the path on an error", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => Promise.resolve(new Response("---\na: 1\n---\n# Hi")));
    expect(await fetchMarkdown("/about", fetchImpl)).toBe("# Hi");
    expect(fetchImpl).toHaveBeenCalledWith("/about", { headers: { Accept: "text/markdown" }, credentials: "omit" });
    await expect(fetchMarkdown("/gone", () => Promise.resolve(new Response("", { status: 404 })))).rejects.toThrow("/gone: HTTP 404");
  });
});

describe("the boot script", () => {
  const tool = { name: "get_page", description: "Returns </b> text.", inputSchema: { type: "object" }, execute: "(args, h) => h.ok('hello ' + (args && args.who))" };
  const options = { flag: "__exampleWebMcp", paths: ["/"], pathPatterns: ["^/blog/[a-z0-9-]+$"], tools: [tool] };

  it("registers the tools on a listed path, once, with results in the MCP shape", async () => {
    const tools: WebMcpTool[] = [];
    setModelContext("document", { registerTool: (tool: WebMcpTool) => tools.push(tool) });
    const script = buildWebMcpBootScript(options);
    runScript(script);
    runScript(script);
    expect(tools.map((tool) => tool.name)).toEqual(["get_page"]);
    expect(await tools[0]?.execute({ who: "agent" })).toEqual({ content: [{ type: "text", text: "hello agent" }] });
  });

  it("registers on a path matched by a pattern, and nowhere else", () => {
    const registerTool = vi.fn();
    setModelContext("navigator", { registerTool });
    window.history.replaceState(null, "", "/account");
    runScript(buildWebMcpBootScript(options));
    expect(registerTool).not.toHaveBeenCalled();
    window.history.replaceState(null, "", "/blog/first-post");
    runScript(buildWebMcpBootScript(options));
    expect(registerTool).toHaveBeenCalledTimes(1);
  });

  it("does nothing without WebMCP, and turns a throwing tool into an error result", async () => {
    runScript(buildWebMcpBootScript(options));
    expect((window as unknown as TestWindow).__exampleWebMcp).toBeUndefined();
    const tools: WebMcpTool[] = [];
    setModelContext("document", { registerTool: (tool: WebMcpTool) => tools.push(tool) });
    runScript(buildWebMcpBootScript({ ...options, tools: [{ ...tool, execute: "() => { throw new Error('boom'); }" }] }));
    expect(await tools[0]?.execute({})).toEqual({ content: [{ type: "text", text: "get_page: boom" }], isError: true });
  });

  it("escapes < in data so the script holds no closing tag, and refuses source that could close it", () => {
    const script = buildWebMcpBootScript(options);
    expect(script).not.toContain("</b>");
    expect(script).toContain("\\u003c/b>");
    expect(() => buildWebMcpBootScript({ ...options, tools: [{ ...tool, execute: "() => '</script>'" }] })).toThrow(
      'WebMCP boot script: the execute source of "get_page" contains </script or <!--',
    );
    expect(() => buildWebMcpBootScript({ ...options, flag: "x;alert(1)" })).toThrow('WebMCP boot script: flag "x;alert(1)" is not a JavaScript identifier');
    expect(() => buildWebMcpBootScript({ ...options, pathPatterns: ["("] })).toThrow();
  });
});
