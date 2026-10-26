import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { GALLERY_CASES, type GalleryCase } from "../tests/gallery/cases.js";

/** The case named in the address (`#case=<name>`), or null for the gallery of every inline case. */
function findRequestedCase(hash: string): GalleryCase | null {
  const name = new URLSearchParams(hash.replace(/^#/, "")).get("case");
  return GALLERY_CASES.find((galleryCase) => galleryCase.name === name) ?? null;
}

function Gallery() {
  const requested = findRequestedCase(window.location.hash);
  if (requested !== null) return requested.render();

  return (
    <main className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26rem),1fr))] items-start gap-6 p-6">
      {GALLERY_CASES.filter((galleryCase) => galleryCase.isIsolated !== true).map((galleryCase) => (
        <section key={galleryCase.name} aria-label={galleryCase.name} className="flex min-w-0 flex-col gap-2">
          <h2 className="text-small text-muted-foreground">{galleryCase.name}</h2>
          {galleryCase.render()}
        </section>
      ))}
    </main>
  );
}

const container = document.getElementById("gallery");
if (container === null) throw new Error("the gallery page has no #gallery element");
createRoot(container).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
