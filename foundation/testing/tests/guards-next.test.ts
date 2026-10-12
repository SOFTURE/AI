import { describe, expect, it } from "vitest";
import type { SourceFile } from "@softure-ai/testing/guards";
import {
  findClientValueImports,
  findErrorDetailsInRedirects,
  findImplementationsWithoutDatabase,
  findNonAsyncServerExports,
  findRequestApisInImplementations,
  findServerActionProblems,
  findUnguardedRevalidation,
} from "@softure-ai/testing/guards/next";

/** Files from `path → lines`; lines keep the fixtures readable and their line numbers obvious. */
function filesOf(entries: Record<string, readonly string[]>): SourceFile[] {
  return Object.entries(entries).map(([file, lines]) => ({ file, source: lines.join("\n") }));
}

describe("findNonAsyncServerExports", () => {
  it("passes async functions, types and local async functions exported by name", () => {
    const files = filesOf({
      "app/actions.ts": [
        '"use server";',
        "export async function save() {}",
        "export const remove = async () => {};",
        "export const archive = async function () {};",
        "export type SaveResult = { ok: boolean };",
        "export interface Draft { title: string }",
        "async function publish() {}",
        "const unpublish = async () => {};",
        "export { publish, unpublish as hide, type Draft as Shape };",
        "export type { Other } from './types';",
        "export default async function submit() {}",
      ],
    });
    expect(findNonAsyncServerExports(files)).toEqual([]);
  });

  it("reports sync functions, values, classes, enums, unknown names and re-exports", () => {
    const files = filesOf({
      "app/actions.ts": [
        "// The actions.",
        '"use server";',
        "export function save() {}",
        "export const LIMIT = 10;",
        "export class Store {}",
        "export enum Mode { A }",
        "function helper() {}",
        "export { helper };",
        "export { load } from './load';",
        "export * from './more';",
        "export default 42;",
      ],
    });
    expect(findNonAsyncServerExports(files)).toEqual([
      'app/actions.ts:3: "use server" module exports the sync function save; export only async functions',
      'app/actions.ts:4: "use server" module exports LIMIT, which is not an async function; export only async functions',
      'app/actions.ts:5: "use server" module exports the class Store; export only async functions',
      'app/actions.ts:6: "use server" module exports the enum Mode; export only async functions',
      'app/actions.ts:8: "use server" module exports helper, which is not an async function declared in this file; export only async functions',
      "app/actions.ts:9: \"use server\" module exports './load' re-exported, which this file cannot prove async; export only async functions",
      "app/actions.ts:10: \"use server\" module exports './more' re-exported, which this file cannot prove async; export only async functions",
      'app/actions.ts:11: "use server" module exports a default value that is not an async function; export only async functions',
    ]);
  });

  it("ignores modules without the directive, and a directive after other code", () => {
    const files = filesOf({
      "lib/format.ts": ["export const LIMIT = 10;"],
      "lib/late.ts": ["import x from './x';", '"use server";', "export const LIMIT = x;"],
    });
    expect(findNonAsyncServerExports(files)).toEqual([]);
  });
});

describe("findUnguardedRevalidation", () => {
  const action = (body: readonly string[]) =>
    filesOf({
      "app/actions.ts": ['"use server";', 'import { revalidatePath as refresh, revalidateTag } from "next/cache";', "export async function save() {", ...body, "}"],
    });

  it("passes a call after an exiting check, inside a branch, or after an await in a try block", () => {
    expect(findUnguardedRevalidation(action(["  const result = await write();", "  if (!result.ok) return result;", '  refresh("/");']))).toEqual([]);
    expect(findUnguardedRevalidation(action(["  const result = await write();", '  if (result.ok) {', '    revalidateTag("entries");', "  }"]))).toEqual([]);
    expect(findUnguardedRevalidation(action(["  const result = await write();", '  if (!result.ok) { throw new Error("x"); }', '  refresh("/");']))).toEqual([]);
    expect(findUnguardedRevalidation(action(["  const result = await write();", '  if (!result.ok) { redirect("/x"); }', '  refresh("/");']))).toEqual([]);
    expect(findUnguardedRevalidation(action(["  const result = await write();", '  result.ok && refresh("/");']))).toEqual([]);
    expect(findUnguardedRevalidation(action(["  try {", "    await write();", '    refresh("/");', "  } catch {", "    return;", "  }"]))).toEqual([]);
  });

  it("reports a call before any check, in a catch block and in a finally block", () => {
    expect(findUnguardedRevalidation(action(['  refresh("/");', "  await write();"]))).toEqual([
      "app/actions.ts:4: revalidatePath() runs before the write is known to have succeeded; call it only in the success branch",
    ]);
    expect(findUnguardedRevalidation(action(["  const result = await write();", '  revalidateTag("entries");', "  return result;"]))).toEqual([
      "app/actions.ts:5: revalidateTag() runs before the write is known to have succeeded; call it only in the success branch",
    ]);
    expect(findUnguardedRevalidation(action(["  try {", "    await write();", "  } catch {", '    if (true) refresh("/");', "  }"]))).toEqual([
      "app/actions.ts:7: revalidatePath() runs in a catch block; call it only in the success branch",
    ]);
    expect(findUnguardedRevalidation(action(["  try {", "    await write();", "  } finally {", '    refresh("/");', "  }"]))).toEqual([
      "app/actions.ts:7: revalidatePath() runs in a finally block; call it only in the success branch",
    ]);
  });

  it("reports a call at the top of a try block, before the write", () => {
    expect(findUnguardedRevalidation(action(["  try {", '    refresh("/");', "    await write();", "  } catch {}"]))).toEqual([
      "app/actions.ts:5: revalidatePath() runs before the write is known to have succeeded; call it only in the success branch",
    ]);
  });

  it("passes a sync refresh helper, whose callers decide when it runs", () => {
    const files = filesOf({
      "app/actions.ts": ['import { revalidatePath } from "next/cache";', "function refreshPage(): void {", '  revalidatePath("/");', "}", 'const refreshList = () => revalidatePath("/list");'],
    });
    expect(findUnguardedRevalidation(files)).toEqual([]);
  });

  it("ignores a function of the same name that is not from next/cache", () => {
    const files = filesOf({ "lib/cache.ts": ["function revalidatePath(path: string) {}", 'revalidatePath("/");'] });
    expect(findUnguardedRevalidation(files)).toEqual([]);
  });
});

describe("findRequestApisInImplementations", () => {
  it("reports request-scoped imports in implementation modules only, under any alias", () => {
    const files = filesOf({
      "app/entries/do-save-entry.ts": ['import { cookies as readCookies, headers } from "next/headers";', 'import { connection } from "next/server";'],
      "app/entries/manage-entries.ts": ['import * as nextHeaders from "next/headers";', 'import type { NextRequest } from "next/server";'],
      "app/entries/actions.ts": ['import { cookies } from "next/headers";'],
    });
    expect(findRequestApisInImplementations(files)).toEqual([
      "app/entries/do-save-entry.ts:1: implementation module uses the request-scoped cookies() from next/headers; read it in the action and pass the value in",
      "app/entries/do-save-entry.ts:1: implementation module uses the request-scoped headers() from next/headers; read it in the action and pass the value in",
      "app/entries/do-save-entry.ts:2: implementation module uses the request-scoped connection() from next/server; read it in the action and pass the value in",
      "app/entries/manage-entries.ts:1: implementation module uses the request-scoped cookies() from next/headers; read it in the action and pass the value in",
      "app/entries/manage-entries.ts:1: implementation module uses the request-scoped headers() from next/headers; read it in the action and pass the value in",
      "app/entries/manage-entries.ts:1: implementation module uses the request-scoped draftMode() from next/headers; read it in the action and pass the value in",
    ]);
  });

  it("takes the app's layer naming and its own request APIs", () => {
    const files = filesOf({
      "src/core/save-entry.ts": ['import { getSession } from "@/lib/session";'],
      "src/actions/save.ts": ['import { getSession } from "@/lib/session";'],
    });
    expect(
      findRequestApisInImplementations(files, { implementation: /^src\/core\//, requestApis: [{ module: "@/lib/session", names: ["getSession"] }] }),
    ).toEqual(["src/core/save-entry.ts:1: implementation module uses the request-scoped getSession() from @/lib/session; read it in the action and pass the value in"]);
  });
});

describe("findImplementationsWithoutDatabase", () => {
  it("passes a handle as a parameter, a destructured option or a member of the options type", () => {
    const files = filesOf({
      "app/do-save.ts": [
        "export async function save(database: Db, now: Date) {}",
        "export const remove = async ({ db, now }: { db: Db; now: Date }) => {};",
        "interface BaseOptions { database?: Db }",
        "interface ArchiveOptions extends BaseOptions { now: Date }",
        "export async function archive(options: ArchiveOptions) {}",
        "type PublishOptions = { now: Date } & { db?: Db };",
        "export async function publish(input: string, options: PublishOptions) {}",
        "export const LIMIT = 3;",
        "async function local() {}",
      ],
    });
    expect(findImplementationsWithoutDatabase(files)).toEqual([]);
  });

  it("reports an exported function without the handle, in implementation modules only", () => {
    const files = filesOf({
      "app/manage-entries.ts": ["export async function list(now: Date) {}", "export const count = () => 0;"],
      "app/actions.ts": ["export async function save() {}"],
    });
    expect(findImplementationsWithoutDatabase(files)).toEqual([
      "app/manage-entries.ts:1: implementation list() takes no injectable database handle (^(?:database|db)$); accept it as a parameter or option",
      "app/manage-entries.ts:2: implementation count() takes no injectable database handle (^(?:database|db)$); accept it as a parameter or option",
    ]);
  });

  it("takes the app's layer naming and handle name", () => {
    const files = filesOf({ "src/core/save.ts": ["export async function save({ tx }: { tx: Tx }) {}", "export async function load(now: Date) {}"] });
    expect(findImplementationsWithoutDatabase(files, { implementation: /^src\/core\//, databaseName: /^tx$/ })).toEqual([
      "src/core/save.ts:2: implementation load() takes no injectable database handle (^tx$); accept it as a parameter or option",
    ]);
  });
});

describe("findClientValueImports", () => {
  const files = filesOf({
    "app/ui/form.tsx": ['"use client";', "export const MAX_TITLE = 80;", "export function SaveForm() { return null; }", "export function formatTitle(t: string) { return t; }"],
    "app/actions.ts": ['"use server";', 'import { MAX_TITLE } from "./ui/form";', 'import type { SaveForm } from "./ui/form";'],
    "app/do-save.ts": ['import { formatTitle } from "@/app/ui/form.js";'],
    "app/lib/limits.ts": ['import "server-only";', 'import * as form from "./../ui/form.tsx";'],
    "app/page.tsx": ['import { SaveForm, MAX_TITLE, formatTitle } from "./ui/form";', 'import { z } from "zod";'],
    "app/ui/other.tsx": ['"use client";', 'import { MAX_TITLE } from "./form";'],
  });

  it("reports every value import into server code and non-component names into other server files", () => {
    expect(findClientValueImports(files, { aliases: { "@/": "" } })).toEqual([
      'app/actions.ts:2: server code imports MAX_TITLE from app/ui/form.tsx, a "use client" module; it arrives as a client reference, not the value',
      'app/do-save.ts:1: server code imports formatTitle from app/ui/form.tsx, a "use client" module; it arrives as a client reference, not the value',
      'app/lib/limits.ts:2: server code imports the namespace of app/ui/form.tsx, a "use client" module; it arrives as a client reference, not the value',
      'app/page.tsx:1: server code imports MAX_TITLE from app/ui/form.tsx, a "use client" module; it arrives as a client reference, not the value',
      'app/page.tsx:1: server code imports formatTitle from app/ui/form.tsx, a "use client" module; it arrives as a client reference, not the value',
    ]);
  });

  it("does not resolve an alias it was not given", () => {
    expect(findClientValueImports(files).some((hit) => hit.startsWith("app/do-save.ts"))).toBe(false);
  });
});

describe("findErrorDetailsInRedirects", () => {
  const redirecting = (...calls: string[]) => filesOf({ "app/actions.ts": ['import { redirect, permanentRedirect as move } from "next/navigation";', ...calls] });

  it("passes codes, from literals and from variables", () => {
    expect(
      findErrorDetailsInRedirects(
        redirecting('redirect("/login?error=invalid_token");', "redirect(`/login?error=${result.error}&next=/a`);", 'move("/a?next=" + path);'),
      ),
    ).toEqual([]);
  });

  it("reports free text in a literal and error text from an expression", () => {
    expect(
      findErrorDetailsInRedirects(
        redirecting(
          'redirect("/login?error=Something went wrong");',
          "redirect(`/login?next=/a&message=${error.message}`);",
          'move("/a?reason=" + String(caught));',
          'redirect("/a?error=Wrong%20password");',
        ),
      ),
    ).toEqual([
      "app/actions.ts:2: redirect URL carries free text in ?error=; pass a code and look its copy up on the page",
      "app/actions.ts:3: redirect URL carries free text in ?message=; pass a code and look its copy up on the page",
      "app/actions.ts:4: redirect URL carries free text in ?reason=; pass a code and look its copy up on the page",
      "app/actions.ts:5: redirect URL carries free text in ?error=; pass a code and look its copy up on the page",
    ]);
  });

  it("checks only the given parameters and only next/navigation's redirect", () => {
    expect(findErrorDetailsInRedirects(redirecting('redirect("/a?error=Bad thing");'), { params: ["problem"] })).toEqual([]);
    expect(findErrorDetailsInRedirects(filesOf({ "lib/x.ts": ['redirect("/a?error=Bad thing");'] }))).toEqual([]);
  });
});

describe("findServerActionProblems", () => {
  it("runs every rule and sorts the hits by file and line", () => {
    const files = filesOf({
      "app/do-save.ts": ['import { cookies } from "next/headers";', "export async function save(now: Date) {}"],
      "app/actions.ts": [
        '"use server";',
        'import { revalidatePath } from "next/cache";',
        'import { redirect } from "next/navigation";',
        "export const LIMIT = 1;",
        "export async function submit() {",
        '  revalidatePath("/");',
        '  redirect("/a?error=Not saved");',
        "}",
      ],
    });
    expect(findServerActionProblems(files)).toEqual([
      'app/actions.ts:4: "use server" module exports LIMIT, which is not an async function; export only async functions',
      "app/actions.ts:6: revalidatePath() runs before the write is known to have succeeded; call it only in the success branch",
      "app/actions.ts:7: redirect URL carries free text in ?error=; pass a code and look its copy up on the page",
      "app/do-save.ts:1: implementation module uses the request-scoped cookies() from next/headers; read it in the action and pass the value in",
      "app/do-save.ts:2: implementation save() takes no injectable database handle (^(?:database|db)$); accept it as a parameter or option",
    ]);
  });

  it("finds nothing in the example app's guestbook action", () => {
    const files = filesOf({
      "app/actions.ts": [
        '"use server";',
        'import { revalidatePath } from "next/cache";',
        "export async function addGuestbookEntry(formData: FormData) {",
        "  const { db } = await getDatabase();",
        "  const result = await insertEntry(db, String(formData.get('message')));",
        "  if (!result.ok) return result;",
        '  revalidatePath("/");',
        "  return result;",
        "}",
      ],
    });
    expect(findServerActionProblems(files)).toEqual([]);
  });
});
