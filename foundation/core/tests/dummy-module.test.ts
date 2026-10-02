// Roadmap FD-3 baseline: a dummy module defined, validated and listed in a test app config.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineModule, defineSoftureConfig, getModule, moduleManifestSchema, ok, toModuleJson } from "@softure-ai/core";

const notesEn = { list: { title: "Notes", empty: "No notes yet" } };
const notesPl: typeof notesEn = { list: { title: "PL notes", empty: "PL empty" } };

const accounts = defineModule({
  manifest: {
    id: "accounts",
    version: "0.1.2",
    dependsOn: {},
    dbSchema: "accounts",
    tables: ["users"],
    env: [],
    switches: [],
    routes: { login: "/login" },
    mount: [],
    privacy: { exports: true, deletes: true },
  },
  messages: { en: { title: "Accounts" }, pl: { title: "PL accounts" } },
  migrations: { dir: new URL("./accounts/migrations/", import.meta.url) },
  privacy: {
    exportUserData: () => Promise.resolve(ok({ email: "user@example.com" })),
    deleteUserData: () => Promise.resolve(ok()),
  },
});

const notes = defineModule({
  manifest: {
    id: "notes",
    version: "0.1.0",
    dependsOn: { accounts: "^0.1.0" },
    dbSchema: "notes",
    tables: ["notes"],
    env: [{ name: "SOFTURE_NOTES_LIMIT", required: false, description: "notes per user" }],
    switches: ["notes.read_only"],
    routes: { list: "/notes" },
    mount: [{ kind: "page", path: "app/notes/page.tsx", export: "NotesPage" }],
    privacy: { exports: false, deletes: false },
  },
  messages: { en: notesEn, pl: notesPl },
  options: z.object({ limit: z.number().int().positive().default(100) }),
  migrations: { dir: new URL("./notes/migrations/", import.meta.url) },
});

describe("a test app config with dummy modules", () => {
  const config = defineSoftureConfig({
    database: { url: "postgres://localhost/test" },
    locale: "pl",
    timezone: "Europe/Warsaw",
    appOrigin: "http://localhost:3000",
    modules: [notes({ limit: 10, routes: { list: "/my-notes" }, messages: { en: { list: { title: "My notes" } } } }), accounts()],
  });

  it("lists the enabled modules in the order the app gave", () => {
    expect(config.modules.map((module) => module.id)).toEqual(["notes", "accounts"]);
  });

  it("keeps each module's options, routes and copy", () => {
    const listed = getModule(config, "notes");
    expect(listed?.options).toEqual({ limit: 10 });
    expect(listed?.routes).toEqual({ list: "/my-notes" });
    expect(listed?.messages.en).toEqual({ list: { title: "My notes", empty: "No notes yet" } });
    expect(listed?.messages.pl).toEqual(notesPl);
  });

  it("has module.json content the manifest schema accepts", () => {
    for (const factory of [accounts, notes]) {
      expect(moduleManifestSchema.parse(JSON.parse(JSON.stringify(toModuleJson(factory))))).toEqual(factory.manifest);
    }
  });
});
