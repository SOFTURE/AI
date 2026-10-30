import { runInThisContext } from "node:vm";

import {
  buildServiceWorkerSource,
  DEFAULT_EXCLUDED_PREFIXES,
  resolveServiceWorkerConfig,
  serviceWorker,
  type ServiceWorkerOptions,
  type WorkerScope,
} from "@softure-ai/pwa/worker";
import { describe, expect, it } from "vitest";

import { answer, FakeWorkerScope, navigation, ORIGIN } from "./support/fake-worker-scope.js";

const OFFLINE_HTML = `<!doctype html><html><head>
<link rel="stylesheet" href="/_next/static/css/app.css">
<link rel="preload" as="script" href="/_next/static/chunks/main.js?dpl=a&amp;v=2">
<link rel="preload" as="font" href="/_next/static/media/font.woff2">
<link rel="icon" href="/pwa/icons/icon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href='/pwa/icons/apple-icon-180.png'>
<link rel="manifest" href="/pwa/manifest.webmanifest">
<link rel="stylesheet" href="https://fonts.example.com/font.css">
<script src="/_next/static/chunks/webpack.js" async></script>
<script src=/api/config.js></script>
<script>self.__next_f = []</script>
</head><body>Offline</body></html>`;

const OPTIONS: ServiceWorkerOptions = { app: "fire", offlinePath: "/offline", navigationTimeoutMs: 20 };

function startWorker(options: Partial<ServiceWorkerOptions> = {}, build = "b1"): FakeWorkerScope {
  const scope = new FakeWorkerScope();
  serviceWorker(scope.asScope(), resolveServiceWorkerConfig({ ...OPTIONS, ...options }, build));
  return scope;
}

function routeShell(scope: FakeWorkerScope): void {
  scope.route("/offline", answer(OFFLINE_HTML));
  for (const path of ["/_next/static/css/app.css", "/_next/static/chunks/main.js?dpl=a&v=2", "/_next/static/chunks/webpack.js"]) {
    scope.route(path, answer(`/* ${path} */`, { contentType: "text/javascript" }));
  }
  scope.route("/pwa/icons/icon-32.png", answer("png", { contentType: "image/png" }));
  scope.route("/pwa/icons/apple-icon-180.png", answer("png", { contentType: "image/png" }));
}

async function installWorker(options: Partial<ServiceWorkerOptions> = {}, build = "b1"): Promise<FakeWorkerScope> {
  const scope = startWorker(options, build);
  routeShell(scope);
  await scope.dispatchLifecycle("install");
  return scope;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBody(response: Promise<Response> | null): Promise<string> {
  if (response === null) throw new Error("the worker did not answer");
  return (await response).text();
}

describe("the service worker's install", () => {
  it("keeps the offline page and the same-origin scripts, styles and icons its HTML names, in this build's shell", async () => {
    const scope = await installWorker();

    expect(scope.caches.get("fire-shell-b1").getPaths().sort()).toEqual([
      "/_next/static/chunks/main.js?dpl=a&v=2",
      "/_next/static/chunks/webpack.js",
      "/_next/static/css/app.css",
      "/offline",
      "/pwa/icons/apple-icon-180.png",
      "/pwa/icons/icon-32.png",
    ]);
    expect(scope.hasSkippedWaiting).toBe(false);
  });

  it("skips an asset that is not a whole answer and still installs", async () => {
    const scope = startWorker();
    routeShell(scope);
    scope.route("/_next/static/css/app.css", answer("", { status: 404 }));
    scope.route("/_next/static/chunks/webpack.js", answer("js", { redirected: true }));

    await scope.dispatchLifecycle("install");

    expect(scope.caches.get("fire-shell-b1").getPaths()).not.toContain("/_next/static/css/app.css");
    expect(scope.caches.get("fire-shell-b1").getPaths()).not.toContain("/_next/static/chunks/webpack.js");
  });

  it.each([
    { name: "a 500", page: answer("error", { status: 500 }) },
    { name: "a redirect", page: answer("<html>", { redirected: true }) },
    { name: "a non-HTML answer", page: answer("{}", { contentType: "application/json" }) },
  ])("fails when the offline page is $name, so the running worker stays", async ({ page }) => {
    const scope = startWorker();
    scope.route("/offline", page);

    await expect(scope.dispatchLifecycle("install")).rejects.toThrow("the offline page /offline answered");
  });

  it("fails when an asset the offline page names cannot be fetched, so a half-kept shell never activates", async () => {
    const scope = startWorker();
    routeShell(scope);
    scope.routes.delete(`${ORIGIN}/_next/static/css/app.css`);

    await expect(scope.dispatchLifecycle("install")).rejects.toThrow("Failed to fetch");
  });

  it("fetches the shell past the HTTP cache", async () => {
    const scope = startWorker();
    const modes: RequestCache[] = [];
    scope.route("/offline", (request) => {
      modes.push(request.cache);
      return Promise.resolve(answer("<html></html>"));
    });

    await scope.dispatchLifecycle("install");

    expect(modes).toEqual(["reload"]);
  });
});

describe("the service worker's activate", () => {
  it("drops the app's caches of other builds, keeps other apps' and extra caches, and claims the clients", async () => {
    const scope = await installWorker({}, "b2");
    for (const name of ["fire-shell-b1", "fire-pages-b1", "fire-tiles", "other-shell-b1", "fire-pages-b2"]) await scope.caches.open(name);

    await scope.dispatchLifecycle("activate");

    expect((await scope.caches.keys()).sort()).toEqual(["fire-pages-b2", "fire-shell-b2", "fire-tiles", "other-shell-b1"]);
    expect(scope.isClaimed).toBe(true);
  });
});

describe("the service worker's navigations", () => {
  it("answers from the network first and keeps the page", async () => {
    const scope = await installWorker();
    scope.route("/tasks", answer("<p>tasks</p>"));

    const dispatched = scope.dispatchFetch(navigation("/tasks"));

    expect(await readBody(dispatched.response)).toBe("<p>tasks</p>");
    await dispatched.settled();
    expect(scope.caches.get("fire-pages-b1").getPaths()).toEqual(["/tasks"]);
  });

  it("serves the kept page when the network fails", async () => {
    const scope = await installWorker();
    scope.route("/tasks", answer("<p>kept</p>"));
    await scope.dispatchFetch(navigation("/tasks")).settled();
    scope.routes.clear();

    expect(await readBody(scope.dispatchFetch(navigation("/tasks")).response)).toBe("<p>kept</p>");
  });

  it("serves the kept page when the network is slower than the timeout", async () => {
    const scope = await installWorker();
    scope.route("/tasks", answer("<p>kept</p>"));
    await scope.dispatchFetch(navigation("/tasks")).settled();
    scope.route("/tasks", async () => {
      await delay(200);
      return answer("<p>fresh</p>");
    });

    expect(await readBody(scope.dispatchFetch(navigation("/tasks")).response)).toBe("<p>kept</p>");
  });

  it("waits for a slow network when no page is kept", async () => {
    const scope = await installWorker();
    scope.route("/tasks", async () => {
      await delay(60);
      return answer("<p>slow</p>");
    });

    expect(await readBody(scope.dispatchFetch(navigation("/tasks")).response)).toBe("<p>slow</p>");
  });

  it("serves the offline page with no network and no kept page", async () => {
    const scope = await installWorker();
    scope.routes.clear();

    expect(await readBody(scope.dispatchFetch(navigation("/never-seen")).response)).toBe(OFFLINE_HTML);
  });

  it("answers a network error when even the offline page is missing", async () => {
    const scope = startWorker();
    const dispatched = scope.dispatchFetch(navigation("/tasks"));

    expect((await dispatched.response)?.type).toBe("error");
  });

  it.each([
    { name: "an error page", page: answer("<p>error</p>", { status: 500 }) },
    { name: "a redirected answer", page: answer("<p>login</p>", { redirected: true }) },
    { name: "a non-HTML answer", page: answer("{}", { contentType: "application/json" }) },
    { name: "an opaque answer", page: answer("", { type: "opaqueredirect", status: 200 }) },
  ])("passes $name through without keeping it", async ({ page }) => {
    const scope = await installWorker();
    scope.route("/tasks", page);

    const dispatched = scope.dispatchFetch(navigation("/tasks"));
    await dispatched.response;
    await dispatched.settled();

    expect(scope.caches.get("fire-shell-b1")).toBeDefined();
    expect(await scope.caches.has("fire-pages-b1")).toBe(false);
  });

  it.each([
    {
      name: "a streamed sign-in redirect",
      html: '<html><body><div hidden>loading</div><meta id="__next-page-redirect" http-equiv="refresh" content="1;url=/login"/></body></html>',
    },
    { name: "a failed boundary", html: '<html><body><!--$!--><template data-dgst="1"></template><script>$RX=function(b,c,d,e){};$RX("B:0","1")</script></body></html>' },
    { name: "a failed boundary of the external runtime", html: '<html><body><script>$RX("B:0","1","","")</script></body></html>' },
  ])("serves $name but keeps the earlier copy", async ({ html }) => {
    const scope = await installWorker();
    scope.route("/tasks", answer("<p>kept</p>"));
    await scope.dispatchFetch(navigation("/tasks")).settled();
    scope.route("/tasks", answer(html));

    const dispatched = scope.dispatchFetch(navigation("/tasks"));

    expect(await readBody(dispatched.response)).toBe(html);
    await dispatched.settled();
    scope.routes.clear();
    expect(await readBody(scope.dispatchFetch(navigation("/tasks")).response)).toBe("<p>kept</p>");
  });

  it("keeps a page that only mentions a refresh or $RX in its text", async () => {
    const scope = await installWorker();
    const html = '<html><head><meta name="description" content="refresh"></head><body><p>Use $RX for ratios</p></body></html>';
    scope.route("/notes", answer(html));

    await scope.dispatchFetch(navigation("/notes")).settled();

    expect(await (await scope.caches.get("fire-pages-b1").match(`${ORIGIN}/notes`))?.text()).toBe(html);
  });

  it("keeps at most maxPages, dropping the least recently kept", async () => {
    const scope = await installWorker({ maxPages: 2 });
    for (const path of ["/a", "/b", "/a", "/c"]) {
      scope.route(path, answer(path));
      await scope.dispatchFetch(navigation(path)).settled();
    }

    expect(scope.caches.get("fire-pages-b1").getPaths()).toEqual(["/a", "/c"]);
  });
});

describe("the service worker's other requests", () => {
  it("serves a kept file from the shell without the network", async () => {
    const scope = await installWorker();
    scope.routes.clear();

    expect(await readBody(scope.dispatchFetch(new Request(`${ORIGIN}/_next/static/css/app.css`)).response)).toBe(
      "/* /_next/static/css/app.css */",
    );
  });

  it("keeps an immutable file on first use, and only a whole answer", async () => {
    const scope = await installWorker();
    scope.route("/_next/static/chunks/page.js", answer("page", { contentType: "text/javascript" }));
    scope.route("/_next/static/chunks/missing.js", answer("", { status: 404 }));

    await readBody(scope.dispatchFetch(new Request(`${ORIGIN}/_next/static/chunks/page.js`)).response);
    await readBody(scope.dispatchFetch(new Request(`${ORIGIN}/_next/static/chunks/missing.js`)).response);

    const paths = scope.caches.get("fire-shell-b1").getPaths();
    expect(paths).toContain("/_next/static/chunks/page.js");
    expect(paths).not.toContain("/_next/static/chunks/missing.js");
  });

  it("passes other same-origin requests to the network without keeping them", async () => {
    const scope = await installWorker();
    scope.route("/tasks?_rsc=1", answer("rsc", { contentType: "text/x-component" }));

    expect(await readBody(scope.dispatchFetch(new Request(`${ORIGIN}/tasks?_rsc=1`)).response)).toBe("rsc");
    expect(scope.caches.get("fire-shell-b1").getPaths()).not.toContain("/tasks?_rsc=1");
  });

  it.each(["/api/tasks", "/api", "/oauth/callback", "/.well-known/security.txt", "/cdn-cgi/trace", "/login", "/login/sso", "/account/password", "/sw.js"])(
    "never touches the excluded %s",
    async (path) => {
      const scope = await installWorker();

      expect(scope.dispatchFetch(new Request(`${ORIGIN}${path}`)).response).toBeNull();
      expect(scope.dispatchFetch(navigation(path)).response).toBeNull();
    },
  );

  it("matches an excluded prefix on whole segments", async () => {
    const scope = await installWorker();
    scope.route("/logins", answer("<p>logins</p>"));

    expect(scope.dispatchFetch(navigation("/logins")).response).not.toBeNull();
  });

  it("takes the app's excluded prefixes instead of the defaults, and always excludes itself", async () => {
    const scope = startWorker({ excludedPrefixes: ["/admin"] });
    routeShell(scope);
    // No longer excluded, so the install keeps the offline page's script under /api/ too.
    scope.route("/api/config.js", answer("config", { contentType: "text/javascript" }));
    await scope.dispatchLifecycle("install");

    expect(scope.dispatchFetch(navigation("/admin/users")).response).toBeNull();
    expect(scope.dispatchFetch(new Request(`${ORIGIN}/sw.js`)).response).toBeNull();
    expect(scope.dispatchFetch(navigation("/login")).response).not.toBeNull();
  });

  it("leaves an only-if-cached request outside same-origin mode to the browser", async () => {
    const scope = await installWorker();
    const request = new Request(`${ORIGIN}/_next/static/css/app.css`);
    Object.defineProperty(request, "cache", { value: "only-if-cached" });

    expect(scope.dispatchFetch(request).response).toBeNull();
  });

  it("leaves other methods and other origins to the browser", async () => {
    const scope = await installWorker();

    expect(scope.dispatchFetch(new Request(`${ORIGIN}/tasks`, { method: "POST", body: "x" })).response).toBeNull();
    expect(scope.dispatchFetch(new Request("https://cdn.example.com/lib.js")).response).toBeNull();
  });
});

describe("the service worker's extra origins", () => {
  const TILES = { origin: "https://tiles.example.com/", cache: "tiles", maxEntries: 2 };

  it("keeps an extra origin's answers in its own cache, cache first, capped", async () => {
    const scope = await installWorker({ extraOrigins: [TILES] });
    for (const tile of ["1", "2", "3"]) scope.route(`https://tiles.example.com/${tile}.png`, answer(tile, { type: "cors", contentType: "image/png" }));

    for (const tile of ["1", "2", "3"]) await readBody(scope.dispatchFetch(new Request(`https://tiles.example.com/${tile}.png`)).response);
    scope.routes.clear();

    expect(scope.caches.get("fire-tiles").getPaths()).toEqual(["https://tiles.example.com/2.png", "https://tiles.example.com/3.png"]);
    expect(await readBody(scope.dispatchFetch(new Request("https://tiles.example.com/3.png")).response)).toBe("3");
  });

  it("does not keep a failed answer from an extra origin", async () => {
    const scope = await installWorker({ extraOrigins: [TILES] });
    scope.route("https://tiles.example.com/1.png", answer("", { status: 503, type: "cors" }));

    await readBody(scope.dispatchFetch(new Request("https://tiles.example.com/1.png")).response);

    expect(scope.caches.get("fire-tiles").getPaths()).toEqual([]);
  });

  it("keeps the extra cache through a new build's activate", async () => {
    const scope = await installWorker({ extraOrigins: [TILES] }, "b2");
    await scope.caches.open("fire-tiles");

    await scope.dispatchLifecycle("activate");

    expect(await scope.caches.has("fire-tiles")).toBe(true);
  });
});

describe("the service worker's messages", () => {
  it("skips waiting on skip-waiting", async () => {
    const scope = await installWorker();

    await scope.dispatchMessage({ type: "skip-waiting" });

    expect(scope.hasSkippedWaiting).toBe(true);
  });

  it("drops the kept pages on clear-pages and keeps the shell", async () => {
    const scope = await installWorker();
    scope.route("/tasks", answer("<p>tasks</p>"));
    await scope.dispatchFetch(navigation("/tasks")).settled();

    await scope.dispatchMessage({ type: "clear-pages" });

    expect(await scope.caches.has("fire-pages-b1")).toBe(false);
    expect(await scope.caches.has("fire-shell-b1")).toBe(true);
  });

  it.each([null, "skip-waiting", { type: "other" }])("ignores %j", async (data) => {
    const scope = await installWorker();

    await scope.dispatchMessage(data);

    expect(scope.hasSkippedWaiting).toBe(false);
  });
});

describe("the service worker's source", () => {
  it("runs as served: the function's text called with self and the JSON config", async () => {
    const source = buildServiceWorkerSource(resolveServiceWorkerConfig(OPTIONS, "b9"));
    const scope = new FakeWorkerScope();
    routeShell(scope);

    // The served text is evaluated with `self` bound, as the browser runs /sw.js.
    const run = runInThisContext(`(function (self) {\n${source}\n})`) as (self: WorkerScope) => void;
    run(scope.asScope());
    await scope.dispatchLifecycle("install");

    expect(await scope.caches.has("fire-shell-b9")).toBe(true);
  });

  it("changes with the build", () => {
    const config = (build: string) => resolveServiceWorkerConfig(OPTIONS, build);

    expect(buildServiceWorkerSource(config("b1"))).not.toBe(buildServiceWorkerSource(config("b2")));
    expect(buildServiceWorkerSource(config("b1"))).toBe(buildServiceWorkerSource(config("b1")));
  });
});

describe("resolveServiceWorkerConfig", () => {
  it("fills the defaults and excludes the worker's own path", () => {
    expect(resolveServiceWorkerConfig({ app: "fire", offlinePath: "/offline" }, "b1")).toEqual({
      app: "fire",
      build: "b1",
      offlinePath: "/offline",
      excludedPrefixes: [...DEFAULT_EXCLUDED_PREFIXES, "/sw.js"],
      staticPrefixes: ["/_next/static/", "/pwa/icons/"],
      navigationTimeoutMs: 5000,
      maxPages: 60,
      extraOrigins: [],
    });
  });

  it("normalizes an extra origin and leaves it uncapped by default", () => {
    const config = resolveServiceWorkerConfig({ ...OPTIONS, extraOrigins: [{ origin: "https://tiles.example.com/z/", cache: "tiles" }] }, "b1");

    expect(config.extraOrigins).toEqual([{ origin: "https://tiles.example.com", cache: "tiles", maxEntries: null }]);
  });

  it.each([
    { name: "an app name with spaces", options: { app: "Fire App" }, message: 'app "Fire App" must be lowercase letters' },
    { name: "a relative offline path", options: { offlinePath: "offline" }, message: 'offlinePath "offline" must start with /' },
    { name: "a zero timeout", options: { navigationTimeoutMs: 0 }, message: "navigationTimeoutMs must be a positive integer, got 0" },
    { name: "a fractional page cap", options: { maxPages: 1.5 }, message: "maxPages must be a positive integer, got 1.5" },
    {
      name: "an extra cache named like a build cache",
      options: { extraOrigins: [{ origin: "https://tiles.example.com", cache: "pages-map" }] },
      message: 'extra origin cache "pages-map" must not start with "shell" or "pages"',
    },
    {
      name: "an extra origin that is not a URL",
      options: { extraOrigins: [{ origin: "tiles", cache: "tiles" }] },
      message: 'extra origin "tiles" is not a URL',
    },
  ])("refuses $name", ({ options, message }) => {
    expect(() => resolveServiceWorkerConfig({ ...OPTIONS, ...options }, "b1")).toThrow(message);
  });
});
