# Frame: mk-screenshots

## Request as stated

Roadmap MK-4: `softure-marketing shots` renders `marketing.json` screenshots with FIRE's gates (status
below 400, the expected phrase, at least 40 kB, smaller output deleted), width, height, full page with a
lazy-load scroll, motion reduce/no-preference; English flags and messages; tests against a static page.

## Observation, premise, direction

- Observation: projects need marketing screenshots that are never blank, broken or showing an error page.
- Premise: the gates catch those cases; the config already carries every option.
- Direction: a command over the existing contract, no new schema.

## Premise check

The contract (MK-2) matches the roadmap field by field, so the premise holds. The only real design
choice is how the command is addressed: the CLI takes a film id for every command, a screenshot is not a
film.

## Framings

| Option | What | Cost | Trade-off |
| --- | --- | --- | --- |
| A. Flags per shot | `shots --path=/ --width=1440 --full …`, FIRE's script style | small | duplicates the config; a second source of truth |
| B. Config-driven | `shots [<id>]`: all entries or one, options from `marketing.json`; `--url` and `--config` only | small | none for the roadmap's outcome |
| C. B plus formats | B plus device scale, JPEG/WebP, dark/light pairs | larger | schema changes that collide with parallel items; nobody asked |

## Decision

Option B. The roadmap's "options" are the entry's fields; the CLI only selects entries and the address.
Extra capture formats are not requested and would change the schema other items edit in parallel.
