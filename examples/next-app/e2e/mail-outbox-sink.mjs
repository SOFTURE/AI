// The mail outbox for the app on Cloudflare Workers (playwright.workers.config.ts): a Worker shares no disk with the
// test, so its fake mail provider POSTs each mail as one JSON line (`outboxUrl`), and this sink appends the line to
// the outbox file the specs read (MAIL_OUTBOX, e2e/outbox.ts). Plain Node, no dependencies.
import { appendFile } from "node:fs/promises";
import { createServer } from "node:http";

const port = Number(process.env.MAIL_OUTBOX_SINK_PORT);
const file = process.env.MAIL_OUTBOX;
if (!Number.isInteger(port) || port <= 0 || !file) {
  console.error("mail-outbox-sink: set MAIL_OUTBOX_SINK_PORT and MAIL_OUTBOX");
  process.exit(2);
}

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.end("ok");
    return;
  }
  if (request.method !== "POST" || request.url !== "/outbox") {
    response.statusCode = 404;
    response.end();
    return;
  }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    let line;
    try {
      line = JSON.stringify(JSON.parse(body));
    } catch {
      response.statusCode = 400;
      response.end();
      return;
    }
    appendFile(file, `${line}\n`, "utf8").then(
      () => {
        response.statusCode = 204;
        response.end();
      },
      (error) => {
        console.error(`mail-outbox-sink: could not append to the outbox: ${error instanceof Error ? error.name : "unknown error"}`);
        response.statusCode = 500;
        response.end();
      },
    );
  });
}).listen(port, "127.0.0.1");
