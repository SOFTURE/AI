# Plan review: observability-host-and-request-metrics

Verdict: approve (auto). Findings, all accepted: count only root server spans (Next.js nests none today, but a child
server span would double count); keep the route, never the path, so series stay bounded; record the metric when
trace export is off too, since the processor is the only source; a new default gauge set is a minor release.
