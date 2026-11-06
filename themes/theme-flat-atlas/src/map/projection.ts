/**
 * The Natural Earth II projection (Savric, Jenny, Patterson, Hurni 2015), the raw form d3-geo-projection names
 * `geoNaturalEarth2Raw`: longitude and latitude in radians to unscaled plane coordinates (y grows north).
 */
export function projectNaturalEarth2(lambda: number, phi: number): [number, number] {
  const phi2 = phi * phi;
  const phi4 = phi2 * phi2;
  const phi6 = phi2 * phi4;
  return [
    lambda * (0.84719 - 0.13063 * phi2 + phi6 * phi6 * (-0.04515 + 0.05494 * phi2 - 0.02326 * phi4 + 0.00331 * phi6)),
    phi * (1.01183 + phi4 * phi4 * (-0.02625 + 0.01922 * phi2 - 0.00396 * phi4)),
  ];
}

/** Scale and translation that place the raw projection in the map's viewBox, as the build fitted them. */
export interface MapFit {
  readonly scale: number;
  readonly translateX: number;
  readonly translateY: number;
}

/** A point in the map's viewBox units. */
export interface MapPoint {
  readonly x: number;
  readonly y: number;
}

const DEGREES = Math.PI / 180;

/** Longitude and latitude in degrees to a point in the viewBox, the same transform d3-geo applies to the shapes. */
export function projectToFit(fit: MapFit, longitude: number, latitude: number): MapPoint {
  const [x, y] = projectNaturalEarth2(longitude * DEGREES, latitude * DEGREES);
  return { x: fit.translateX + fit.scale * x, y: fit.translateY - fit.scale * y };
}
