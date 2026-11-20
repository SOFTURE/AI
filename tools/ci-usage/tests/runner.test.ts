import { describe, expect, it } from "vitest";
import { DEFAULT_PRICES, getMinutePrice, parsePriceOverrides } from "../src/prices.js";
import { classifyRunner } from "../src/runner.js";

describe("classifyRunner", () => {
  it.each([
    [["ubuntu-latest"], "actions_linux"],
    [["ubuntu-24.04"], "actions_linux"],
    [["ubuntu-24.04-arm"], "actions_linux_arm"],
    [["ubuntu-slim"], "actions_linux_slim"],
    [["windows-latest"], "actions_windows"],
    [["windows-11-arm"], "actions_windows_arm"],
    [["macos-latest"], "actions_macos"],
  ])("reads %j as the GitHub SKU %s", (labels, sku) => {
    expect(classifyRunner({ labels, runnerGroupName: "GitHub Actions" })).toEqual({ provider: "github-hosted", label: labels[0], sku });
  });

  it.each([
    ["ubicloud", 2, "x64"],
    ["ubicloud-arm", 2, "arm64"],
    ["ubicloud-standard-2", 2, "x64"],
    ["ubicloud-standard-8", 8, "x64"],
    ["ubicloud-standard-30-arm", 30, "arm64"],
    ["ubicloud-standard-4-ubuntu-2204", 4, "x64"],
    ["ubicloud-standard-16-arm-ubuntu-2404", 16, "arm64"],
  ])("reads %s as a Ubicloud runner with %i vCPU on %s", (label, vcpu, architecture) => {
    expect(classifyRunner({ labels: [label], runnerGroupName: "Default" })).toEqual({ provider: "ubicloud", label, vcpu, architecture });
  });

  it("prefers the Ubicloud label among several", () => {
    expect(classifyRunner({ labels: ["self-hosted", "ubicloud-standard-4"], runnerGroupName: "Default" }).provider).toBe("ubicloud");
  });

  it("treats an unknown size and an unknown label as self-hosted", () => {
    expect(classifyRunner({ labels: ["ubicloud-standard-3"], runnerGroupName: "Default" })).toEqual({ provider: "self-hosted", label: "ubicloud-standard-3" });
    expect(classifyRunner({ labels: ["self-hosted", "linux"], runnerGroupName: "Default" })).toEqual({ provider: "self-hosted", label: "self-hosted,linux" });
    expect(classifyRunner({ labels: [], runnerGroupName: null })).toEqual({ provider: "self-hosted", label: "unknown" });
  });

  it("bills a custom label in GitHub's runner group (a larger runner) as Linux", () => {
    expect(classifyRunner({ labels: ["big-linux"], runnerGroupName: "GitHub Actions" })).toEqual({ provider: "github-hosted", label: "big-linux", sku: "actions_linux" });
  });
});

describe("getMinutePrice", () => {
  const options = { prices: DEFAULT_PRICES, ubicloudPremium: false };

  it("prices GitHub SKUs and Ubicloud sizes from the built-in table", () => {
    expect(getMinutePrice({ provider: "github-hosted", label: "macos-latest", sku: "actions_macos" }, options)).toBe(0.062);
    expect(getMinutePrice({ provider: "ubicloud", label: "ubicloud-standard-8", vcpu: 8, architecture: "x64" }, options)).toBe(0.005);
    expect(getMinutePrice({ provider: "ubicloud", label: "ubicloud-standard-8", vcpu: 8, architecture: "x64" }, { ...options, ubicloudPremium: true })).toBe(0.008);
  });

  it("knows no price for a self-hosted runner unless the caller names its label", () => {
    const runner = { provider: "self-hosted", label: "my-box" } as const;
    expect(getMinutePrice(runner, options)).toBeNull();
    const parsed = parsePriceOverrides('{"my-box":0.004}');
    expect(parsed.ok && getMinutePrice(runner, { ...options, prices: parsed.prices })).toBe(0.004);
  });

  it("lets a label override win over the built-in SKU", () => {
    const parsed = parsePriceOverrides('{"ubuntu-latest":0}');
    expect(parsed.ok && getMinutePrice({ provider: "github-hosted", label: "ubuntu-latest", sku: "actions_linux" }, { ...options, prices: parsed.prices })).toBe(0);
  });
});

describe("parsePriceOverrides", () => {
  it("keeps the table for an empty value", () => {
    expect(parsePriceOverrides("  ")).toEqual({ ok: true, prices: DEFAULT_PRICES });
  });

  it("refuses text that is not JSON and values that are not prices", () => {
    expect(parsePriceOverrides("{")).toEqual({ ok: false, error: "--prices is not JSON: {" });
    expect(parsePriceOverrides('{"a":-1}').ok).toBe(false);
    expect(parsePriceOverrides("[1]").ok).toBe(false);
  });
});
