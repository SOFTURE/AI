// A fake `ssh` for tests of operator wrappers around `softure-deploy run` and `report` (issue #405): first on `PATH`,
// it records each call's arguments and stdin and answers with a scripted reply, so a wrapper is tested without a
// server. The fake is a bash script (bash 3.2, no GNU-only flags) so it runs wherever the wrapper's own shell does.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

/** What the fake prints and how it exits, for one call. */
export interface FakeSshReply {
  readonly stdout?: string;
  readonly stderr?: string;
  /** The exit status, 0 to 255; 255 is how real ssh reports its own failure. Default 0. */
  readonly status?: number;
}

/** One call the fake received. */
export interface FakeSshCall {
  /** Its arguments, as the program got them: `["-T", "--", "app-prod", "run grant-access --commit"]`. */
  readonly args: readonly string[];
  /** Everything it read on stdin. */
  readonly stdin: string;
}

export interface InstallFakeSshOptions {
  /** One reply for every call, or one per call in order, the last repeating. Default: empty output, status 0. */
  readonly reply?: FakeSshReply | readonly FakeSshReply[];
  /** The program name put on `PATH`. Default `ssh`. */
  readonly name?: string;
  /** The environment whose `PATH` gets the fake first. Default `process.env`. */
  readonly env?: Record<string, string | undefined>;
}

export interface FakeSsh {
  /** The fake's absolute path, for `--ssh=<program>`. */
  readonly path: string;
  /** The folder on `PATH` that holds the fake. */
  readonly binDir: string;
  /** The calls so far, oldest first; read again on every access. */
  readonly calls: readonly FakeSshCall[];
  /** Puts `PATH` back as it was and removes the fake's folder. */
  restore(): void;
}

const PROGRAM_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Reads stdin to the end, so give the command under test a stdin that ends (an input, or /dev/null).
const FAKE_SSH = `#!/usr/bin/env bash
# A fake ssh from @softure-ai/deploy/testing: records the call, prints the scripted reply.
set -e
root="$(cd "$(dirname "$0")/.." && pwd)"
index="$(cat "$root/count")"
printf '%s\\n' "$((index + 1))" > "$root/count"
: > "$root/calls/$index.args"
for arg in "$@"; do printf '%s\\0' "$arg" >> "$root/calls/$index.args"; done
cat > "$root/calls/$index.stdin"
reply="$index"
last="$(cat "$root/replies/last")"
if [ "$reply" -gt "$last" ]; then reply="$last"; fi
cat "$root/replies/$reply.stdout"
cat "$root/replies/$reply.stderr" >&2
exit "$(cat "$root/replies/$reply.status")"
`;

function toReplies(reply: InstallFakeSshOptions["reply"]): readonly FakeSshReply[] {
  if (reply === undefined) return [{}];
  const replies: readonly FakeSshReply[] = Array.isArray(reply) ? reply : [reply as FakeSshReply];
  if (replies.length === 0) throw new Error("installFakeSsh: reply is an empty list; give at least one reply");
  for (const [index, { status = 0 }] of replies.entries()) {
    if (!Number.isInteger(status) || status < 0 || status > 255) {
      throw new Error(`installFakeSsh: reply ${String(index)} has status ${String(status)}; use an integer from 0 to 255`);
    }
  }
  return replies;
}

function readCalls(root: string): FakeSshCall[] {
  const count = Number(readFileSync(join(root, "count"), "utf8").trim());
  const calls: FakeSshCall[] = [];
  for (let index = 0; index < count; index++) {
    const args = readFileSync(join(root, "calls", `${String(index)}.args`), "utf8").split("\0").slice(0, -1);
    const stdin = readFileSync(join(root, "calls", `${String(index)}.stdin`), "utf8");
    calls.push({ args, stdin });
  }
  return calls;
}

/**
 * Puts a fake `ssh` first on `PATH` (of `process.env` unless `env` is given) and returns it. Each call is recorded
 * (arguments and stdin) and answered with the scripted reply. Call `restore()` when the test ends.
 */
export function installFakeSsh(options: InstallFakeSshOptions = {}): FakeSsh {
  const name = options.name ?? "ssh";
  if (!PROGRAM_NAME.test(name)) throw new Error(`installFakeSsh: "${name}" is not a program name`);
  const replies = toReplies(options.reply);
  const env = options.env ?? process.env;
  const root = mkdtempSync(join(tmpdir(), "softure-fake-ssh-"));
  const binDir = join(root, "bin");
  mkdirSync(binDir);
  mkdirSync(join(root, "calls"));
  mkdirSync(join(root, "replies"));
  writeFileSync(join(root, "count"), "0\n");
  writeFileSync(join(root, "replies", "last"), `${String(replies.length - 1)}\n`);
  for (const [index, reply] of replies.entries()) {
    writeFileSync(join(root, "replies", `${String(index)}.stdout`), reply.stdout ?? "");
    writeFileSync(join(root, "replies", `${String(index)}.stderr`), reply.stderr ?? "");
    writeFileSync(join(root, "replies", `${String(index)}.status`), `${String(reply.status ?? 0)}\n`);
  }
  const path = join(binDir, name);
  writeFileSync(path, FAKE_SSH);
  chmodSync(path, 0o755);

  const hadPath = Object.prototype.hasOwnProperty.call(env, "PATH");
  const previousPath = env.PATH;
  env.PATH = previousPath === undefined || previousPath === "" ? binDir : `${binDir}${delimiter}${previousPath}`;
  let restored = false;
  return {
    path,
    binDir,
    get calls() {
      return readCalls(root);
    },
    restore() {
      if (restored) return;
      restored = true;
      if (hadPath) env.PATH = previousPath;
      else delete env.PATH;
      rmSync(root, { recursive: true, force: true });
    },
  };
}
