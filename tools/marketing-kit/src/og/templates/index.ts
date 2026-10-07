import type { z } from "zod";

import type { OgNode } from "../element.js";
import { bigNumberTemplate } from "./big-number.js";
import { carouselTemplate } from "./carousel.js";
import type { OgLayout, OgTemplateContext } from "./context.js";
import { headlineChartTemplate } from "./headline-chart.js";
import { headlineCtaTemplate } from "./headline-cta.js";
import { bigNumberDataSchema, carouselDataSchema, headlineChartDataSchema, headlineCtaDataSchema } from "./schemas.js";

/** A template with its data schema; `build` and `countSlides` take data that passed it. */
interface RegisteredTemplate {
  schema: z.ZodType;
  layout: OgLayout;
  /** How many images the data makes; 1 for a single card. */
  countSlides(data: unknown): number;
  build(data: unknown, context: OgTemplateContext, slide: number): OgNode;
}

interface TemplateDefinition<Data> {
  layout: OgLayout;
  build(data: Data, context: OgTemplateContext, slide: number): OgNode;
  countSlides?(data: Data): number;
}

function register<Schema extends z.ZodType>(schema: Schema, template: TemplateDefinition<z.output<Schema>>): RegisteredTemplate {
  // `data` reaches `build` and `countSlides` only after `schema` parsed it (see `buildOgTree`).
  return {
    schema,
    layout: template.layout,
    countSlides: (data) => template.countSlides?.(data as z.output<Schema>) ?? 1,
    build: (data, context, slide) => template.build(data as z.output<Schema>, context, slide),
  };
}

export const OG_TEMPLATES = {
  "headline-cta": register(headlineCtaDataSchema, { layout: "landscape", build: (data, context, slide) => headlineCtaTemplate.build(data, context, slide) }),
  "headline-chart": register(headlineChartDataSchema, { layout: "landscape", build: (data, context, slide) => headlineChartTemplate.build(data, context, slide) }),
  "big-number": register(bigNumberDataSchema, { layout: "portrait", build: (data, context, slide) => bigNumberTemplate.build(data, context, slide) }),
  carousel: register(carouselDataSchema, {
    layout: "portrait",
    build: (data, context, slide) => carouselTemplate.build(data, context, slide),
    countSlides: (data) => data.slides.length,
  }),
} as const satisfies Record<string, RegisteredTemplate>;

export type OgTemplateId = keyof typeof OG_TEMPLATES;

export const OG_TEMPLATE_IDS = Object.keys(OG_TEMPLATES) as OgTemplateId[];

export function isOgTemplateId(value: string): value is OgTemplateId {
  return Object.hasOwn(OG_TEMPLATES, value);
}
