# Research: observability-grafana-apply-1006

## Grafana HTTP API (Grafana 11/12, Grafana Cloud)

- Folder: `GET /api/folders/<uid>` (404 when missing), `POST /api/folders` `{ uid, title }`.
- Contact point: `GET /api/v1/provisioning/contact-points?name=<name>` returns an array (empty when missing).
- Rule group: `GET|PUT /api/v1/provisioning/folder/<folderUid>/rule-groups/<group>`; the `PUT` body
  `{ title, folderUid, interval (seconds), rules }` replaces the whole group (rules left out are deleted). Header
  `X-Disable-Provenance: true` keeps the rules editable in the UI. Each rule: `uid, title, condition, data, for,
  noDataState, execErrState, labels, annotations, isPaused, notification_settings: { receiver }, folderUID,
  ruleGroup`.
- Dashboard: `GET /api/dashboards/uid/<uid>` (404 when missing), `POST /api/dashboards/db`
  `{ dashboard, folderUid, overwrite: true, message }`; `dashboard.id` must be null for an upsert by uid.
- Auth: `Authorization: Bearer <service account token>`.

## Labels the package writes

- Metrics: OTLP resource attributes become `target_info{service_namespace, service_name, deployment_environment}`
  (the package writes both `deployment.environment` and `deployment.environment.name`).
- Logs: Loki stream labels `service_namespace`, `service_name`, `deployment_environment`; the logger's
  `severityText` is the level upper-cased (`WARN`, `ERROR`), stored as structured metadata `severity_text`.

## Options

1. Command + function in this package with a zod schema and rule builders (the issue's proposal). Chosen.
2. A separate `@softure-ai/grafana` package: a new package is the owner's call, and the rules key on the labels this
   package writes. Rejected.
3. Terraform/grizzly in the app: a second toolchain per app. Rejected.

## Existing code

- `src/cli/run.ts` parses `ping` with an injected env and output; `grafana apply` follows the same shape.
- No zod yet in the package; the repo pins `zod ^4.6.5` in 28 packages.
