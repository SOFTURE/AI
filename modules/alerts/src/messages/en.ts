export const en = {
  severity: {
    info: "Info",
    warning: "Warning",
    critical: "Critical",
  },
  tag: {
    fired: "{severity}",
    repeated: "{severity}, still happening",
    resolved: "Resolved",
    test: "Test",
  },
  repeats: {
    one: "Happened 1 more time since the last message.",
    other: "Happened {count} more times since the last message.",
  },
  open: "Open",
  test: {
    title: "Test alert from softure-alerts",
    details: "If you can read this, the {channel} channel delivers alerts.",
  },
  jobs: {
    failedTitle: "A job failed on queue {queue}",
    failedDetails: "Job {jobId} ended failed after {attempts} attempts with {code}.",
    scheduleTitle: {
      failing: "Schedule {queue} is failing",
      late: "Schedule {queue} is late",
    },
    scheduleDetails: "Last failure: {code}.",
    pausedTitle: "Queue {queue} is paused",
    pausedDetails: "Paused with {code} until {until}.",
    pausedDetailsOpenEnded: "Paused with {code} until an operator resumes it.",
  },
  health: {
    title: "Health check {name} is {state}",
  },
  page: {
    title: "Alerts",
    lead: "Recent alerts, newest first. A firing alert counts its repeats instead of sending each one.",
    empty: "No alerts yet.",
    status: {
      firing: "Firing",
      resolved: "Resolved",
    },
    occurrences: "Occurrences: {count}",
    pendingRepeats: "Not yet reported: {count}",
    lastSeen: "Last seen: {at}",
    resolvedAt: "Resolved: {at}",
    key: "Key: {key}",
  },
  errors: {
    "alerts.invalid_input": "The alert is not valid.",
    "alerts.unknown_channel": "No channel has this name.",
    "alerts.channel_unconfigured": "The channel has no address or token configured.",
    "alerts.channel_refused": "The channel refused the message.",
    "alerts.channel_rate_limited": "The channel asked to wait before the next message.",
    "alerts.channel_unavailable": "The channel could not be reached.",
  },
};
