import type { z } from "zod";

import type { OgNode } from "../element.js";
import type { OgTemplateContext } from "./context.js";
import { headlineChartTemplate } from "./headline-chart.js";
import { headlineCtaTemplate } from "./headline-cta.js";
import { headlineChartDataSchema, headlineCtaDataSchema } from "./schemas.js";

/** A template with its data schema; `build` takes data that passed it. */
interface RegisteredTemplate {
  schema: z.ZodType;
  build(data: unknown, context: OgTemplateContext): OgNode;
}

function register<Schema extends z.ZodType>(schema: Schema, template: { build(data: z.output<Schema>, context: OgTemplateContext): OgNode }): RegisteredTemplate {
  // `data` reaches `build` only after `schema` parsed it (see `buildOgTree`).
  return { schema, build: (data, context) => template.build(data as z.output<Schema>, context) };
}

export const OG_TEMPLATES = {
  "headline-cta": register(headlineCtaDataSchema, headlineCtaTemplate),
  "headline-chart": register(headlineChartDataSchema, headlineChartTemplate),
} as const satisfies Record<string, RegisteredTemplate>;

export type OgTemplateId = keyof typeof OG_TEMPLATES;

export const OG_TEMPLATE_IDS = Object.keys(OG_TEMPLATES) as OgTemplateId[];

export function isOgTemplateId(value: string): value is OgTemplateId {
  return Object.hasOwn(OG_TEMPLATES, value);
}
