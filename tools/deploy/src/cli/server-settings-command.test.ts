import { describe, expect, it } from "vitest";
import { parseDeployConfig, type DeployConfigInput } from "../verify/schema.js";
import { planServerSettings } from "./server-settings-command.js";

function plan(input: DeployConfigInput) {
  const parsed = parseDeployConfig(input);
  if (!parsed.ok) throw new Error(parsed.issues.join("\n"));
  return planServerSettings(parsed.config);
}

function issuesOf(input: unknown): string[] {
  const parsed = parseDeployConfig(input);
  return parsed.ok ? [] : parsed.issues;
}

describe("planServerSettings", () => {
  it("writes the defaults for a deploy.json without database settings or hooks", () => {
    expect(plan({})).toEqual({
      access: "host\n",
      "app-journal": "",
      "app-ledger": "",
      "exclude-table-data": "",
      "hooks-pre-migrate": "",
      "hooks-post-up": "",
      "hooks-maintain": "",
      cron: "",
    });
  });

  it("writes the database settings, drizzle's ledger by default, and each hook as NUL-separated fields", () => {
    const files = plan({
      database: { access: "compose-exec", appMigrations: { journal: "/app/drizzle/meta/_journal.json" }, excludeTableData: ["a", "security.rate_limits"] },
      hooks: {
        "pre-migrate": [{ name: "migrate", compose: ["run", "--rm", "migrate"] }, { name: "check", run: ["bash", "hooks/a b.sh"] }],
        maintain: [{ name: "daily", run: ["true"] }, { name: "purge", schedule: "*/15 * * * *", compose: ["exec", "-T", "app", "node", "p.mjs"] }],
      },
    });
    expect(files.access).toBe("compose-exec\n");
    expect(files["app-journal"]).toBe("/app/drizzle/meta/_journal.json\n");
    expect(files["app-ledger"]).toBe("drizzle.__drizzle_migrations\n");
    expect(files["exclude-table-data"]).toBe("a,security.rate_limits\n");
    expect(files["hooks-pre-migrate"]).toBe("migrate\0compose\x003\0run\0--rm\0migrate\0check\0run\x002\0bash\0hooks/a b.sh\0");
    expect(files["hooks-maintain"]).toBe("daily\0run\x001\0true\0");
    expect(files.cron).toBe("purge\0*/15 * * * *\0");
    expect(files["scheduled-purge"]).toBe("purge\0compose\x005\0exec\0-T\0app\0node\0p.mjs\0");
  });
});

describe("deploy.json hooks", () => {
  it("refuses a schedule that is more than five cron fields, a built-in step name and a name used twice", () => {
    expect(
      issuesOf({
        hooks: {
          "pre-migrate": [{ name: "backup", run: ["true"] }],
          "post-up": [{ name: "twice", run: ["true"] }],
          maintain: [
            { name: "twice", run: ["true"] },
            { name: "evil", schedule: "* * * * * ; rm -rf /", run: ["true"] },
          ],
        },
      }),
    ).toEqual([
      "hooks.pre-migrate.0.name: a name deploy.sh uses for its own step",
      "hooks.maintain.1.schedule: five cron fields of digits and * / , -",
      "hooks: the hook name twice is used twice",
    ]);
  });

  it("refuses a hook with both kinds or none, an empty command and an image path with .. segments", () => {
    expect(issuesOf({ hooks: { "post-up": [{ name: "both", run: ["a"], compose: ["b"] }] } })).not.toEqual([]);
    expect(issuesOf({ hooks: { "post-up": [{ name: "none" }] } })).not.toEqual([]);
    expect(issuesOf({ hooks: { "post-up": [{ name: "empty", run: [] }] } })).not.toEqual([]);
    expect(issuesOf({ database: { appMigrations: { journal: "/app/../etc/passwd" } } })).toEqual([
      "database.appMigrations.journal: a path without .. segments",
    ]);
    expect(issuesOf({ database: { appMigrations: { journal: "app/journal.json" } } })).toEqual([
      "database.appMigrations.journal: an absolute path in the image",
    ]);
  });
});
