# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/analytics`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`analytics@x.y.z`).

## 0.1.8

- `analytics({ origins })`: extra first-party origins (a public site on the apex next to the product on
  `appOrigin`). The funnel endpoint counts pages on any of them, `readChannel` and the proxy piece read a
  tag from them, and `getChannelRule` hands them to the browser.
- Behind a reverse proxy, the origin a request was sent to comes from `Host` (scheme from
  `X-Forwarded-Proto`), accepted only when configured (`readPublicOrigin`, `getFirstPartyOrigins` in
  `/server`). `tag` redirects on that origin instead of always on `appOrigin`.
- `carry` keeps a relative `Location` relative instead of resolving it against the request URL, which
  behind a proxy names the server's internal host.
- `createChannelTagger(config, { channelFromReferer })` tags navigations from untagged first-party pages.
- `<ChannelKeeper />` tags links to another first-party origin on click (`createChannelKeeper(rule).tagLink`),
  and now applies `normalize` in the browser as documented.
- `<FunnelPixel>` takes `className`, decodes asynchronously and is positioned absolutely without a class.
- `funnel.isKnownChannel(channel, ctx)` keeps channels the app knows from its own tables past the daily cap.

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
