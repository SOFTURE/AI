import { projectToFit } from "./projection.js";
import { WORLD_MAP_FIT, WORLD_MAP_VIEWBOX } from "./world-110m.js";

/** A position on the map in percent of its width and height, what `MapPin` takes. */
export interface MapPercent {
  readonly x: number;
  readonly y: number;
}

/** Longitude and latitude in degrees to a position on `WorldMap`, in percent: the projection the shapes were built with. */
export function projectToMapPercent(longitude: number, latitude: number): MapPercent {
  const point = projectToFit(WORLD_MAP_FIT, longitude, latitude);
  return { x: (point.x / WORLD_MAP_VIEWBOX.width) * 100, y: (point.y / WORLD_MAP_VIEWBOX.height) * 100 };
}
