// `node --import @softure-ai/mcp-access/stdio/register` (or `tsx --import …`): resolves `server-only` to
// an empty module, so an MCP server factory written for Next (which marks its files with
// `import "server-only"`) runs in a plain Node process. Nothing else is resolved differently; unlike
// `--conditions=react-server`, React keeps its regular build.
import { registerHooks } from "node:module";

const EMPTY_MODULE = "data:text/javascript,export%20%7B%7D%3B";

registerHooks({
  resolve: (specifier, context, nextResolve) => (specifier === "server-only" ? { url: EMPTY_MODULE, format: "module", shortCircuit: true } : nextResolve(specifier, context)),
});
