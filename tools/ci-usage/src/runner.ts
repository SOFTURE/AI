// Which runner a job ran on, read from the labels it asked for and the runner group that took it.

/** GitHub's billing SKUs for its standard hosted runners ("Actions runner pricing"). */
export const GITHUB_SKUS = ["actions_linux_slim", "actions_linux", "actions_linux_arm", "actions_windows", "actions_windows_arm", "actions_macos"] as const;

export type GithubSku = (typeof GITHUB_SKUS)[number];

export type Architecture = "x64" | "arm64";

export type RunnerClass =
  | { provider: "github-hosted"; label: string; sku: GithubSku }
  | { provider: "ubicloud"; label: string; vcpu: number; architecture: Architecture }
  | { provider: "self-hosted"; label: string };

export type Provider = RunnerClass["provider"];

export interface RunnerInput {
  labels: readonly string[];
  runnerGroupName: string | null;
}

/** The runner group GitHub assigns to its own hosted runners. */
const GITHUB_RUNNER_GROUP = "GitHub Actions";
const UBICLOUD_LABEL = /^ubicloud(?:-(?:standard|premium)-(\d+))?(-arm)?(?:-ubuntu-\d{4})?$/;
const UBICLOUD_VCPUS = new Set([2, 4, 8, 16, 30]);
const DEFAULT_UBICLOUD_VCPU = 2;

function getGithubSku(label: string): GithubSku | null {
  if (label === "ubuntu-slim") return "actions_linux_slim";
  if (/^ubuntu-.*-arm$/.test(label)) return "actions_linux_arm";
  if (label.startsWith("ubuntu-")) return "actions_linux";
  if (/^windows-.*-arm$/.test(label)) return "actions_windows_arm";
  if (label.startsWith("windows-")) return "actions_windows";
  if (label.startsWith("macos-")) return "actions_macos";
  return null;
}

function classifyUbicloud(label: string): RunnerClass | null {
  const match = UBICLOUD_LABEL.exec(label);
  if (!match) return null;
  const vcpu = match[1] === undefined ? DEFAULT_UBICLOUD_VCPU : Number(match[1]);
  if (!UBICLOUD_VCPUS.has(vcpu)) return null;
  return { provider: "ubicloud", label, vcpu, architecture: match[2] === undefined ? "x64" : "arm64" };
}

/**
 * Classifies one job's runner. A Ubicloud label wins; then a GitHub image label (`ubuntu-*`, `windows-*`, `macos-*`)
 * or GitHub's own runner group; anything else is a self-hosted runner priced only from the caller's table.
 */
export function classifyRunner(input: RunnerInput): RunnerClass {
  const label = input.labels.join(",") || "unknown";
  for (const candidate of input.labels) {
    const ubicloud = classifyUbicloud(candidate);
    if (ubicloud) return ubicloud;
  }
  for (const candidate of input.labels) {
    const sku = getGithubSku(candidate);
    if (sku) return { provider: "github-hosted", label: candidate, sku };
  }
  // A larger GitHub runner carries a custom label but runs in GitHub's group; it is billed like Linux unless the
  // caller's price table names its label.
  if (input.runnerGroupName === GITHUB_RUNNER_GROUP) return { provider: "github-hosted", label, sku: "actions_linux" };
  return { provider: "self-hosted", label };
}
