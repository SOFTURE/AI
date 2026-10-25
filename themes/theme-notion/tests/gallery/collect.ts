/** A rendered element's place in the parity fixture: its slot (or the case root's tag) and its classes. */
export type SlotClasses = readonly [slot: string, classes: string];

/**
 * The `data-slot` elements under `container` (the case root first when it has none), in document order, each with
 * its class attribute; elements with neither a slot nor a class are left out.
 */
export function collectSlots(container: ParentNode): SlotClasses[] {
  return [...container.querySelectorAll("[data-slot]")].map((element) => [element.getAttribute("data-slot") ?? "", element.getAttribute("class") ?? ""] as const);
}

/** Every class name in a set of collected slots, once. */
export function collectClassNames(slots: Iterable<SlotClasses>): Set<string> {
  const names = new Set<string>();
  for (const [, classes] of slots) for (const name of classes.split(/\s+/)) if (name !== "") names.add(name);
  return names;
}
