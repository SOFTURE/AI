// The extra vars `softure-host app add` hands to ansible/app.yml, for the converge test (e2e/converge.sh).
// Usage: tsx scripts/e2e-app-vars.ts <deploy.sh> [<key file>]
// With a key file it issues a release key, writes its private half there (0600) and the public line next to it
// (<key file>.pub), or reuses that pair when it exists; without one the vars carry no key, as when GitHub already
// holds DEPLOY_SSH_KEY.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildAppVars } from "../src/ansible/index.js";
import { findApp, parseInventory } from "../src/inventory/index.js";
import { generateDeployKey } from "../src/ssh/index.js";

const [deployScriptFile, keyFile] = process.argv.slice(2);
if (deployScriptFile === undefined) {
  process.stderr.write("usage: e2e-app-vars.ts <deploy.sh> [<key file>]\n");
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
let publicKey: string | undefined;
if (keyFile !== undefined && existsSync(`${keyFile}.pub`)) {
  publicKey = readFileSync(`${keyFile}.pub`, "utf8").trim();
} else if (keyFile !== undefined) {
  const key = generateDeployKey("notes-release");
  writeFileSync(keyFile, key.privateKey, { mode: 0o600 });
  writeFileSync(`${keyFile}.pub`, `${key.publicKey}\n`);
  publicKey = key.publicKey;
}
process.stdout.write(JSON.stringify(buildAppVars(inventory, findApp(inventory, "notes"), { deployScriptFile, publicKey })));
