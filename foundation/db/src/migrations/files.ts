// Reading a module's migration folder (docs/02-module-standard.md §4): plain SQL files named
// `NNNN_<description>.sql`, numbered 1..n without gaps, each opening with a comment that states
// the rollback plan. Other files (a README) are ignored.
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { ok } from "@softure-ai/core";
import { failWith, type MigrationProblem, type MigrationResult } from "./problems.js";

export interface MigrationFile {
  /** The number in the file name: 1 for `0001_create_notes.sql`. */
  readonly version: number;
  /** The description in the file name: `create_notes`. */
  readonly name: string;
  readonly fileName: string;
  /** The file content with a BOM removed and CRLF line ends turned into LF. */
  readonly sql: string;
  /** sha256 of `sql`, hex. */
  readonly checksum: string;
}

const FILE_NAME = /^(\d{4})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const ROLLBACK_NOTE = /rollback:/i;
// A statement line that ends or opens a transaction would split the per-file transaction.
// PL/pgSQL `BEGIN` (no semicolon) and `END;` stay allowed.
const TRANSACTION_CONTROL = /^\s*(?:(?:begin|commit|rollback)(?:\s+(?:transaction|work))?\s*;|start\s+transaction\b)/im;

/** Normalises line ends so a Windows checkout does not look like an edited migration. */
export function normalizeSql(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
}

export function computeChecksum(sql: string): string {
  return createHash("sha256").update(normalizeSql(sql), "utf8").digest("hex");
}

export function createMigrationFile(fileName: string, text: string): MigrationFile | string {
  const match = FILE_NAME.exec(fileName);
  if (match === null) {
    return "the name must look like 0001_create_table.sql (four digits, then lower_snake_case)";
  }
  const version = Number(match[1]);
  if (version === 0) {
    return "numbering starts at 0001";
  }
  const sql = normalizeSql(text);
  if (!hasRollbackNote(sql)) {
    return 'the file must open with a comment stating the rollback plan, e.g. "-- Rollback: DROP TABLE notes;"';
  }
  if (TRANSACTION_CONTROL.test(sql)) {
    return "the file must not control transactions (BEGIN; COMMIT; ROLLBACK; START TRANSACTION): the migrator runs each file in its own transaction";
  }
  return { version, name: match[2] ?? "", fileName, sql, checksum: computeChecksum(sql) };
}

/** The module's migration files sorted by number, or every problem found in the folder. */
export async function readMigrationFiles(moduleId: string, dir: URL): Promise<MigrationResult<MigrationFile[]>> {
  const dirPath = fileURLToPath(dir);
  let fileNames: string[];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    fileNames = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".sql")).map((entry) => entry.name);
  } catch (error) {
    return failWith([{ code: "db.migrations_unreadable", module: moduleId, dir: dirPath, reason: describeFsError(error) }]);
  }

  const problems: MigrationProblem[] = [];
  const files: MigrationFile[] = [];
  for (const fileName of fileNames.sort()) {
    const file = createMigrationFile(fileName, await readFile(`${dirPath}/${fileName}`, "utf8"));
    if (typeof file === "string") {
      problems.push({ code: "db.invalid_migration_file", module: moduleId, file: fileName, reason: file });
    } else {
      files.push(file);
    }
  }
  problems.push(...checkNumbering(moduleId, files));
  return problems.length > 0 ? failWith(problems) : ok(files);
}

/** Numbers must run 1, 2, 3 …: a repeat is ambiguous and a gap usually means a deleted file. */
function checkNumbering(moduleId: string, files: readonly MigrationFile[]): MigrationProblem[] {
  const problems: MigrationProblem[] = [];
  files.forEach((file, index) => {
    const previous = files[index - 1];
    if (previous !== undefined && previous.version === file.version) {
      problems.push({ code: "db.invalid_migration_file", module: moduleId, file: file.fileName, reason: `repeats number ${previous.fileName.slice(0, 4)}` });
    } else if (file.version !== (previous?.version ?? 0) + 1) {
      problems.push({ code: "db.invalid_migration_file", module: moduleId, file: file.fileName, reason: `breaks the sequence: expected number ${String((previous?.version ?? 0) + 1).padStart(4, "0")}` });
    }
  });
  return problems;
}

/** The leading `--` comment block (after blank lines) must mention "Rollback:". */
function hasRollbackNote(sql: string): boolean {
  const lines = sql.split("\n").map((line) => line.trim());
  const firstContent = lines.findIndex((line) => line !== "");
  const leading: string[] = [];
  for (const line of lines.slice(Math.max(firstContent, 0))) {
    if (!line.startsWith("--")) break;
    leading.push(line);
  }
  return leading.some((line) => ROLLBACK_NOTE.test(line));
}

function describeFsError(error: unknown): string {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error.code === "ENOENT" ? "the folder does not exist" : error.code;
  }
  return "unknown error";
}
