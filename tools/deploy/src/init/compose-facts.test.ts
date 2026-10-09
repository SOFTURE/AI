import { describe, expect, it } from "vitest";
import { readComposeFacts } from "./compose-facts.js";
import { DEFAULT_APP_ROLE, planInitFiles, TEMPLATE_VERSIONS } from "./generate.js";

function compose(postgresImage: string, appEnvironment: string): string {
  return [
    "name: fire-tracker",
    "",
    "services:",
    "  app:",
    "    image: ghcr.io/acme/fire:${TAG}",
    "    environment:",
    appEnvironment,
    "  postgres:",
    `    image: ${postgresImage}`,
    "    environment:",
    "      POSTGRES_DB: fire_tracker",
    "",
    "volumes:",
    "  postgres-data:",
    "",
  ].join("\n");
}

const FIRE_URL = "      DATABASE_URL: postgresql://fire_tracker_app:${FIRE_APP_PASSWORD:?}@postgres:5432/fire_tracker";

describe("readComposeFacts", () => {
  it("reads the compose file init writes", () => {
    const files = planInitFiles({
      answers: { domain: "example.com", image: "ghcr.io/acme/shop", name: "shop", paths: ["/"], www: false, env: [], tables: [] },
      facts: { packageName: "shop", hasDatabase: true, hasHealthRoute: true, hasPublicDir: false, nextConfigFile: null, isStandalone: true },
      cliVersion: "9.9.9",
    });
    const text = files.find((file) => file.path === "docker/prod/docker-compose.yml")?.text ?? "";
    expect(readComposeFacts(text)).toEqual({ postgresMajor: TEMPLATE_VERSIONS.postgres, appDatabaseRole: DEFAULT_APP_ROLE });
  });

  it("reads an adopting app's Postgres 17 and its own role", () => {
    expect(readComposeFacts(compose("postgres:17-alpine", FIRE_URL))).toEqual({
      postgresMajor: "17",
      appDatabaseRole: "fire_tracker_app",
    });
  });

  it("reads a quoted image with a registry, a minor version and a list-form environment", () => {
    const list = '      - "DATABASE_URL=postgres://shop_app:${PASSWORD:?}@postgres:5432/shop"';
    expect(readComposeFacts(compose('"docker.io/library/postgres:18.1"', list))).toEqual({
      postgresMajor: "18",
      appDatabaseRole: "shop_app",
    });
  });

  it("reads the major of an extension image's tag", () => {
    expect(readComposeFacts(compose("pgvector/pgvector:pg17", FIRE_URL)).postgresMajor).toBe("17");
    expect(readComposeFacts(compose("postgis/postgis:17-3.5-alpine", FIRE_URL)).postgresMajor).toBe("17");
  });

  it("gives null for an image without a readable major", () => {
    expect(readComposeFacts(compose("postgres", FIRE_URL)).postgresMajor).toBeNull();
    expect(readComposeFacts(compose("postgres:latest", FIRE_URL)).postgresMajor).toBeNull();
    expect(readComposeFacts(compose("${POSTGRES_IMAGE:?}", FIRE_URL)).postgresMajor).toBeNull();
    expect(readComposeFacts(compose("localhost:5000/postgres", FIRE_URL)).postgresMajor).toBeNull();
  });

  it("gives null for a role that is a variable, encoded or missing", () => {
    const variable = "      DATABASE_URL: postgresql://${DB_USER:?}:${DB_PASSWORD:?}@postgres:5432/fire";
    const encoded = "      DATABASE_URL: postgresql://fire%2Dapp:secret@postgres:5432/fire";
    const none = "      APP_ORIGIN: https://example.com";
    expect(readComposeFacts(compose("postgres:17", variable)).appDatabaseRole).toBeNull();
    expect(readComposeFacts(compose("postgres:17", encoded)).appDatabaseRole).toBeNull();
    expect(readComposeFacts(compose("postgres:17", none)).appDatabaseRole).toBeNull();
  });

  it("reads only the app and postgres services, not the migrator's URL or another image", () => {
    const text = [
      "services:",
      "  migrate:",
      "    image: postgres:15",
      "    environment:",
      "      DATABASE_URL: postgresql://softure_migrator:${PASSWORD:?}@postgres:5432/shop",
      "  web:",
      "    environment:",
      "      DATABASE_URL: postgresql://web_role:${PASSWORD:?}@postgres:5432/shop",
      "",
    ].join("\n");
    expect(readComposeFacts(text)).toEqual({ postgresMajor: null, appDatabaseRole: null });
  });

  it("gives nulls for an empty file", () => {
    expect(readComposeFacts("")).toEqual({ postgresMajor: null, appDatabaseRole: null });
  });
});
