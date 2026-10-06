# Research: deploy-row-count-server-list

## 1. Where the shipped deploy.json is on the server

DF-7's `deploy.sh` unpacks the archive into `releases/<tag>/` and copies every file but `deploy.sh` next to itself
(`install_release`). `deploy.json` is in the archive only when the caller's `deploy-config` input is not empty
(`deploy-app.yml`, step "Pack the release"); `server-files.test.ts` covers the empty case ("ships no deploy.json").

The copy next to the script is not a reliable source: "Files a release no longer ships stay here" (template header,
README Limitations), so a release that stops shipping `deploy.json` would still count an older list. The copy in
`releases/<tag>/` is exactly what this tag shipped, and the current tag's folder is the newest, so the pruning
(`RELEASE_KEEP=5`, newest first) never removes it during its own run. **Decision:** read
`$release_dir/deploy.json`.

## 2. row-counts without a list

`runRowCounts` (`src/cli/db-commands.ts`): with `--config=<file>` it reads the file through `readDeployConfig`
(schema-validated) and exits 2 ("no tables to count") when `database.rowCountTables` is absent; a missing explicit
file fails too. Exit 2 is also every other usage error, so `deploy.sh` cannot tell "no list" from a broken call by
the exit code. **Decision:** `deploy.sh` checks for the key itself before it calls `row-counts`, and keeps today's
"empty list skips the comparison".

## 3. How deploy.sh can read one JSON key

The database part of `deploy.sh` already needs Node.js 22 on the host (`npx @softure-ai/deploy`); `jq` is not a
stated requirement. **Decision:** a `node -e` one-liner that exits 0 when the key holds a non-empty array, 3 when the
file or key is absent, and anything else (unparsable JSON) fails the release before anything is restarted. The
schema itself is still checked by `row-counts`, which reads the same file.

## 4. A table created by the same release

`countRows` runs `SELECT count(*)` per table; a table the old schema lacks fails the count before the switch, so the
release stops with "counting rows failed; nothing was restarted" (safe, nothing restarted). Today's template says "A
table joins the list after the release that creates it", and that stays true. With the list in the app's repository
the mistake is easier to make (a migration and its table in the list in one commit). Recorded as a new gap (DF-14)
rather than fixed here: `row-counts` could count a missing table as "not there yet" before the switch.

## 5. init

`buildValues` (`src/init/generate.ts`) renders `rowCountTables` as a comma list for the script. The template engine
is line-based (`{{#key}}` stands alone on its line), so the `database` block goes before `verify` in
`deploy.json.tmpl` with a trailing comma inside the section. It is written only for an app with a database (without
one `deploy.sh` has no database steps) and when `--tables` is given. The JSON array is rendered with
`JSON.stringify` per name; names are already restricted to `[a-z0-9_.]`.

## 6. Upgrade of existing apps

`@softure-ai/deploy` 0.1.3 (DF-7) is not published yet (npm has 0.1.1), so no app has a `deploy.sh` that reads the
archive; this change rides the same 0.1.3. The README's note for scripts from 0.1.2 or earlier stays, and the DF-8
limitation line is removed.
