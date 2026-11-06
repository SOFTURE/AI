import { ArrowRight, BookOpen, Calendar, Camera, Compass, Globe, MapPin, Menu, PenLine, Plane, ShoppingBag, Users, X, type LucideIcon } from "lucide-react";

/**
 * The design system's travel icons, from lucide (the same 24 grid, 2 px stroke and round caps as the design system's
 * own set): the map and the trip, the future navigation (blog, about us, e-book, shop) and the actions. An icon
 * stands only where it replaces a word; its name comes from the text beside it or an `aria-label`.
 */
export const ATLAS_ICONS = {
  pin: MapPin,
  globe: Globe,
  plane: Plane,
  compass: Compass,
  calendar: Calendar,
  camera: Camera,
  pen: PenLine,
  users: Users,
  book: BookOpen,
  bag: ShoppingBag,
  "arrow-right": ArrowRight,
  menu: Menu,
  close: X,
} as const satisfies Record<string, LucideIcon>;

export type AtlasIconName = keyof typeof ATLAS_ICONS;

/** The stroke every icon is drawn with. */
export const ATLAS_ICON_STROKE_WIDTH = 2;
