import type { Readable } from "node:stream";

/** What a command may touch, passed in so the commands run in tests without a child process. */
export interface CliIo {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** What a command run on the server reads (`run`); unset, the child inherits this process's stdin. */
  stdin?: Readable;
  /** The input of the `--stdin` modes (a dump, a snapshot line from `psql`); absent reads as an empty input. */
  input?: NodeJS.ReadableStream;
}

/** The whole input as text (a snapshot line from `psql`). */
export async function readInputText(io: CliIo): Promise<string> {
  if (io.input === undefined) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of io.input) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
