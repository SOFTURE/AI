import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";

export type ReceivedRequest = {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

export type OtlpReceiver = {
  url: string;
  requests: ReceivedRequest[];
  /** Every body received on `path`, concatenated. */
  bodyOf(path: string): Buffer;
  close(): Promise<void>;
};

export type OtlpReceiverOptions = {
  /** The status every request gets. Default 200. */
  status?: number;
};

/** A stand-in OTLP/HTTP receiver on a random local port: answers `status` (200) and records every request. */
export async function startOtlpReceiver(options: OtlpReceiverOptions = {}): Promise<OtlpReceiver> {
  const status = options.status ?? 200;
  const requests: ReceivedRequest[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      requests.push({
        method: request.method ?? "",
        path: request.url ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks),
      });
      response.writeHead(status, { "content-type": "application/x-protobuf" });
      response.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    bodyOf: (path) => Buffer.concat(requests.filter((request) => request.path === path).map((request) => request.body)),
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      }),
  };
}
