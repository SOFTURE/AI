# Implementation review: observability-host-and-request-metrics

Verdict: approve (auto). No drift from the plan. Checked: a sampled-out span (an ignored path) never reaches the
processor, as documented; `statfs` errors are per path and never thrown; the host callback is removed on shutdown;
the meter provider is created before the tracer provider and nothing else depends on the old order.
