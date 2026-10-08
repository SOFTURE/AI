// GET /.well-known/oauth-protected-resource/api/mcp: the endpoint's own resource metadata, the
// URL its 401 names in resource_metadata.
export { answerOAuthPreflight as OPTIONS, getProtectedResourceMetadataRoute as GET } from "@softure-ai/mcp-access/next";
