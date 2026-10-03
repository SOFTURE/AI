// @ts-check
// The fixture app: a static file server for this folder, started by the CLI with the port as its only argument.
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const ROOT = import.meta.dirname;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8" };
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
  console.error(`serve.mjs: expected a port as the only argument, got ${JSON.stringify(process.argv[2])}.`);
  process.exit(1);
}

createServer((request, response) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(ROOT) || file.endsWith(".mjs")) {
    response.writeHead(404).end();
    return;
  }
  readFile(file).then(
    (body) => {
      const type = /** @type {Record<string, string>} */ (TYPES)[extname(file)] ?? "application/octet-stream";
      response.writeHead(200, { "Content-Type": type }).end(body);
    },
    () => response.writeHead(404).end(),
  );
}).listen(port, "127.0.0.1", () => console.log(`fixture app on http://localhost:${port}/`));
