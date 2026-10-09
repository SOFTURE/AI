// What `init` reads from the app instead of asking: package.json and a few files of the tree.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { readComposeFacts, type ComposeFacts } from "./compose-facts.js";

/** The production compose file `init` writes, and reads when the app already has one. */
export const COMPOSE_FILE = "docker/prod/docker-compose.yml";

const NEXT_CONFIG_FILES = ["next.config.ts", "next.config.mts", "next.config.js", "next.config.mjs"];
const SERVER_EXTERNAL_LIST = /serverExternalPackages\s*:\s*\[([^\]]*)\]/;
const DB_PACKAGE_LITERAL = /(["'`])@softure-ai\/db\1/;

const packageJsonSchema = z.looseObject({
  name: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

export interface AppFacts {
  packageName: string | undefined;
  /** `@softure-ai/db` is a dependency: Postgres, the migrate step and the database steps of `deploy.sh`. */
  hasDatabase: boolean;
  /** `@softure-ai/ops` is a dependency: `/api/health` answers with the database and module checks. */
  hasHealthRoute: boolean;
  /** A `public/` folder, copied into the image next to the standalone server. */
  hasPublicDir: boolean;
  /** The Next config file, or null when the app has none. */
  nextConfigFile: string | null;
  /** The Next config mentions `standalone`, which the Dockerfile's runner stage needs. */
  isStandalone: boolean;
  /**
   * The Next config names `@softure-ai/db` in `serverExternalPackages`, without which `next build` cannot resolve the
   * driver the app does not install. Absent (facts built by hand) means not checked.
   */
  isDbServerExternal?: boolean;
  /**
   * What the app's own `docker/prod/docker-compose.yml` names for `deploy.sh`; null when the app has none. Absent
   * (facts built by hand) means not read. Either way the defaults apply.
   */
  compose?: ComposeFacts | null;
}

export type AppFactsResult = { ok: true; facts: AppFacts } | { ok: false; problem: string };

function readPackageJson(dir: string): z.infer<typeof packageJsonSchema> | string {
  let text: string;
  try {
    text = readFileSync(join(dir, "package.json"), "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? "unknown error";
    return `cannot read package.json in ${dir} (${code}); run init in the app's folder or pass --dir`;
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return "package.json is not valid JSON";
  }
  const parsed = packageJsonSchema.safeParse(json);
  return parsed.success ? parsed.data : "package.json has no object of name and dependencies";
}

/**
 * Whether the config text names `@softure-ai/db` as a quoted entry of `serverExternalPackages`: inside the literal
 * array when there is one, else anywhere in a file that sets the key from a variable.
 */
function isDbListedAsServerExternal(configText: string): boolean {
  const literalList = SERVER_EXTERNAL_LIST.exec(configText);
  if (literalList !== null) return DB_PACKAGE_LITERAL.test(literalList[1] ?? "");
  return configText.includes("serverExternalPackages") && DB_PACKAGE_LITERAL.test(configText);
}

/** Reads the facts `init` takes from the app; an unreadable package.json is an expected failure. */
export function readAppFacts(dir: string): AppFactsResult {
  const pkg = readPackageJson(dir);
  if (typeof pkg === "string") return { ok: false, problem: pkg };
  const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
  const nextConfigFile = NEXT_CONFIG_FILES.find((file) => existsSync(join(dir, file))) ?? null;
  const configText = nextConfigFile === null ? "" : readFileSync(join(dir, nextConfigFile), "utf8");
  const publicDir = join(dir, "public");
  const composeFile = join(dir, COMPOSE_FILE);
  return {
    ok: true,
    facts: {
      packageName: pkg.name,
      hasDatabase: "@softure-ai/db" in dependencies,
      hasHealthRoute: "@softure-ai/ops" in dependencies,
      hasPublicDir: existsSync(publicDir) && statSync(publicDir).isDirectory(),
      nextConfigFile,
      isStandalone: configText.includes("standalone"),
      isDbServerExternal: isDbListedAsServerExternal(configText),
      compose: existsSync(composeFile) ? readComposeFacts(readFileSync(composeFile, "utf8")) : null,
    },
  };
}
