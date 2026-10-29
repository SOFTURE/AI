// The public link route, mounted with one line:
// `app/f/[...link]/route.ts → export { serveFileLinkRoute as GET, serveFileLinkRoute as HEAD } from "@softure-ai/files/next";`
// It reads no session: a link is protected by its signature, so the route must stay outside the app's sign-in guard
// and the edge's sign-in (README §4). The path is read from the request URL, not from Next's params.
import { getFilesContext } from "./context.js";
import { serveFileLink } from "../server/serve.js";

/** `GET` and `HEAD /f/<id>/<expiry>/<signature>/<name>`. */
export async function serveFileLinkRoute(request: Request): Promise<Response> {
  return serveFileLink(await getFilesContext(), request);
}
