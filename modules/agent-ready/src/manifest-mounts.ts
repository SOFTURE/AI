// The files an app mounts, one per document; `module.json` lists them and the README shows each line.
export const AGENT_READY_MOUNTS = [
  { kind: "route-handler", path: "app/.well-known/api-catalog/route.ts", export: "serveApiCatalog" },
  { kind: "route-handler", path: "app/openapi.json/route.ts", export: "serveOpenApi" },
  { kind: "route-handler", path: "app/auth.md/route.ts", export: "serveAuthMd" },
  { kind: "route-handler", path: "app/.well-known/jwks.json/route.ts", export: "serveJwks" },
  { kind: "route-handler", path: "app/.well-known/mcp/server-card.json/route.ts", export: "serveMcpServerCard" },
  { kind: "route-handler", path: "app/.well-known/agent-card.json/route.ts", export: "serveA2aAgentCard" },
  { kind: "route-handler", path: "app/.well-known/agent-skills/index.json/route.ts", export: "serveAgentSkillsIndex" },
  { kind: "route-handler", path: "app/.well-known/agent-skills/[name]/SKILL.md/route.ts", export: "serveAgentSkill" },
  { kind: "route-handler", path: "app/.well-known/ai-catalog.json/route.ts", export: "serveAiCatalog" },
  { kind: "route-handler", path: "app/.well-known/http-message-signatures-directory/route.ts", export: "serveSignatureDirectory" },
] as const;
