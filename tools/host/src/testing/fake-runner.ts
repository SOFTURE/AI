import type { CaptureResult, Runner } from "../cli/process.js";

export interface RecordedCall {
  kind: "capture" | "stream";
  program: string;
  args: readonly string[];
  input?: string;
  env?: Readonly<Record<string, string>>;
}

/** Answers a call by its command line; unmatched captures succeed with empty output, streams exit 0. */
export type Responder = (call: RecordedCall) => Partial<CaptureResult> | undefined;

/** A runner that records every call and answers from `respond`, so commands run without gh, ssh or Ansible. */
export function createFakeRunner(respond: Responder = () => undefined): Runner & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  return {
    calls,
    capture(program, args, input) {
      const call: RecordedCall = { kind: "capture", program, args, ...(input === undefined ? {} : { input }) };
      calls.push(call);
      const answer = respond(call);
      return Promise.resolve({ status: 0, stdout: "", stderr: "", ...answer });
    },
    stream(program, args, env) {
      const call: RecordedCall = { kind: "stream", program, args, ...(env === undefined ? {} : { env }) };
      calls.push(call);
      return Promise.resolve(respond(call)?.status ?? 0);
    },
  };
}

/** The command line of a call as one string, for matching and readable assertions. */
export function formatCall(call: RecordedCall): string {
  return [call.program, ...call.args].join(" ");
}
