// A server page that evaluates every module of the kit's two entry points at build time (the page is prerendered), the
// way a panel page that validates a stored cut does. A module that cannot load under the bundler fails the build.
import { existsSync } from "node:fs";

import * as kit from "@softure-ai/marketing-kit";
import * as og from "@softure-ai/marketing-kit/og";

const EDL = {
  version: 2,
  film: "towns",
  segments: [
    { id: "s1", clip: "talk", start: 0, end: 2, transition: "cut", motion: "none" },
    {
      id: "r1",
      clip: "north",
      start: 0,
      end: 2,
      transition: "cut",
      motion: "none",
      audio: { clip: "talk", start: 2, end: 4, ownVolume: 0 },
      split: { layout: "split3", bands: [{ clip: "north", start: 0, label: "North" }, { clip: "harbour", start: 0, label: "Harbour" }, { clip: "hill", start: 0, label: "Hill" }] },
    },
    { id: "s2", clip: "talk", start: 4, end: 6, transition: "cut", motion: "none" },
  ],
};

export default function Page() {
  const clips = ["talk", "north", "harbour", "hill"].map((id) => ({ id, duration: 8 }));
  const problems = kit.validateEdl(EDL, clips, "towns");
  const fonts = [kit.HAND_FONT.file, kit.FOOTAGE_DRAFT_FONT.file].map((file) => existsSync(file));
  return (
    <main>
      <p id="problems">{problems.length}</p>
      <p id="fonts">{fonts.join(",")}</p>
      <p id="exports">{Object.keys(kit).length > 0 && Object.keys(og).length > 0 ? "loaded" : "empty"}</p>
    </main>
  );
}
