// The owner route of stored files, mounted behind the app's sign-in guard in `app/media/[id]/route.ts`:
// `export const { GET, HEAD } = createStoredFileRoute({ getOwnerId: async () => (await getCurrentUser())?.id ?? null });`
// The session check is the app's (files does not depend on auth); the owner check is the module's. Without a session,
// and for a file that is missing or another owner's, the route answers the same `404`, so it never tells whether a
// file exists.
import type { FilesContext } from "../server/context.js";
import { notFound, serveStoredFile } from "../server/serve.js";
import { getFilesContext } from "./context.js";

/** The second argument Next.js passes a handler of a `[id]` segment. */
export interface StoredFileRouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export type StoredFileRouteHandler = (request: Request, route: StoredFileRouteContext) => Promise<Response>;

export interface StoredFileRoute {
  readonly GET: StoredFileRouteHandler;
  readonly HEAD: StoredFileRouteHandler;
}

export interface StoredFileRouteOptions {
  /**
   * The signed-in user's id, the same value the app passed to `saveFile({ ownerId })`; null when nobody is signed in
   * (the route answers 404). Typically the app's session lookup through auth.
   */
  readonly getOwnerId: (request: Request) => Promise<string | null>;
  /** `inline` (the default: a player, an image) or `attachment` (a download). */
  readonly disposition?: "attachment" | "inline";
  /** The context the route reads; `getFilesContext()` (the registered config's database) by default. */
  readonly getContext?: () => Promise<FilesContext>;
}

export function createStoredFileRoute(options: StoredFileRouteOptions): StoredFileRoute {
  const getContext = options.getContext ?? (() => getFilesContext());
  const handle: StoredFileRouteHandler = async (request, route) => {
    const ownerId = await options.getOwnerId(request);
    if (ownerId === null) return notFound();
    const { id } = await route.params;
    return serveStoredFile(await getContext(), id, request, { ownerId, disposition: options.disposition });
  };
  return { GET: handle, HEAD: handle };
}
