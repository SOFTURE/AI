import { describe, expect, it } from "vitest";
import { toLibpqEnv } from "./connection.js";

describe("toLibpqEnv", () => {
  it("splits a full URL into libpq variables, decoding escaped parts", () => {
    expect(toLibpqEnv("postgresql://app%40prod:p%2Fss%3Aword@db.internal:6543/shop_app?sslmode=require&application_name=deploy")).toEqual({
      ok: true,
      env: {
        PGHOST: "db.internal",
        PGPORT: "6543",
        PGUSER: "app@prod",
        PGPASSWORD: "p/ss:word",
        PGDATABASE: "shop_app",
        PGSSLMODE: "require",
        PGAPPNAME: "deploy",
      },
    });
  });

  it("leaves out the parts the URL does not have, so libpq uses its defaults", () => {
    expect(toLibpqEnv("postgres://db/app")).toEqual({ ok: true, env: { PGHOST: "db", PGDATABASE: "app" } });
  });

  it("strips the brackets of an IPv6 host", () => {
    expect(toLibpqEnv("postgres://[::1]:5433/app")).toEqual({ ok: true, env: { PGHOST: "::1", PGPORT: "5433", PGDATABASE: "app" } });
  });

  it("takes a socket folder from the host query parameter", () => {
    expect(toLibpqEnv("postgres:///app?host=/var/run/postgresql")).toEqual({
      ok: true,
      env: { PGDATABASE: "app", PGHOST: "/var/run/postgresql" },
    });
  });

  it("refuses another scheme and an unknown query parameter, never echoing the URL", () => {
    expect(toLibpqEnv("mysql://root:secret@db/app")).toEqual({
      ok: false,
      problem: "the database URL must start with postgres:// or postgresql://, not mysql://",
    });
    expect(toLibpqEnv("postgres://root:secret@db/app?options=-c%20x")).toEqual({
      ok: false,
      problem: "the database URL has a query parameter pg_dump cannot take: options",
    });
    expect(toLibpqEnv("not a url")).toEqual({ ok: false, problem: "the database URL is not a valid URL" });
  });
});
