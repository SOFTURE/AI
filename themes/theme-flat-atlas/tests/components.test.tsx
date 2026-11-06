import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ATLAS_ICONS,
  Button,
  Card,
  CountryChip,
  CountryCounter,
  IconButton,
  MapLegend,
  MapPin,
  MapPinCluster,
  MapPopover,
  Photo,
  Postcard,
  PostcardStamp,
  SiteHeader,
  WORLD_COUNTRY_TOTAL,
  Wordmark,
  formatCoordinates,
  getButtonLook,
  getShare,
} from "../src/index.js";
import { WorldMap, WORLD_COUNTRY_SHAPES } from "../src/world-map.js";

function getClasses(markup: string, dataSlot: string): string[] {
  const match = new RegExp(`data-slot="${dataSlot}"[^>]*class="([^"]*)"`).exec(markup);
  return (match?.[1] ?? "").split(" ");
}

describe("Button and IconButton", () => {
  it("is a secondary md button of type button by default", () => {
    const markup = renderToStaticMarkup(<Button>See the countries</Button>);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-variant="secondary"');
    expect(getClasses(markup, "button")).toEqual(expect.arrayContaining(["h-control-md", "border-line-strong", "text-label"]));
  });

  it("takes its size from the size and its colours from the variant", () => {
    const markup = renderToStaticMarkup(
      <Button size="lg" variant="primary" type="submit">
        Read the blog
      </Button>,
    );
    expect(markup).toContain('type="submit"');
    expect(getClasses(markup, "button")).toEqual(expect.arrayContaining(["h-control-lg", "px-6", "bg-accent-fill", "text-on-accent"]));
    expect(getClasses(markup, "button")).not.toContain("h-control-md");
  });

  it("gives a link the same look as a button", () => {
    expect(getButtonLook("sm", "ink").split(" ")).toEqual(expect.arrayContaining(["h-control-sm", "bg-ink", "text-paper", "rounded-control"]));
  });

  it("names an icon button by its aria-label and outlines it on request", () => {
    const markup = renderToStaticMarkup(<IconButton aria-label="Menu" isBordered />);
    expect(markup).toContain('aria-label="Menu"');
    expect(getClasses(markup, "icon-button")).toEqual(expect.arrayContaining(["size-control-md", "border-line-strong"]));
  });
});

describe("SiteHeader and Wordmark", () => {
  it("is transparent over the map and solid with a hairline below on subpages", () => {
    const brand = <Wordmark href="/" name="Example" suffix=".com" mark={<img src="/logo.svg" alt="" />} />;
    expect(getClasses(renderToStaticMarkup(<SiteHeader brand={brand} />), "site-header")).toContain("bg-transparent");
    const solid = renderToStaticMarkup(<SiteHeader brand={brand} variant="solid" />);
    expect(getClasses(solid, "site-header")).toEqual(expect.arrayContaining(["h-header", "border-b", "bg-background"]));
    expect(solid).toContain('<a href="/" data-slot="wordmark"');
    expect(solid).toContain('<span>Example<span class="text-muted">.com</span></span>');
  });
});

describe("CountryCounter", () => {
  const markup = renderToStaticMarkup(
    <CountryCounter
      value={12}
      total={WORLD_COUNTRY_TOTAL}
      unit="countries"
      totalLabel="of 195 in the world"
      label="We have been to 12 countries out of 195"
      parts={[
        { key: "europe", label: "Europe", value: 12 },
        { key: "plan", label: "planned", value: 5 },
      ]}
    />,
  );

  it("names the whole counter and fills the bar by scaleX, never by width", () => {
    expect(markup).toContain('role="group" aria-label="We have been to 12 countries out of 195"');
    expect(markup).toContain(`transform:scaleX(${String(12 / 195)})`);
    expect(markup).not.toContain("width:");
  });

  it("draws the number on the hero step from md up, untracked", () => {
    expect(getClasses(markup, "country-counter-value")).toEqual(expect.arrayContaining(["num", "font-display", "text-display", "md:text-hero", "tracking-normal"]));
  });

  it("lists the split with each value in the foreground", () => {
    expect(markup).toContain('Europe <b class="num font-bold text-foreground">12</b>');
  });

  it("stays on the display step at size sm and leaves out an empty split", () => {
    const small = renderToStaticMarkup(<CountryCounter value={0} total={195} unit="u" totalLabel="t" label="l" size="sm" parts={[]} />);
    expect(getClasses(small, "country-counter-value")).not.toContain("md:text-hero");
    expect(small).not.toContain("<ul");
    expect(small).toContain("transform:scaleX(0)");
  });
});

describe("getShare and formatCoordinates", () => {
  it("clamps the share to 0..1 and answers 0 for a total that is not positive", () => {
    expect([getShare(12, 195), getShare(300, 195), getShare(-1, 195), getShare(5, 0), getShare(5, Number.NaN)]).toEqual([12 / 195, 1, 0, 0, 0]);
  });

  it("writes coordinates with hemispheres", () => {
    expect(formatCoordinates(38.7223, -9.1393)).toBe("38.7223° N, 9.1393° W");
    expect(formatCoordinates(-33.8688, 151.2093, 2)).toBe("33.87° S, 151.21° E");
    expect(formatCoordinates(0, 0, 1)).toBe("0.0° N, 0.0° E");
  });
});

describe("CountryChip", () => {
  it("puts the ISO code on the stamp ink for a visited country", () => {
    const markup = renderToStaticMarkup(<CountryChip code="PT" name="Portugal" />);
    expect(markup).toContain('data-status="visited"');
    expect(markup).toContain("bg-accent-fill text-on-accent");
    expect(markup).toMatch(/>PT<\/span>Portugal<\/span>$/);
  });

  it("draws a planned country in a dashed passport-blue outline", () => {
    const markup = renderToStaticMarkup(<CountryChip code="TH" name="Thailand" status="planned" />);
    expect(getClasses(markup, "country-chip")).toEqual(expect.arrayContaining(["border-dashed", "border-planned"]));
    expect(markup).toContain("text-planned");
  });
});

describe("MapPin", () => {
  it("is a named button at its position, the flag hidden until hover or focus", () => {
    const markup = renderToStaticMarkup(<MapPin x={47.6} y={31.8} label="Lisbon, Portugal, May 2024" tag={{ name: "Lisbon", detail: "2024" }} />);
    expect(markup).toContain('style="left:47.6%;top:31.8%"');
    expect(markup).toContain('<button type="button" aria-label="Lisbon, Portugal, May 2024"');
    expect(getClasses(markup, "map-pin-tag")).toEqual(expect.arrayContaining(["opacity-0", "peer-hover:opacity-100", "peer-focus-visible:opacity-100", "bg-accent-fill"]));
    expect(markup).toContain("bg-place");
  });

  it("shows the flag of a selected pin and draws a planned one dashed", () => {
    const markup = renderToStaticMarkup(<MapPin x={1} y={2} label="Bangkok, planned" status="planned" tag={{ name: "Bangkok" }} isSelected />);
    expect(markup).toContain('aria-expanded="true"');
    expect(getClasses(markup, "map-pin-tag")).toContain("opacity-100");
    expect(markup).toContain("border-dashed border-planned bg-background");
    expect(markup).not.toContain("<small");
  });

  it("merges dense pins into a numbered cluster", () => {
    const markup = renderToStaticMarkup(<MapPinCluster x={50} y={25} count={5} label="5 places in Europe" />);
    expect(markup).toContain('aria-label="5 places in Europe"');
    expect(markup).toContain(">5</span>");
  });
});

describe("MapPopover and MapLegend", () => {
  it("shows the place, the meta in muted and the coordinates in mono", () => {
    const markup = renderToStaticMarkup(<MapPopover place="Lisbon" meta={["Portugal", "May 2024"]} coordinates={formatCoordinates(38.7223, -9.1393)} />);
    expect(markup).toContain('<p class="m-0 font-display text-place-name">Lisbon</p>');
    expect(markup).toContain("<span>Portugal</span><span>May 2024</span>");
    expect(markup).toContain('<p class="m-0 font-mono text-coord text-muted">38.7223° N, 9.1393° W</p>');
  });

  it("gives every legend entry its swatch", () => {
    const markup = renderToStaticMarkup(
      <MapLegend
        items={[
          { kind: "visited", label: "visited" },
          { kind: "place", label: "place" },
          { kind: "planned", label: "planned" },
          { kind: "land", label: "not yet" },
        ]}
      />,
    );
    for (const swatch of ["bg-visited", "bg-place", "border-dashed border-planned", "bg-map-land"]) expect(markup).toContain(swatch);
  });
});

describe("Card, Photo and Postcard", () => {
  it("draws a postcard as a card with its title, meta and postmark", () => {
    const markup = renderToStaticMarkup(
      <Postcard
        title="Three weeks in Lisbon"
        meta={["Portugal", "May 2024"]}
        photo={<Photo>photo 4:3</Photo>}
        stamp={<PostcardStamp year={2024} code="PT" />}
        headingLevel="h2"
      />,
    );
    expect(markup.startsWith('<article data-slot="postcard"')).toBe(true);
    expect(markup).toContain('<h2 class="m-0 font-display text-subsection">Three weeks in Lisbon</h2>');
    expect(getClasses(markup, "photo")).toEqual(expect.arrayContaining(["aspect-4/3", "rounded-photo"]));
    expect(getClasses(markup, "postcard-stamp")).toEqual(expect.arrayContaining(["-rotate-8", "border-visited", "outline-visited"]));
    expect(markup).toContain(">2024</b>PT</div>");
  });

  it("dashes the rings of a planned postmark and keeps a plain card flat", () => {
    expect(getClasses(renderToStaticMarkup(<PostcardStamp year={2026} code="TH" status="planned" />), "postcard-stamp")).toEqual(
      expect.arrayContaining(["border-dashed", "outline-dashed", "outline-planned"]),
    );
    const card = getClasses(renderToStaticMarkup(<Card>text</Card>), "card");
    expect(card).toEqual(expect.arrayContaining(["bg-surface", "border-border", "rounded-card"]));
    expect(card.some((name) => name.startsWith("shadow"))).toBe(false);
  });
});

describe("WorldMap", () => {
  const markup = renderToStaticMarkup(
    <WorldMap
      label="World map with the countries we have been to"
      countries={{ "616": "visited", "764": "planned" }}
      places={[
        { key: "lisbon", longitude: -9.1393, latitude: 38.7223, status: "visited", label: "Lisbon, Portugal, May 2024" },
        { key: "bangkok", longitude: 100.5018, latitude: 13.7563, status: "planned", label: "Bangkok, planned" },
      ]}
      selectedPlaceKey="lisbon"
    />,
  );

  it("draws every country once, painting the visited one and outlining the planned one", () => {
    expect(markup.match(/<path d="M/g)?.length).toBe(WORLD_COUNTRY_SHAPES.length + 1);
    expect(markup).toMatch(/data-id="616" data-status="visited" class="[^"]*fill-visited/);
    expect(markup).toMatch(/data-id="764" data-status="planned" class="[^"]*stroke-planned/);
    expect(markup).toMatch(/data-id="620" class="[^"]*fill-map-land/);
  });

  it("is a named image that scrolls sideways inside its own container on a phone", () => {
    expect(markup).toContain('role="img" aria-label="World map with the countries we have been to"');
    expect(getClasses(markup, "world-map")).toContain("overflow-x-auto");
    expect(markup).toContain("min-w-map-min");
  });

  it("places the pins in the given order, the selected one expanded", () => {
    const labels = [...markup.matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]).slice(1);
    expect(labels).toEqual(["Lisbon, Portugal, May 2024", "Bangkok, planned"]);
    expect(markup).toContain('aria-label="Lisbon, Portugal, May 2024" aria-expanded="true"');
    expect(markup).toContain('aria-label="Bangkok, planned" aria-expanded="false"');
  });

  it("leaves out the graticule on request", () => {
    const plain = renderToStaticMarkup(<WorldMap label="map" countries={{}} hasGraticule={false} />);
    expect(plain.match(/<path d="M/g)?.length).toBe(WORLD_COUNTRY_SHAPES.length);
  });
});

describe("ATLAS_ICONS", () => {
  it("holds the thirteen travel icons", () => {
    expect(Object.keys(ATLAS_ICONS)).toEqual(["pin", "globe", "plane", "compass", "calendar", "camera", "pen", "users", "book", "bag", "arrow-right", "menu", "close"]);
  });
});
