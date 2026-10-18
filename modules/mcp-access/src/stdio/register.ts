// `node --import @softure-ai/mcp-access/stdio/register` (or `tsx --import …`): resolves `server-only` the way Next
// does, through its `react-server` condition, to the installed package's empty file, so an MCP server factory written
// for Next (which marks its files with `import "server-only"`) runs in a plain Node process. The result is a real
// file, so a CommonJS `require` loads it as well as an ES `import`. Nothing else is resolved differently; unlike
// `--conditions=react-server`, React keeps its regular build.
import { registerHooks } from "node:module";

// Only when `server-only` is not installed next to the importer: an ES import still loads this.
const EMPTY_MODULE = "data:text/javascript,export%20%7B%7D%3B";

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier !== "server-only") return nextResolve(specifier, context);
    try {
      return nextResolve(specifier, { ...context, conditions: [...context.conditions, "react-server"] });
    } catch {
      return { url: EMPTY_MODULE, format: "module", shortCircuit: true };
    }
  },
});
