# Plan: observability host and request metrics

## Approach

Two collectors in the style of the memory gauges and the stable-attributes processor: a batch observable callback
over `/proc` and `statfs`, and a span processor that records a histogram on `onEnd`. Both wired in `start.ts` from
`InstrumentationOptions`.

## Phases

### Phase 1 (test-first): host gauges

- `src/node/host-metrics.ts`, `tests/host-metrics.test.ts` (a fake `/proc` directory and `statfs`): values, CPU share
  only from the second collection, a missing source skipping only its gauges, zero-size filesystem, removal.
- Done when: the file's tests are green.

### Phase 2 (test-first): request metric from server spans

- `src/node/server-span-metrics.ts`, `tests/server-span-metrics.test.ts`: stable and legacy attributes, `_OTHER`,
  client and child spans ignored, a remote parent counted.
- Done when: the file's tests are green.

### Phase 3: wiring, docs and version

- `config.ts` (`host`, `serverSpanMetrics`, `HostMetricOptions`), `start.ts` (meter before tracer, the processor also
  without trace export), `index.ts`; `tests/start.test.ts` end to end through the OTLP receiver.
- README "Metrics" and "Next.js", CHANGELOG; `npm run release:version -- observability patch` (0.8.8).
- Done when: `npx vitest run foundation/observability` green; typecheck and ESLint clean.

## Progress

- [x] Phase 1 (13 tests green)
- [x] Phase 2 (5 tests green)
- [x] Phase 3 (`npx vitest run foundation/observability`: 19 files, 219 tests green; typecheck and ESLint clean)
