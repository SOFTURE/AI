// Server-only logic: reading and writing the channel tag. Framework-free; `next/*` imports are not
// allowed here (ESLint `no-restricted-imports`, NFR-3).
export { hasChannelParam, isFirstParty, parseChannel, readChannel, withChannel, type ChannelSources } from "./channel.js";
export { getAnalyticsOptions, getChannelOptions } from "./options.js";
