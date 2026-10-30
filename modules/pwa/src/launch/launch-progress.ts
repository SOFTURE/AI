// The launch screen's counter as one self-contained function. `buildLaunchProgressScript` writes its source text into
// an inline `<script>` inside the launch screen, so it may use only its parameters and the page's globals (`URL`,
// `Math`): no imports, no helpers outside its body. It runs while the browser parses the streamed fallback, before
// any hydration, which is why it is a script and not a client component. Tests call it with happy-dom markup.

export interface LaunchProgressConfig {
  /** The share given once the first frame is painted. */
  readonly paintShare: number;
  /** The share given by the page's finished scripts and stylesheets, in proportion. */
  readonly assetsShare: number;
  /** The share that creeps in with elapsed time, `1 - e^(-t / timeConstantMs)` of it. */
  readonly timeShare: number;
  /** The creep's time constant in milliseconds: about two thirds of the time share after this long. */
  readonly timeConstantMs: number;
  /** How often the counter moves, in milliseconds. */
  readonly intervalMs: number;
}

/** The page parts the counter reads: the running script, the document, Resource Timing and the timers. */
export interface LaunchProgressPage {
  /** `document.currentScript`: the counter finds its launch screen from it. */
  readonly script: Element | null;
  readonly document: Pick<Document, "querySelectorAll" | "baseURI">;
  readonly performance: Pick<Performance, "now" | "getEntriesByType" | "getEntriesByName">;
  readonly timers: {
    setInterval(handler: () => void, timeout: number): number;
    clearInterval(id: number): void;
  };
}

export function launchProgress(page: LaunchProgressPage, config: LaunchProgressConfig): void {
  // The highest value the counter shows: 100% is the page itself.
  const maxValue = 99;
  const root = page.script?.closest('[data-slot="launch-screen"]') ?? null;
  if (root === null) return;
  const bar = root.querySelector('[data-slot="progress"]');
  const indicator = root.querySelector<HTMLElement>('[data-slot="progress-indicator"]');
  const percent = root.querySelector('[data-slot="launch-screen-percent"]');
  let value = 0;
  let isPainted = false;
  let timer: number | null = null;

  function isFinished(url: string): boolean {
    return page.performance.getEntriesByName(url).some((entry) => "responseEnd" in entry && (entry as PerformanceResourceTiming).responseEnd > 0);
  }

  // The scripts and stylesheets the page has named so far, and the share of them the browser has received.
  function readAssetsDone(): number {
    const urls: string[] = [];
    for (const element of page.document.querySelectorAll('script[src], link[rel~="stylesheet"][href]')) {
      const address = element.getAttribute(element.tagName.toLowerCase() === "script" ? "src" : "href");
      if (address !== null && address !== "") urls.push(new URL(address, page.document.baseURI).href);
    }
    if (urls.length === 0) return 0;
    return urls.filter(isFinished).length / urls.length;
  }

  function show(next: number): void {
    value = next;
    const text = `${next}%`;
    bar?.setAttribute("aria-valuenow", String(next));
    bar?.setAttribute("aria-valuetext", text);
    bar?.setAttribute("data-value", String(next));
    if (indicator !== null) indicator.style.transform = `translateX(-${100 - next}%)`;
    if (percent !== null) percent.textContent = text;
  }

  function stop(): void {
    if (timer !== null) page.timers.clearInterval(timer);
    timer = null;
  }

  function tick(): void {
    // Once the page replaced the launch screen there is nothing left to move.
    if (root?.isConnected !== true) {
      stop();
      return;
    }
    isPainted = isPainted || page.performance.getEntriesByType("paint").length > 0;
    const elapsed = Math.max(0, page.performance.now());
    const reached =
      (isPainted ? config.paintShare : 0) +
      readAssetsDone() * config.assetsShare +
      (1 - Math.exp(-elapsed / config.timeConstantMs)) * config.timeShare;
    // The counter only rises, and stops short of 100: the page itself is the last step.
    const next = Math.min(maxValue, Math.max(value, Math.floor(reached)));
    if (next !== value) show(next);
    if (value >= maxValue) stop();
  }

  tick();
  // A browser without paint timing (older Safari) has painted by the first timer tick.
  timer = page.timers.setInterval(() => {
    tick();
    isPainted = true;
  }, config.intervalMs);
}
