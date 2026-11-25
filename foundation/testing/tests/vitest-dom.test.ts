import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PACKAGE_DIR = join(import.meta.dirname, "..");
const REPO_ROOT = join(PACKAGE_DIR, "../..");
const SOURCE_DIR = join(PACKAGE_DIR, "src");
const run = promisify(execFile);

// A component with the keyboard behaviour an app wants to unit test: Enter opens, the arrows move, Escape closes and
// gives focus back to the trigger.
const MENU = `import { useRef, useState, type KeyboardEvent } from "react";

const ITEMS = ["Edit", "Archive", "Delete"];

export function Menu() {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  function focusItem(index: number) {
    items.current[(index + ITEMS.length) % ITEMS.length]?.focus();
  }
  function handleKey(event: KeyboardEvent, index: number) {
    if (event.key === "ArrowDown") focusItem(index + 1);
    if (event.key === "ArrowUp") focusItem(index - 1);
    if (event.key === "Escape") {
      setIsOpen(false);
      trigger.current?.focus();
    }
  }
  return (
    <div>
      <button ref={trigger} aria-haspopup="menu" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>Actions</button>
      {isOpen ? (
        <div role="menu">
          {ITEMS.map((label, index) => (
            <button key={label} role="menuitem" autoFocus={index === 0} ref={(node) => { items.current[index] = node; }} onKeyDown={(event) => handleKey(event, index)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
`;

const MENU_TEST = `import { screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderWithUser } from "${SOURCE_DIR}/dom/index.ts";
import { Menu } from "./menu.tsx";

it("opens with Enter, moves with the arrows and gives focus back on Escape", async () => {
  const { user } = renderWithUser(<Menu />);
  await user.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Edit" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Archive" }));
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" }));
});

it("starts from an empty document: the setup file unmounted the other test's render", () => {
  expect(document.body.innerHTML).toBe("");
});
`;

const NODE_TEST = `import { expect, it } from "vitest";

it("runs in node", () => {
  expect(typeof document).toBe("undefined");
});
`;

describe("the dom preset in a Vitest run", () => {
  let dir: string;
  beforeAll(() => {
    // In the repository, so the app resolves vitest and the DOM stack from it, but outside the package: inside it, the
    // name @softure-ai/testing would resolve to the package itself (a self-reference) and skip the stand-in below.
    dir = mkdtempSync(join(REPO_ROOT, ".vitest-dom-app-"));
    mkdirSync(join(dir, "tests"));
    writeFileSync(
      join(dir, "vitest.config.mts"),
      [
        'import { defineConfig, mergeConfig } from "vitest/config";',
        `import { softureVitestConfig } from ${JSON.stringify(join(SOURCE_DIR, "index.ts"))};`,
        "export default mergeConfig(softureVitestConfig({ dom: true, setupFile: false }), defineConfig({",
        '  resolve: { conditions: ["@softure-ai/source", "module", "browser", "development|production"] },',
        '  ssr: { resolve: { conditions: ["@softure-ai/source", "module", "node", "development|production"] } },',
        '  test: { include: ["tests/**/*.test.{ts,tsx}"] },',
        "}));",
      ].join("\n"),
    );
    // Vitest resolves a bare setup file name with Node's conditions, which reach the built `dist/`. A stand-in
    // package in the app's own node_modules points the name at the source file instead.
    const standIn = join(dir, "node_modules/@softure-ai/testing");
    mkdirSync(standIn, { recursive: true });
    writeFileSync(join(standIn, "package.json"), JSON.stringify({ name: "@softure-ai/testing", type: "module", exports: { "./vitest-dom-setup": "./dom-setup.js" } }));
    writeFileSync(join(standIn, "dom-setup.js"), `import ${JSON.stringify(join(SOURCE_DIR, "vitest/dom-setup.ts"))};\n`);
    writeFileSync(join(dir, "tests/menu.tsx"), MENU);
    writeFileSync(join(dir, "tests/menu.dom.test.tsx"), MENU_TEST);
    writeFileSync(join(dir, "tests/server.test.ts"), NODE_TEST);
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("runs *.dom.test files in happy-dom with user-event and every other test in node", async () => {
    const env = { ...process.env, TEST_TZ: "", TZ: "", TEST_TODAY: "" };
    // CI exports FORCE_COLOR, which draws the project names as coloured badges; the assertions read `|dom|`.
    const { stdout } = await run(join(REPO_ROOT, "node_modules/.bin/vitest"), ["run", "--root", dir, "--reporter=verbose", "--sequence.shuffle=false", "--no-color"], {
      cwd: dir,
      env,
    });
    expect(stdout).toMatch(/\|dom\| tests\/menu\.dom\.test\.tsx > opens with Enter/);
    expect(stdout).toMatch(/\|dom\| tests\/menu\.dom\.test\.tsx > starts from an empty document/);
    expect(stdout).toMatch(/\|node\| tests\/server\.test\.ts > runs in node/);
    expect(stdout).toMatch(/Tests {2}3 passed \(3\)/);
  });
});
