import { describe, expect, it } from "vitest";
import { parseInventory } from "../inventory/index.js";
import { generateDeployKey, getFingerprint, parsePublicKey, type PublicKey } from "../ssh/index.js";
import {
  formatOperatorLine,
  formatOperatorSsh,
  isOperatorLabel,
  listDeployCommands,
  listOperatorLines,
} from "./index.js";

function parseKey(line: string): PublicKey {
  const parsed = parsePublicKey(line);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.key;
}

const KEY = parseKey(generateDeployKey("jaro@laptop").publicKey);
const OTHER = parseKey(generateDeployKey("other").publicKey);

describe("isOperatorLabel", () => {
  it("accepts lower-case letters and digits", () => {
    expect(["default", "laptop2", "a"].map(isOperatorLabel)).toEqual([true, true, true]);
  });

  it("refuses dashes, upper case, empty, too long and the reserved release label", () => {
    expect(["x-release", "Laptop", "", "a".repeat(33), "release", "a b"].map(isOperatorLabel)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("formatOperatorLine", () => {
  it("binds the key to the app's deploy.sh with restrict and replaces the key's own comment", () => {
    expect(formatOperatorLine("notes", "laptop", KEY)).toBe(
      `command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${KEY.body} notes-operator-laptop`,
    );
  });
});

describe("listOperatorLines", () => {
  const file = [
    `command="/srv/notes/deploy.sh",restrict ssh-ed25519 ${OTHER.body} notes-release`,
    formatOperatorLine("notes", "laptop", KEY),
    formatOperatorLine("notes-operator", "x", OTHER),
    `command="/srv/notes-operator/deploy.sh",restrict ssh-ed25519 ${OTHER.body} notes-operator-release`,
    `ssh-ed25519 ${OTHER.body} notes-operator-byhand`,
    "",
  ].join("\n");

  it("lists only this app's operator lines and flags a line without the forced command", () => {
    expect(listOperatorLines(file, "notes")).toEqual([
      { label: "laptop", fingerprint: getFingerprint(`ssh-ed25519 ${KEY.body}`), isRestricted: true },
      { label: "byhand", fingerprint: getFingerprint(`ssh-ed25519 ${OTHER.body}`), isRestricted: false },
    ]);
  });

  it("never reads another app's line as its own", () => {
    expect(listOperatorLines(file, "notes-operator").map((line) => line.label)).toEqual(["x"]);
  });

  it("returns nothing for an empty file", () => {
    expect(listOperatorLines("", "notes")).toEqual([]);
  });
});

describe("operator commands", () => {
  const inventory = parseInventory(
    {
      server: { host: "srv.example.com", adminUser: "admin", port: 2222 },
      edge: { manage: false },
      apps: [
        { slug: "notes", repo: "acme/notes", host: "notes.example.com", database: true },
        { slug: "site", repo: "acme/site", host: "site.example.com" },
      ],
    },
    "inventory.yml",
  );

  it("names run and report only for an app with a database", () => {
    const [notes, site] = inventory.apps;
    expect(notes === undefined ? [] : listDeployCommands(notes)).toContain("run <script> [--key=value ...]");
    expect(site === undefined ? [] : listDeployCommands(site)).toEqual([
      "status",
      "deploy <tag>",
      "maintain [<hook>]",
      "cleanup [--keep=<n>] [--commit]",
    ]);
  });

  it("prints the ssh line with the port when it is not 22", () => {
    expect(formatOperatorSsh(inventory, "~/.ssh/notes-operator")).toBe("ssh -i ~/.ssh/notes-operator -p 2222 deploy@srv.example.com");
  });
});
