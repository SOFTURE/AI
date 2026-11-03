// The MCP adapter of @softure-ai/files: two tools around a plain HTTP upload, so an assistant hands a large file
// (a video) to the app without putting its bytes in a tool call. `create_upload` answers a signed upload URL with a
// ready `curl` loop for the chunks (and the browser page as a fallback); the assistant runs it in its own sandbox and
// then calls `finalize_upload`, which turns the chunks into a stored file.
//
// Both tools write, so they are registered only for an identity that can write (mcp-access's write switch). Their
// input schemas are plain objects; the app's factory makes them strict (`createMcpServerFactory({ strictToolInput })`).
//
//   createMcpServerFactory({
//     name: "acme",
//     registerTools: (server, identity) => registerFileUploadTools(server, { identity, getContext: () => getFilesContext() }),
//   });
//   mcpAccess({ serverName: "acme", tools: [...FILE_UPLOAD_MCP_TOOLS] });
//
// An app that turns the stored file into its own record passes `onFinalized` (its fields join the answer), its own
// tool texts in `descriptions`, and `hints` for the error codes it answers.
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { errorLogLabel, type Err, type ErrorCode } from "@softure-ai/core";
import { z } from "zod";
import type { CreatedUpload, StoredFile } from "../contract.js";
import { filesMessages, getFilesErrorMessage } from "../messages/index.js";
import type { FilesContext } from "../server/context.js";
import { createUpload, finalizeUpload } from "../server/uploads.js";

export const CREATE_UPLOAD_TOOL_NAME = "create_upload";
export const FINALIZE_UPLOAD_TOOL_NAME = "finalize_upload";

/** The served tool descriptions by default; an app prefixes or replaces them through `descriptions`. */
export const FILE_UPLOAD_TOOL_DESCRIPTIONS = {
  create_upload:
    "Starts an upload of a file from your own environment (for a file too large for a tool call, such as a video). " +
  "The file's bytes never go through this tool: it answers a one-time upload URL and a ready curl loop that sends the " +
  "file in chunks; run it where the file is, then call finalize_upload with the upload_id. A person can open the " +
    "same URL in a browser to upload the file there instead.",
  finalize_upload:
    "Finishes an upload started with create_upload once every chunk is sent: checks the bytes and stores the file. " +
    "Answers the stored file's id. Calling it again answers the same file.",
} as const;

/** The catalog entries for `mcpAccess({ tools })`, so the token page and the catalog check know both tools. */
export const FILE_UPLOAD_MCP_TOOLS = [
  { name: CREATE_UPLOAD_TOOL_NAME, access: "write", description: { en: "Starts an upload of a large file to a one-time URL." } },
  { name: FINALIZE_UPLOAD_TOOL_NAME, access: "write", description: { en: "Stores a file once its upload is complete." } },
] as const;

/** What the tools need of the MCP request's identity (`McpServerIdentity` of `@softure-ai/mcp-access`). */
export interface FileUploadToolIdentity {
  readonly userId: string;
  readonly canWrite: boolean;
}

export interface FileUploadToolsOptions {
  readonly identity: FileUploadToolIdentity;
  /** The files context, e.g. `() => getFilesContext()` from `@softure-ai/files/next`. */
  readonly getContext: () => FilesContext | Promise<FilesContext>;
  /** Whose files the uploads become; the token's user by default. */
  readonly getOwnerId?: (identity: FileUploadToolIdentity) => string;
  /** The kind of the stored files; `file` by default. */
  readonly kind?: string;
  /**
   * Runs after every successful `finalize_upload`, a repeated one for the same file included (so keep it idempotent,
   * e.g. an upsert by `file.id`). Returned fields join the answer (the file's own fields win a name clash); a returned
   * `err(code)` answers that code as a failure; a thrown error answers the generic failure and is logged.
   */
  readonly onFinalized?: (file: StoredFile, ctx: FilesContext) => Promise<FileFinalizedAnswer>;
  /** The served descriptions; a missing one keeps `FILE_UPLOAD_TOOL_DESCRIPTIONS`. */
  readonly descriptions?: { readonly create_upload?: string; readonly finalize_upload?: string };
  /**
   * The text answered for an error code, the hook's codes and the package's `files.*` codes alike, followed by the code.
   * Without a hint a `files.*` code answers its English sentence and any other code answers the code alone.
   */
  readonly hints?: Readonly<Record<string, string>>;
}

/** What `onFinalized` answers: extra fields for the tool's answer, nothing, or a failure. */
export type FileFinalizedAnswer = Readonly<Record<string, unknown>> | Err<ErrorCode> | undefined | void;

const createUploadInput = z.object({
  name: z.string().min(1).max(255).describe("The file's name, e.g. promo.mp4."),
  size: z.number().int().min(1).describe("The file's exact size in bytes (e.g. from `wc -c < file`)."),
  content_type: z.string().min(3).max(255).optional().describe("The media type, e.g. video/mp4."),
  sha256: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional()
    .describe("The file's SHA-256 in hex; when given, the upload is refused unless the bytes match."),
});

const finalizeUploadInput = z.object({
  upload_id: z.string().uuid().describe("The upload_id create_upload answered."),
});

/** Registers `create_upload` and `finalize_upload` for an identity that can write; does nothing for a read-only one. */
export function registerFileUploadTools(server: Pick<McpServer, "registerTool">, options: FileUploadToolsOptions): void {
  if (!options.identity.canWrite) return;
  const ownerId = (options.getOwnerId ?? ((identity) => identity.userId))(options.identity);

  server.registerTool(
    CREATE_UPLOAD_TOOL_NAME,
    {
      description: options.descriptions?.create_upload ?? FILE_UPLOAD_TOOL_DESCRIPTIONS.create_upload,
      inputSchema: createUploadInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args) =>
      answer(CREATE_UPLOAD_TOOL_NAME, options.hints, async () => {
        const ctx = await options.getContext();
        const created = await createUpload(ctx, {
          ownerId,
          name: args.name,
          size: args.size,
          ...(args.content_type === undefined ? {} : { contentType: args.content_type }),
          ...(args.sha256 === undefined ? {} : { sha256: args.sha256 }),
          ...(options.kind === undefined ? {} : { kind: options.kind }),
        });
        return created.ok ? describeCreatedUpload(created.value, args.size) : created;
      }),
  );

  server.registerTool(
    FINALIZE_UPLOAD_TOOL_NAME,
    {
      description: options.descriptions?.finalize_upload ?? FILE_UPLOAD_TOOL_DESCRIPTIONS.finalize_upload,
      inputSchema: finalizeUploadInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    (args) =>
      answer(FINALIZE_UPLOAD_TOOL_NAME, options.hints, async () => {
        const ctx = await options.getContext();
        const finalized = await finalizeUpload(ctx, args.upload_id, { ownerId });
        if (!finalized.ok) return finalized;
        const extra = options.onFinalized === undefined ? undefined : await options.onFinalized(finalized.value, ctx);
        if (isFailure(extra)) return extra;
        return { ...extra, ...describeStoredFile(finalized.value) };
      }),
  );
}

/**
 * A bash loop that sends `$FILE` to an upload URL in chunks with `dd` and `curl` (GNU and BSD alike). It stops at the
 * first failed chunk; `CHUNKS="3 4"` before the loop resends only those (the URL answers `missingChunks` to a GET).
 */
export function buildCurlUploadScript(upload: Pick<CreatedUpload, "uploadUrl" | "chunkSize" | "chunkCount">, size: number): string {
  const chunk = String(upload.chunkSize);
  const total = String(size);
  return [
    `FILE='path/to/the/file'`,
    `URL='${upload.uploadUrl}'`,
    `for i in \${CHUNKS:-$(seq 0 ${String(upload.chunkCount - 1)})}; do`,
    `  start=$((i * ${chunk})); end=$((start + ${chunk} - 1)); [ "$end" -ge ${total} ] && end=$((${total} - 1))`,
    `  dd if="$FILE" bs=${chunk} skip="$i" count=1 2>/dev/null | curl -sS --fail -X PUT -H "Content-Range: bytes $start-$end/${total}" --data-binary @- "$URL" >/dev/null || { echo "chunk $i failed: run the loop again with CHUNKS=\\"$i ...\\""; break; }`,
    `done`,
    `curl -sS "$URL"`,
  ].join("\n");
}

function describeCreatedUpload(upload: CreatedUpload, size: number) {
  return {
    upload_id: upload.uploadId,
    upload_url: upload.uploadUrl,
    chunk_size: upload.chunkSize,
    chunk_count: upload.chunkCount,
    expires_at: upload.expiresAt.toISOString(),
    curl: buildCurlUploadScript(upload, size),
    browser_page: upload.uploadUrl,
    next_step:
      "Set FILE in the curl loop to the file's path and run it; the last line prints the upload's state. When missingChunks is " +
      "empty, call finalize_upload with this upload_id. A person without a shell can open browser_page instead.",
  };
}

function describeStoredFile(file: StoredFile) {
  return { file_id: file.id, name: file.name, size: file.size, content_type: file.contentType, sha256: file.sha256 };
}

/** The tool's answer: a value as JSON text, an error code as its hint or sentence, a thrown error as a fixed text. */
async function answer(
  tool: string,
  hints: Readonly<Record<string, string>> | undefined,
  work: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    const value = await work();
    if (isFailure(value)) return failure(describeErrorCode(value.error, hints));
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  } catch (error) {
    console.error(`@softure-ai/files: tool ${tool} failed: ${errorLogLabel(error)}`);
    return failure(filesMessages.en.errors.core.unexpected);
  }
}

/** `<hint or files sentence> (<code>)`, or the code alone for another module's code without a hint. */
function describeErrorCode(code: string, hints: Readonly<Record<string, string>> | undefined): string {
  const hint = hints !== undefined && Object.hasOwn(hints, code) ? hints[code] : undefined;
  if (hint !== undefined) return `${hint} (${code})`;
  if (code.startsWith("files.")) return `${getFilesErrorMessage(filesMessages.en, code)} (${code})`;
  return code;
}

function failure(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function isFailure(value: unknown): value is { readonly ok: false; readonly error: string } {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false && "error" in value && typeof value.error === "string";
}
