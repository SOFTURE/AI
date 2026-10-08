// Classes no ui component writes any more but other @softure-ai packages do. `styles.css` is compiled from the
// classes found in this directory, so a class dropped from every component would vanish from the stylesheet and
// break a released package that still writes it. Remove one only when no package uses it.
export const RETAINED_CLASSES = [
  // modules/billing `PricingTiles` price row (the Field and Switch label rows used it until 0.1.14).
  "sft:items-baseline",
] as const;
