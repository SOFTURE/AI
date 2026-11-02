// The browser fallback for an upload session: a small page on the upload URL itself, for a person on a phone or an
// assistant that cannot run `curl`. It sends the missing chunks of the chosen file one by one with `fetch`, so a
// broken connection resumes where it stopped. No framework and no external asset: one inline script and one inline
// style, allowed by a per-response nonce. The copy comes from the module dictionary (`uploadPage`).
import { randomBytes } from "node:crypto";
import { selectMessages } from "@softure-ai/core";
import type { UploadStatus } from "../contract.js";
import type { FilesMessages } from "../messages/index.js";
import type { FilesContext } from "./context.js";
import { getFilesModule } from "./options.js";

const STYLE = `body{font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:2rem auto;padding:0 1rem}
button,input{font:inherit}button{margin-top:1rem;padding:.5rem 1rem}progress{width:100%;margin-top:1rem}
p[role=status]{min-height:1.5em}`;

const SCRIPT = `const config = JSON.parse(document.getElementById("upload-config").textContent);
const input = document.getElementById("file");
const button = document.getElementById("start");
const bar = document.getElementById("bar");
const status = document.getElementById("status");
const megabytes = (bytes) => (bytes / 1048576).toFixed(1) + " MB";
function show(text) { status.textContent = text; }
async function upload() {
  const file = input.files[0];
  if (!file) return;
  if (file.size !== config.size) { show(config.text.wrongSize); return; }
  button.disabled = true;
  try {
    const answer = await fetch(location.href, { headers: { accept: "application/json" } });
    if (!answer.ok) throw new Error("status " + answer.status);
    const state = await answer.json();
    let done = state.receivedBytes;
    for (const index of state.missingChunks) {
      const start = index * config.chunkSize;
      const end = Math.min(start + config.chunkSize, config.size) - 1;
      const sent = await fetch(location.href, { method: "PUT", headers: { "content-range": "bytes " + start + "-" + end + "/" + config.size }, body: file.slice(start, end + 1) });
      if (!sent.ok) throw new Error("status " + sent.status);
      done += end - start + 1;
      bar.value = done / config.size;
      show(config.text.progress.replace("{done}", megabytes(done)).replace("{total}", megabytes(config.size)));
    }
    bar.value = 1;
    show(config.text.done);
  } catch {
    show(config.text.failed);
    button.disabled = false;
  }
}
button.addEventListener("click", upload);`;

/** The page for a session; a finalized or complete one shows that it is done. */
export function renderUploadPage(ctx: Pick<FilesContext, "config">, status: UploadStatus): Response {
  const text = (selectMessages(getFilesModule(ctx.config).messages, ctx.config.locale) as FilesMessages).uploadPage;
  const nonce = randomBytes(16).toString("base64");
  const isDone = status.state === "complete" || status.state === "finalized";
  const config = { size: status.size, chunkSize: status.chunkSize, text };
  const expected = text.expected.replace("{name}", status.name).replace("{size}", `${(status.size / 1048576).toFixed(1)} MB`);
  const html = `<!doctype html>
<html lang="${escapeHtml(ctx.config.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(text.title)}</title>
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<h1>${escapeHtml(text.title)}</h1>
<p>${escapeHtml(text.intro)}</p>
<p>${escapeHtml(expected)}</p>
${
  isDone
    ? `<p role="status">${escapeHtml(text.done)}</p>`
    : `<label for="file">${escapeHtml(text.choose)}</label><br>
<input id="file" type="file">
<br><button id="start" type="button">${escapeHtml(text.start)}</button>
<progress id="bar" max="1" value="${String(status.receivedBytes / status.size)}"></progress>
<p id="status" role="status"></p>
<script id="upload-config" type="application/json">${toScriptJson(config)}</script>
<script nonce="${nonce}">${SCRIPT}</script>`
}
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "content-security-policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'`,
    },
  });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${String(char.charCodeAt(0))};`);
}

/** JSON safe inside a `<script>` element: no `<` can close it. */
function toScriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
