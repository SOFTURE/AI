# Implementation review: mcp-access-server-info-messages-1117

Verdict: approved.

- No `en.serverInfoTool` read is left in `server-info.ts`; the dictionary is chosen once at registration, so the
  recorded and the served server describe the tool alike and the measured version stays consistent.
- Without `config` every string is the English one, byte for byte, so no app's tool list version changes on upgrade.
- An explicit `description` still wins; a partial override keeps English for the other keys (tested).
- The changelog corrects the 0.7.0 "Migrate" line and documents the new option; README updated. English only.
