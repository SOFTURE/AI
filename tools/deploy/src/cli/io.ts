/** What a command may touch, passed in so the commands run in tests without a child process. */
export interface CliIo {
  cwd: string;
  env: Readonly<Record<string, string | undefined>>;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}
