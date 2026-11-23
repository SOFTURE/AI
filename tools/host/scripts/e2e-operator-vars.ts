// The extra vars `softure-host operator add-key` and `operator remove-key` hand to ansible/operator.yml, for the
// converge test (e2e/converge.sh).
// Usage: tsx scripts/e2e-operator-vars.ts present <label> <key file>   |   tsx scripts/e2e-operator-vars.ts absent <label>
// With a key file it issues a key pair, writes its private half there (0600) and the public line next to it
// (<key file>.pub), or reuses that pair when it exists, and reads the public line exactly as `add-key --key` does.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildOperatorVars } from "../src/ansible/index.js";
import { findApp, parseInventory } from "../src/inventory/index.js";
import { generateDeployKey, parsePublicKey } from "../src/ssh/index.js";

const [state, label, keyFile] = process.argv.slice(2);
if ((state !== "present" && state !== "absent") || label === undefined || (state === "present" && keyFile === undefined)) {
  process.stderr.write("usage: e2e-operator-vars.ts present <label> <key file> | absent <label>\n");
  process.exit(2);
}
const inventory = parseInventory(
  {
    server: { host: "server.test", adminUser: "admin" },
    edge: { manage: false },
    apps: [{ slug: "notes", repo: "acme/notes", host: "notes.example.com" }],
  },
  "e2e",
);
const app = findApp(inventory, "notes");
if (state === "absent" || keyFile === undefined) {
  process.stdout.write(JSON.stringify(buildOperatorVars(inventory, app, label, { state: "absent" })));
} else {
  if (!existsSync(`${keyFile}.pub`)) {
    const key = generateDeployKey("operator@laptop");
    writeFileSync(keyFile, key.privateKey, { mode: 0o600 });
    writeFileSync(`${keyFile}.pub`, `${key.publicKey}\n`);
  }
  const parsed = parsePublicKey(readFileSync(`${keyFile}.pub`, "utf8"));
  if (!parsed.ok) throw new Error(parsed.reason);
  process.stdout.write(JSON.stringify(buildOperatorVars(inventory, app, label, { state: "present", key: parsed.key })));
}
