// A launch screen in happy-dom with the page parts the counter reads faked: Resource Timing entries the test adds,
// a clock the test moves and an interval the test fires.
import type { LaunchProgressPage } from "@softure-ai/pwa";

export const LAUNCH_SCREEN_HTML = `
<link rel="stylesheet" href="/_next/static/css/app.css">
<script src="/_next/static/chunks/main.js"></script>
<div data-slot="launch-screen">
  <div data-slot="progress" role="progressbar" aria-valuenow="0">
    <div data-slot="progress-indicator" style="transform: translateX(-100%)"></div>
  </div>
  <p data-slot="launch-screen-percent">0%</p>
  <script data-testid="counter"></script>
</div>`;

export class FakeLaunchPage {
  now = 0;
  isPainted = false;
  readonly finished = new Set<string>();
  intervals = new Map<number, () => void>();
  private nextId = 1;

  /** Marks a same-origin path as received, as its Resource Timing entry would. */
  finish(path: string): void {
    this.finished.add(new URL(path, document.baseURI).href);
  }

  /** Fires every running interval once. */
  fire(): void {
    for (const handler of [...this.intervals.values()]) handler();
  }

  asPage(script: Element | null = document.querySelector('[data-testid="counter"]')): LaunchProgressPage {
    return {
      script,
      document,
      performance: {
        now: () => this.now,
        getEntriesByType: (type: string) => (type === "paint" && this.isPainted ? [{ name: "first-paint" } as PerformanceEntry] : []),
        getEntriesByName: (name: string) => (this.finished.has(name) ? [{ name, responseEnd: 12 } as PerformanceResourceTiming] : []),
      },
      timers: {
        setInterval: (handler: () => void) => {
          const id = this.nextId++;
          this.intervals.set(id, handler);
          return id;
        },
        clearInterval: (id: number) => {
          this.intervals.delete(id);
        },
      },
    };
  }
}

/** What the launch screen shows: the bar's value and value text, the indicator's transform, the percent text. */
export function readLaunchScreen(): { valueNow: string | null; valueText: string | null; transform: string; percent: string | null } {
  const bar = document.querySelector('[data-slot="progress"]');
  return {
    valueNow: bar?.getAttribute("aria-valuenow") ?? null,
    valueText: bar?.getAttribute("aria-valuetext") ?? null,
    transform: document.querySelector<HTMLElement>('[data-slot="progress-indicator"]')?.style.transform ?? "",
    percent: document.querySelector('[data-slot="launch-screen-percent"]')?.textContent ?? null,
  };
}
