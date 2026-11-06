/** Where a country or a place stands: we have been there, or it is in the plan. */
export type TravelStatus = "visited" | "planned";

/**
 * The number of countries in the world the counter measures against: the 193 United Nations member states and the
 * two observer states (the Holy See and Palestine).
 */
export const WORLD_COUNTRY_TOTAL = 195;

/** The share of a total, clamped to 0..1; 0 for a total that is not positive. */
export function getShare(value: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.min(1, Math.max(0, value / total));
}

/** Latitude and longitude in degrees as `38.7223° N, 9.1393° W`, for a popover or a postcard. */
export function formatCoordinates(latitude: number, longitude: number, digits = 4): string {
  const latitudeText = `${Math.abs(latitude).toFixed(digits)}° ${latitude < 0 ? "S" : "N"}`;
  const longitudeText = `${Math.abs(longitude).toFixed(digits)}° ${longitude < 0 ? "W" : "E"}`;
  return `${latitudeText}, ${longitudeText}`;
}
