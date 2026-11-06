// The Flat Atlas theme: tokens, cn and the components of the design system. The world map and its shapes are a
// separate entry, `@softure-ai/theme-flat-atlas/world-map`. The stylesheets are `/theme.css` and `/page.css`.
export { FLAT_ATLAS_THEME, theme } from "./tokens.js";
export { cn } from "./lib/utils.js";

export {
  BUTTON_SIZE_LOOK,
  BUTTON_VARIANT_LOOK,
  ICON_BUTTON_BORDERED_LOOK,
  ICON_BUTTON_LOOK,
  WORDMARK_LOOK,
  getButtonLook,
  type ButtonSize,
  type ButtonVariant,
} from "./atlas/button-look.js";
export { Button, IconButton, type ButtonProps, type IconButtonProps } from "./atlas/Button.js";
export { Card, Photo, Postcard, PostcardStamp, type PhotoProps, type PostcardProps, type PostcardStampProps } from "./atlas/Card.js";
export { CountryChip, type CountryChipProps } from "./atlas/CountryChip.js";
export { CountryCounter, type CountryCounterPart, type CountryCounterProps } from "./atlas/CountryCounter.js";
export { ATLAS_ICON_STROKE_WIDTH, ATLAS_ICONS, type AtlasIconName } from "./atlas/icons.js";
export { MapLegend, type MapLegendItem, type MapLegendKind, type MapLegendProps } from "./atlas/MapLegend.js";
export { MapPin, MapPinCluster, type MapPinClusterProps, type MapPinProps, type MapPinTag } from "./atlas/MapPin.js";
export { MapPopover, type MapPopoverProps } from "./atlas/MapPopover.js";
export { SiteHeader, Wordmark, type SiteHeaderProps, type SiteHeaderVariant, type WordmarkProps } from "./atlas/SiteHeader.js";
export { WORLD_COUNTRY_TOTAL, formatCoordinates, getShare, type TravelStatus } from "./atlas/status.js";
