// Image rules (BF-3): every image in a body follows the app's image policy (`blog({ images })`), the
// same check the renderer applies, so a text whose image the page would drop never goes public.
import { checkArticleImage, type ArticleImagePolicy, type FoundImage, type ImageProblem, type ImageVerdict } from "../../render/images.js";
import type { QualityFinding } from "../finding.js";

const RULE_BY_PROBLEM: Record<ImageProblem, string> = { source: "image-source", alt: "image-alt", dimensions: "image-dimensions" };

function describeProblem(problem: ImageProblem, src: string, policy: ArticleImagePolicy | null): string {
  switch (problem) {
    case "source":
      return policy === null
        ? `images are off until the app sets blog({ images }): ${src}`
        : `an image from outside the site and the allowed hosts (blog({ images: { hosts } })): ${src}`;
    case "alt":
      return `an image without alt text; describe what it shows: ${src}`;
    case "dimensions":
      return `the app does not know the width and height of an image (blog({ images: { dimensions } })): ${src}`;
  }
}

export function checkImages(images: readonly FoundImage[], policy: ArticleImagePolicy | null): QualityFinding[] {
  return images.flatMap((image) => {
    let verdict: ImageVerdict;
    try {
      verdict = checkArticleImage(image, policy ?? undefined);
    } catch (error) {
      // The resolver is the app's code; its bug refuses the file instead of crashing a publish.
      const detail = error instanceof Error ? error.message : String(error);
      return [{ rule: "image-dimensions", severity: "error" as const, message: `the image dimensions resolver failed (${detail}): ${image.src}`, line: image.line }];
    }
    if (verdict.ok) return [];
    return verdict.problems.map((problem) => ({ rule: RULE_BY_PROBLEM[problem], severity: "error" as const, message: describeProblem(problem, image.src, policy), line: image.line }));
  });
}
