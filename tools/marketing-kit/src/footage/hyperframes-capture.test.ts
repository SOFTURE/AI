import { describe, expect, it } from "vitest";
import { readHyperframesCapture } from "./hyperframes-capture.js";

const SUMMARY = "beginframe capture · software gpu · compile 0.8s · extract 8.7s · audio 2.2s · probe 0.3s · setup 2.2s · capture 31.4s · encode 7.2s · assemble 0.6s";
const HINT = "Screenshot capture (slower): BeginFrame did not run. Needs chrome-headless-shell and no --resolution upscale. Heavy compositions can stall on software GL.";

describe("readHyperframesCapture", () => {
  it("reads the path, the GPU mode and every stage's seconds from the summary line", () => {
    const lines = ["", "◇  /build/render.mp4", "   12.4 MB · 37.1s video · rendered in 53.4s", `   ${SUMMARY}`];
    expect(readHyperframesCapture(lines)).toEqual({
      path: "beginframe",
      gpu: "software",
      seconds: { compile: 0.8, extract: 8.7, audio: 2.2, probe: 0.3, setup: 2.2, capture: 31.4, encode: 7.2, assemble: 0.6 },
      isEncodeStreamed: false,
      fallbackHint: null,
    });
  });

  it("reports a screenshot capture with hyperframes' hint", () => {
    const capture = readHyperframesCapture(["   screenshot capture · software gpu · capture 2m 36.4s", `   ${HINT}`]);
    expect(capture).toEqual({ path: "screenshot", gpu: "software", seconds: { capture: 156.4 }, isEncodeStreamed: false, fallbackHint: HINT });
  });

  it("reads a streamed encode as the encode stage", () => {
    const capture = readHyperframesCapture(["hardware gpu · capture 10.0s · encode (during capture) 4.5s"]);
    expect(capture).toEqual({ path: null, gpu: "hardware", seconds: { capture: 10, encode: 4.5 }, isEncodeStreamed: true, fallbackHint: null });
  });

  it("strips the colour codes hyperframes' dim style adds", () => {
    expect(readHyperframesCapture([`   \u001B[2m${SUMMARY}\u001B[22m`])?.path).toBe("beginframe");
  });

  it("answers null when hyperframes printed no summary", () => {
    expect(readHyperframesCapture([])).toBeNull();
    expect(readHyperframesCapture(["Rendering 37.1s of video", "   12.4 MB · 37.1s video · rendered in 53.4s", HINT])).toBeNull();
  });

  it("does not take a line with an unknown part for a summary", () => {
    expect(readHyperframesCapture(["warp capture · capture 1.0s"])).toBeNull();
    expect(readHyperframesCapture(["beginframe capture · render 3.0s"])).toBeNull();
    expect(readHyperframesCapture(["beginframe capture · capture fast"])).toBeNull();
  });

  it("keeps the last summary when hyperframes printed more than one", () => {
    expect(readHyperframesCapture(["screenshot capture · capture 9.0s", "beginframe capture · capture 6.0s"])?.path).toBe("beginframe");
  });
});
