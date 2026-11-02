// The upload route, mounted with one line:
// `app/u/[...upload]/route.ts → export { serveUploadRoute as GET, serveUploadRoute as HEAD, serveUploadRoute as PUT } from "@softure-ai/files/next";`
// It reads no session: an upload URL is protected by its signature, so the route must stay outside the app's
// sign-in guard and the edge's sign-in (README §4). The path is read from the request URL, not from Next's params.
import { serveUpload } from "../server/serve-upload.js";
import { getFilesContext } from "./context.js";

/** `GET`, `HEAD` and `PUT /u/<id>/<expiry>.<signature>`. */
export async function serveUploadRoute(request: Request): Promise<Response> {
  return serveUpload(await getFilesContext(), request);
}
