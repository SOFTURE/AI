// A local S3 for the tests: path-style PUT, GET and ListObjectsV2 over HTTP, checking every request's SigV4
// signature with the secret of its access key. The "writer" key may only PUT, like an R2 "Object Write" token; the
// "reader" key may only GET and list. Nothing leaves the machine.
import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { signRequest } from "@softure-ai/backup/offsite";

export const BUCKET = "acme-backups";
export const REGION = "auto";
export const WRITER = { id: "writer-key-id", secret: "writer-secret-value-123" } as const;
export const READER = { id: "reader-key-id", secret: "reader-secret-value-456" } as const;

export interface FakeS3 {
  readonly endpoint: string;
  readonly objects: Map<string, Buffer>;
  /** Every request as `<method> <path and query> <access key id>`. */
  readonly requests: string[];
  close(): Promise<void>;
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    request.on("error", reject);
  });
}

function xmlError(code: string, message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function startFakeS3(): Promise<FakeS3> {
  const objects = new Map<string, Buffer>();
  const requests: string[] = [];
  const server: Server = createServer((request, response) => {
    void (async () => {
      const body = await readBody(request);
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
      const authorization = request.headers.authorization ?? "";
      const keyId = /Credential=([^/]+)\//.exec(authorization)?.[1] ?? "";
      requests.push(`${request.method ?? ""} ${url.pathname}${url.search} ${keyId}`);
      const credential = keyId === WRITER.id ? WRITER : keyId === READER.id ? READER : null;
      const payloadSha256 = String(request.headers["x-amz-content-sha256"] ?? "");
      const amzDate = String(request.headers["x-amz-date"] ?? "");
      const signedNames = (/SignedHeaders=([^,]+)/.exec(authorization)?.[1] ?? "").split(";");
      const extra: Record<string, string> = {};
      for (const name of signedNames) {
        if (!["host", "x-amz-date", "x-amz-content-sha256"].includes(name)) extra[name] = String(request.headers[name] ?? "");
      }
      const expected =
        credential === null
          ? null
          : signRequest({
              method: request.method === "PUT" ? "PUT" : "GET",
              url,
              headers: extra,
              payloadSha256,
              region: REGION,
              accessKeyId: credential.id,
              secretAccessKey: credential.secret,
              now: new Date(amzDate.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")),
            }).authorization;
      if (credential === null || expected !== authorization) {
        response.writeHead(403, { "content-type": "application/xml" }).end(xmlError("SignatureDoesNotMatch", "The request signature does not match."));
        return;
      }
      const [, bucket, ...rest] = url.pathname.split("/");
      if (bucket !== BUCKET) {
        response.writeHead(404).end(xmlError("NoSuchBucket", "The bucket does not exist."));
        return;
      }
      const key = rest.map((part) => decodeURIComponent(part)).join("/");
      if (request.method === "PUT") {
        if (credential !== WRITER) {
          response.writeHead(403).end(xmlError("AccessDenied", "Access Denied"));
          return;
        }
        if (createHash("sha256").update(body).digest("hex") !== payloadSha256) {
          response.writeHead(400).end(xmlError("XAmzContentSHA256Mismatch", "The provided sha256 does not match."));
          return;
        }
        objects.set(key, body);
        response.writeHead(200).end();
        return;
      }
      if (credential !== READER) {
        response.writeHead(403).end(xmlError("AccessDenied", "Access Denied"));
        return;
      }
      if (key === "" && url.searchParams.get("list-type") === "2") {
        const prefix = url.searchParams.get("prefix") ?? "";
        const contents = [...objects.entries()]
          .filter(([name]) => name.startsWith(prefix))
          .map(([name, data]) => `<Contents><Key>${escapeXml(name)}</Key><Size>${String(data.length)}</Size></Contents>`)
          .join("");
        response.writeHead(200, { "content-type": "application/xml" }).end(`<ListBucketResult><IsTruncated>false</IsTruncated>${contents}</ListBucketResult>`);
        return;
      }
      const data = objects.get(key);
      if (data === undefined) {
        response.writeHead(404).end(xmlError("NoSuchKey", "The specified key does not exist."));
        return;
      }
      response.writeHead(200, { "content-length": String(data.length) }).end(data);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `http://127.0.0.1:${String(port)}`,
    objects,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          resolve();
        });
      }),
  };
}
