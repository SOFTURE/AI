// What `init` reads from the app instead of asking: package.json and a few files of the tree.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const NEXT_CONFIG_FILES = ["next.config.ts", "next.config.mts", "next.config.js", "next.config.mjs"];

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

/** Reads the facts `init` takes from the app; an unreadable package.json is an expected failure. */
export function readAppFacts(dir: string): AppFactsResult {
  const pkg = readPackageJson(dir);
  if (typeof pkg === "string") return { ok: false, problem: pkg };
  const dependencies = { ...pkg.devDependencies, ...pkg.dependencies };
  const nextConfigFile = NEXT_CONFIG_FILES.find((file) => existsSync(join(dir, file))) ?? null;
  const publicDir = join(dir, "public");
  return {
    ok: true,
    facts: {
      packageName: pkg.name,
      hasDatabase: "@softure-ai/db" in dependencies,
      hasHealthRoute: "@softure-ai/ops" in dependencies,
      hasPublicDir: existsSync(publicDir) && statSync(publicDir).isDirectory(),
      nextConfigFile,
      isStandalone: nextConfigFile !== null && readFileSync(join(dir, nextConfigFile), "utf8").includes("standalone"),
    },
  };
}
