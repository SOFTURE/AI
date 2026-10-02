/** Slot class names a component accepts: one optional class per named part. */
export type ClassNames<Slot extends string> = Partial<Readonly<Record<Slot, string>>>;

/**
 * The class of one slot: the component default plus the app's class, or only the app's class when
 * the component is `unstyled`. App classes win without `!important`, because the defaults sit in
 * `@layer softure`.
 */
export function getSlotClass<Slot extends string>(options: {
  slot: Slot;
  defaults: Readonly<Record<Slot, string>>;
  classNames: ClassNames<Slot> | undefined;
  unstyled: boolean | undefined;
}): string | undefined {
  const custom = options.classNames?.[options.slot];
  const parts = options.unstyled ? [custom] : [options.defaults[options.slot], custom];
  const joined = parts.filter((part) => part !== undefined && part !== "").join(" ");
  return joined === "" ? undefined : joined;
}
