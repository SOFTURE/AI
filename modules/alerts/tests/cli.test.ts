// `softure-alerts test`: one test message per channel, without the queue, and its exit codes.
import { err, ok, createTestClock } from "@softure-ai/core";
import { ALERTS_USAGE, EXIT_FAILED, EXIT_OK, EXIT_USAGE, runAlertsCli } from "@softure-ai/alerts/cli";
import { describe, expect, it } from "vitest";
import { createConfig, NOW, recordingChannel } from "./support.js";

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, output: { log: (line: string) => lines.push(line), error: (line: string) => errors.push(line) } };
}

describe("softure-alerts test", () => {
  it("sends a test message to every channel and reports each", async () => {
    const ops = recordingChannel();
    const chat = recordingChannel();
    chat.respond = () => err("alerts.channel_refused");
    const config = createConfig({ channels: { ops: ops.channel, chat: chat.channel } });
    const out = capture();
    expect(await runAlertsCli({ config, argv: ["test"], output: out.output, clock: createTestClock(NOW) })).toBe(EXIT_FAILED);
    expect(out.lines).toEqual(["ops: sent"]);
    expect(out.errors).toEqual(["chat: alerts.channel_refused"]);
    expect(ops.deliveries[0]?.subject).toBe("[Test] Test alert from softure-alerts");
    expect(ops.deliveries[0]?.text).toContain("If you can read this, the ops channel delivers alerts.");
    expect(ops.deliveries[0]?.message).toMatchObject({ kind: "test", severity: "info", at: NOW.toISOString() });
  });

  it("sends only to --channel, at --severity", async () => {
    const ops = recordingChannel();
    const chat = recordingChannel();
    chat.respond = () => ok();
    const config = createConfig({ channels: { ops: ops.channel, chat: chat.channel } });
    const out = capture();
    expect(await runAlertsCli({ config, argv: ["test", "--channel", "chat", "--severity", "critical"], output: out.output })).toBe(EXIT_OK);
    expect(ops.deliveries).toEqual([]);
    expect(chat.deliveries[0]?.message.severity).toBe("critical");
  });

  it("refuses an unknown channel, a bad severity and an unknown command", async () => {
    const config = createConfig({ channels: { ops: recordingChannel().channel } });
    const out = capture();
    expect(await runAlertsCli({ config, argv: ["test", "--channel", "pager"], output: out.output })).toBe(EXIT_USAGE);
    expect(await runAlertsCli({ config, argv: ["test", "--severity", "loud"], output: out.output })).toBe(EXIT_USAGE);
    expect(await runAlertsCli({ config, argv: ["test", "--nope"], output: out.output })).toBe(EXIT_USAGE);
    expect(await runAlertsCli({ config, argv: ["send"], output: out.output })).toBe(EXIT_USAGE);
    expect(out.errors[0]).toBe('softure-alerts: no channel "pager"; configured: ops');
  });

  it("prints the usage", async () => {
    const out = capture();
    expect(await runAlertsCli({ argv: ["--help"], output: out.output })).toBe(EXIT_OK);
    expect(await runAlertsCli({ argv: [], output: out.output })).toBe(EXIT_USAGE);
    expect(out.lines).toEqual([ALERTS_USAGE, ALERTS_USAGE]);
  });
});
