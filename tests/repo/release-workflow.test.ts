import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readWorkflow(name: string): string {
  return readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");
}

// A tag release repeats `npm test` (release.yml, step "Gates"), and that suite fails in CI without
// the Postgres server and browser that ci.yml gives its test job (foundation/db/tests/postgres-env.test.ts).
// The first tag release (2026-10-05) failed exactly there, so the release job must carry the same setup.
const TEST_ENVIRONMENT_LINES = [
  "SOFTURE_TEST_POSTGRES_URL: postgresql://postgres:postgres@localhost:5432/postgres",
  "PLAYWRIGHT_CHROMIUM_PATH: /usr/bin/google-chrome",
  "image: postgres:16",
  '--health-cmd "pg_isready -U postgres"',
];

describe("the release workflow's test gate", () => {
  it.each(TEST_ENVIRONMENT_LINES)("has the test environment line ci.yml has: %s", (line) => {
    expect(readWorkflow("ci.yml")).toContain(line);
    expect(readWorkflow("release.yml")).toContain(line);
  });
});

// npm reads `dir/file.tgz` as a GitHub `owner/repo` shorthand and tries `git ls-remote` on it; only a
// path starting with `./` or `/` is a local tarball. The 0.1.1 release failed every stage this way.
describe("the release workflow's npm publish commands", () => {
  it("give npm the tarball as an explicit relative path", () => {
    const commands = readWorkflow("release.yml")
      .split("\n")
      .filter((line) => /\bnpm (stage )?publish "/.test(line));
    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) expect(command).toMatch(/publish "\.\/release-out\//);
  });
});

// A package that is already on npm must stage through its trusted publisher alone, so a release proves
// OIDC works and NPM_TOKEN can be deleted. Passing the secret as NODE_AUTH_TOKEN to the whole step let
// npm authenticate with the token whenever it was set, and nothing showed which path staged a version.
describe("the release workflow's npm authentication", () => {
  it("hands NPM_TOKEN to npm only for a package that is not on npm yet", () => {
    const workflow = readWorkflow("release.yml");
    expect(workflow).not.toMatch(/NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_TOKEN \}\}/);
    expect(workflow).toContain(
      [
        '          if [ "$known" = yes ]; then',
        '            echo "::notice::${NAME} is on npm: staging through its trusted publisher (OIDC), without NPM_TOKEN."',
        '          elif [ -n "$NPM_TOKEN" ]; then',
        '            echo "::notice::${NAME} is not on npm yet: its first stage uses NPM_TOKEN."',
        '            export NODE_AUTH_TOKEN="$NPM_TOKEN"',
      ].join("\n"),
    );
  });
});
