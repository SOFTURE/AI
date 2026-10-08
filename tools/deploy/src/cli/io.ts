/** What a command may touch, passed in so the commands run in tests without a child process. */
export interface CliIo {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** The input of the `--stdin` modes; absent reads as an empty input. */
  stdin?: NodeJS.ReadableStream;
}

/** The whole input as text (a snapshot line from `psql`). */
export async function readInputText(io: CliIo): Promise<string> {
  if (io.stdin === undefined) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of io.stdin) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}
