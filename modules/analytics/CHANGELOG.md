# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/analytics`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`analytics@x.y.z`).

## 0.1.7

- `funnel.wire`: the step may come under several field names (`stepFields`, the first is sent by
  `<FunnelPixel>`, `<FunnelBeacon>` and `createFunnelReporter`), and `channelField` lets a beacon or pixel
  carry its channel.
- `funnel.channelFromReferer(page)` derives a channel from the URL of an untagged page a step was sent from.
- `channel.normalize: "trim-lowercase"` repairs a tag before the checks, on the server and in the
  browser keeper (`ChannelRule.normalize`).

## 0.1.6

- Adapters and commands use the configured database handle.
- `module.json` names `security` as an optional dependency (its body reader is used as a library).
