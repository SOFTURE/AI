// The world map: the component, the projected Natural Earth 1:110m shapes (about 160 KB of path data) and the
// projection for pins. A separate entry, so a page without the map does not load the shapes.
export { WorldMap, type WorldMapPlace, type WorldMapProps } from "./atlas/WorldMap.js";
export { projectToMapPercent, type MapPercent } from "./map/map-position.js";
export { projectNaturalEarth2, projectToFit, type MapFit, type MapPoint } from "./map/projection.js";
export { WORLD_COUNTRY_SHAPES, WORLD_GRATICULE_PATH, WORLD_MAP_FIT, WORLD_MAP_VIEWBOX, type CountryShape } from "./map/world-110m.js";
