// The Next.js adapter of @softure-ai/agent-ready: route handlers ready to mount (README §4), plus the `Link` header
// rule for `next.config.ts`.
export {
  createAgentReadyRoutes,
  serveA2aAgentCard,
  serveAgentSkill,
  serveAgentSkillsIndex,
  serveAiCatalog,
  serveApiCatalog,
  serveAuthMd,
  serveJwks,
  serveMcpServerCard,
  serveOpenApi,
  serveSignatureDirectory,
  type AgentReadyRoutes,
  type AgentReadyRoutesOptions,
} from "./routes.js";
export { createIssuerRequest } from "./documents.js";
export { nextHeaders, type NextHeaderRule } from "../link-header.js";
