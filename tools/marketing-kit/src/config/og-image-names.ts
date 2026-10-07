/** The files an `ogImages` entry writes under `<output.dir>/og/`, without `.png`: `<id>`, or `<id>-1`…`<id>-N` for a carousel. */
export function getOgImageNames(entry: { id: string; template: string; data: unknown }): string[] {
  if (entry.template !== "carousel") return [entry.id];
  const slides = (entry.data as { slides?: unknown } | null)?.slides;
  const count = Array.isArray(slides) ? slides.length : 0;
  return Array.from({ length: count }, (_, index) => `${entry.id}-${String(index + 1)}`);
}
