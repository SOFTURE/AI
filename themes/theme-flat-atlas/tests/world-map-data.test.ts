import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { geoPath, geoProjection } from "d3-geo";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { describe, expect, it } from "vitest";

import { projectNaturalEarth2, projectToFit, projectToMapPercent, WORLD_COUNTRY_SHAPES, WORLD_MAP_FIT } from "../src/world-map.js";

const require = createRequire(import.meta.url);
const TOPOLOGY = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8")) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const COUNTRIES = feature(TOPOLOGY, TOPOLOGY.objects.countries).features;

// The projection the shapes were built with: the package's raw Natural Earth II, fitted by the build.
function buildD3Projection() {
  return geoProjection(projectNaturalEarth2).scale(WORLD_MAP_FIT.scale).translate([WORLD_MAP_FIT.translateX, WORLD_MAP_FIT.translateY]).precision(0.2);
}

const CITIES: readonly [string, number, number][] = [
  ["Lisbon", -9.1393, 38.7223],
  ["Warsaw", 21.0122, 52.2297],
  ["Bangkok", 100.5018, 13.7563],
  ["Reykjavik", -21.8174, 64.1265],
  ["Sydney", 151.2093, -33.8688],
];

describe("world map data", () => {
  it("leaves out Antarctica, keeps every other Natural Earth 1:110m country and adds French Guiana", () => {
    expect(WORLD_COUNTRY_SHAPES.some((shape) => shape.id === "010")).toBe(false);
    expect(WORLD_COUNTRY_SHAPES).toHaveLength(COUNTRIES.length);
  });

  it("draws French Guiana as its own shape, so a visited France leaves it unpainted", () => {
    const france = WORLD_COUNTRY_SHAPES.find((shape) => shape.id === "250");
    const guiana = WORLD_COUNTRY_SHAPES.find((shape) => shape.id === "254");
    const guianaPoint = projectToFit(WORLD_MAP_FIT, -53, 4);
    const startsOf = (d: string | undefined) => (d ?? "").split("M").filter(Boolean).map((part) => part.split("L")[0]?.split(",").map(Number) ?? []);
    const isNearGuiana = ([x, y]: number[]) => Math.abs((x ?? 0) - guianaPoint.x) < 15 && Math.abs((y ?? 0) - guianaPoint.y) < 15;
    expect(guiana?.name).toBe("French Guiana");
    expect(startsOf(guiana?.d).every(isNearGuiana)).toBe(true);
    expect(startsOf(france?.d).some(isNearGuiana)).toBe(false);
    expect(startsOf(france?.d).length).toBeGreaterThan(0);
  });

  it("keys countries by ISO 3166-1 numeric code, as world-atlas does", () => {
    expect(WORLD_COUNTRY_SHAPES.find((shape) => shape.id === "616")?.name).toBe("Poland");
    expect(WORLD_COUNTRY_SHAPES.find((shape) => shape.id === "620")?.name).toBe("Portugal");
  });

  it("holds the paths d3 draws with the stored fit, so the file matches its generator", () => {
    const path = geoPath(buildD3Projection()).digits(1);
    for (const id of ["616", "764", "352"]) {
      const country = COUNTRIES.find((candidate) => candidate.id === id);
      expect([id, WORLD_COUNTRY_SHAPES.find((shape) => shape.id === id)?.d]).toEqual([id, country === undefined ? undefined : path(country)]);
    }
  });

  it.each(CITIES)("places %s where d3 places it", (_name, longitude, latitude) => {
    const expected = buildD3Projection()([longitude, latitude]);
    const actual = projectToFit(WORLD_MAP_FIT, longitude, latitude);
    expect(actual.x).toBeCloseTo(expected?.[0] ?? Number.NaN, 6);
    expect(actual.y).toBeCloseTo(expected?.[1] ?? Number.NaN, 6);
  });

  it("gives pin positions in percent of the map, inside it", () => {
    for (const [, longitude, latitude] of CITIES) {
      const position = projectToMapPercent(longitude, latitude);
      expect(position.x).toBeGreaterThan(0);
      expect(position.x).toBeLessThan(100);
      expect(position.y).toBeGreaterThan(0);
      expect(position.y).toBeLessThan(100);
    }
    const lisbon = projectToMapPercent(-9.1393, 38.7223);
    expect([Math.round(lisbon.x), Math.round(lisbon.y)]).toEqual([48, 32]);
  });

  it("projects the origin to the centre column", () => {
    expect(projectToFit(WORLD_MAP_FIT, 0, 0)).toEqual({ x: WORLD_MAP_FIT.translateX, y: WORLD_MAP_FIT.translateY });
  });
});
