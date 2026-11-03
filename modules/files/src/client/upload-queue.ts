// A list of uploads for an upload screen, without a framework: files go in, each is opened as a session by the app,
// sent with `sendUpload` and finalized by the app, and the list says where each one stands. Its items fit
// theme-notion's `UploadItem` as they are (`UploadFileItem`: id, name, size, state, progress 0-100, error).
//
// React reads it with `useSyncExternalStore(queue.subscribe, queue.getItems)`: `getItems` answers the same array until
// something changes.
import type { ErrorCode, Result } from "@softure-ai/core";
import { filesMessages, getFilesErrorMessage } from "../messages/index.js";
import { sendUpload, type SendUploadOptions, type UploadProgress } from "./send-upload.js";

export type UploadQueueState = "queued" | "uploading" | "paused" | "done" | "failed";

/** One upload of the list. */
export interface UploadQueueItem {
  readonly id: string;
  readonly name: string;
  /** In bytes. */
  readonly size: number;
  readonly state: UploadQueueState;
  /** 0-100, what the session holds; 100 only once finalized. */
  readonly progress: number;
  /** The copy for `errorCode`, on a failed item. */
  readonly error?: string;
  /** Why it failed: a `files.*` code of the client or whatever code the app's `open` or `finalize` answered. */
  readonly errorCode?: ErrorCode;
}

/** What the app's `open` answers: at least the session's upload URL (`createUpload`'s answer fits). */
export interface UploadQueueSession {
  readonly uploadUrl: string;
}

export interface UploadQueueOptions<TSession extends UploadQueueSession> {
  /** Opens a session for a file, usually a server action around `createUpload`. */
  readonly open: (file: File) => Promise<Result<TSession>>;
  /** Turns a sent session into a stored file, usually a server action around `finalizeUpload`. */
  readonly finalize: (session: TSession, file: File) => Promise<Result<unknown>>;
  /** Uploads sent at the same time; 1 by default. */
  readonly concurrency?: number;
  /** The copy for a failure code; the built-in English `files` messages by default. */
  readonly describeError?: (code: ErrorCode) => string;
  /** The `fetch` the sender uses; the global one by default. */
  readonly fetch?: SendUploadOptions["fetch"];
}

export interface UploadQueue {
  /** Queues files (a `FileList` works) and answers their item ids. */
  add(files: Iterable<File> | ArrayLike<File>): string[];
  /** Queues a failed upload again; it keeps its session unless the session expired. */
  retry(id: string): void;
  /** Stops a queued or running upload; what arrived stays in the session. */
  pause(id: string): void;
  /** Queues a paused upload again; it sends only what is missing. */
  resume(id: string): void;
  /** Stops an upload and drops it from the list. An unfinished session expires and `files.prune` removes it. */
  remove(id: string): void;
  /** The list, in the order files were added; the same array until something changes. */
  getItems(): readonly UploadQueueItem[];
  /** Calls `listener` after every change; answers the function that stops it. */
  subscribe(listener: () => void): () => void;
}

interface Entry<TSession> {
  item: UploadQueueItem;
  readonly file: File;
  session: TSession | null;
  // Bumped by pause and remove: a run that settles under an older number changes nothing.
  run: number;
  controller: AbortController | null;
}

// A session the server no longer knows: a retry opens a new one.
const SESSION_GONE_CODES: ReadonlySet<string> = new Set(["files.upload_expired", "files.not_found"]);

/** Creates an upload list; `open` and `finalize` are the app's, the sending is the package's. */
export function createUploadQueue<TSession extends UploadQueueSession>(options: UploadQueueOptions<TSession>): UploadQueue {
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 1));
  const describeError = options.describeError ?? ((code: ErrorCode) => getFilesErrorMessage(filesMessages.en, code));
  const entries = new Map<string, Entry<TSession>>();
  const listeners = new Set<() => void>();
  let items: readonly UploadQueueItem[] = [];
  let nextId = 1;

  function publish(): void {
    items = [...entries.values()].map((entry) => entry.item);
    for (const listener of [...listeners]) listener();
  }

  function setItem(entry: Entry<TSession>, state: UploadQueueState, progress = entry.item.progress, errorCode?: ErrorCode): void {
    const { id, name, size } = entry.item;
    entry.item = { id, name, size, state, progress, ...(errorCode === undefined ? {} : { errorCode, error: describeError(errorCode) }) };
    publish();
  }

  function fail(entry: Entry<TSession>, code: ErrorCode): void {
    if (SESSION_GONE_CODES.has(code)) entry.session = null;
    setItem(entry, "failed", entry.item.progress, code);
  }

  function stop(entry: Entry<TSession>): void {
    entry.run += 1;
    entry.controller?.abort();
    entry.controller = null;
  }

  function pump(): void {
    for (const entry of entries.values()) {
      if (countRunning() >= concurrency) return;
      if (entry.item.state === "queued") void start(entry);
    }
  }

  function countRunning(): number {
    let running = 0;
    for (const entry of entries.values()) if (entry.item.state === "uploading") running += 1;
    return running;
  }

  async function start(entry: Entry<TSession>): Promise<void> {
    entry.run += 1;
    const run = entry.run;
    const controller = new AbortController();
    entry.controller = controller;
    const isCurrent = (): boolean => entry.run === run && entries.get(entry.item.id) === entry;
    setItem(entry, "uploading");
    try {
      let session = entry.session;
      if (session === null) {
        const opened = await options.open(entry.file);
        if (!isCurrent()) return;
        if (!opened.ok) return fail(entry, opened.error);
        session = opened.value;
        entry.session = session;
      }
      const sent = await sendUpload(entry.file, {
        uploadUrl: session.uploadUrl,
        signal: controller.signal,
        onProgress: (progress) => {
          if (isCurrent()) setItem(entry, "uploading", toPercent(progress));
        },
        ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      });
      if (!isCurrent()) return;
      if (!sent.ok) return fail(entry, sent.error);
      const finalized = await options.finalize(session, entry.file);
      if (!isCurrent()) return;
      if (!finalized.ok) return fail(entry, finalized.error);
      setItem(entry, "done", 100);
    } catch (error) {
      // The app's `open` or `finalize` threw, e.g. a server action whose request failed: the item fails with a
      // retryable code, and the cause goes to the console for the developer.
      console.error(`@softure-ai/files/client: an upload of "${entry.item.name}" stopped on a thrown open or finalize`, error);
      if (isCurrent()) fail(entry, "files.network");
    } finally {
      if (entry.controller === controller) entry.controller = null;
      pump();
    }
  }

  function find(id: string, states: readonly UploadQueueState[]): Entry<TSession> | null {
    const entry = entries.get(id);
    return entry !== undefined && states.includes(entry.item.state) ? entry : null;
  }

  return {
    add(files) {
      const ids: string[] = [];
      for (const file of Array.from(files)) {
        const id = `upload-${String(nextId)}`;
        nextId += 1;
        entries.set(id, { item: { id, name: file.name, size: file.size, state: "queued", progress: 0 }, file, session: null, run: 0, controller: null });
        ids.push(id);
      }
      publish();
      pump();
      return ids;
    },
    retry(id) {
      const entry = find(id, ["failed"]);
      if (entry === null) return;
      setItem(entry, "queued");
      pump();
    },
    pause(id) {
      const entry = find(id, ["queued", "uploading"]);
      if (entry === null) return;
      stop(entry);
      setItem(entry, "paused");
      pump();
    },
    resume(id) {
      const entry = find(id, ["paused"]);
      if (entry === null) return;
      setItem(entry, "queued");
      pump();
    },
    remove(id) {
      const entry = entries.get(id);
      if (entry === undefined) return;
      stop(entry);
      entries.delete(id);
      publish();
      pump();
    },
    getItems: () => items,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function toPercent(progress: UploadProgress): number {
  // 100 is kept for a finalized upload: a sent but unfinalized one shows 99 at most.
  if (progress.totalBytes === 0) return 99;
  return Math.min(99, Math.floor((progress.sentBytes / progress.totalBytes) * 100));
}
