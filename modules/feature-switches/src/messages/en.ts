export const en = {
  panel: {
    title: "Feature switches",
    lead: "Turn features on and off for everyone. A change applies from the next request.",
    empty: "The app declares no switches.",
    on: "On",
    off: "Off",
  },
  source: {
    env: "Set by the environment variable {envName}. Change it there.",
    stored: "Changed on {date}.",
    default: "Default value; never changed.",
    failMode: "The stored value could not be read, so the switch shows its fail-safe value.",
  },
  errors: {
    "feature-switches": {
      unknown_switch: "This switch is no longer declared. Reload the page.",
    },
    auth: {
      forbidden: "You do not have access to this.",
    },
    core: {
      database_failed: "Something went wrong on our side. Try again in a moment.",
      unexpected: "Something went wrong on our side. Try again in a moment.",
    },
  },
};
