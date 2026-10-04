// Drizzle view of the module's tables (migrations/0001_create_articles.sql). The migration is the
// source of truth; this file only types the queries.
import { boolean, date, jsonb, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import type { BlogArticleKind, BlogArticleStatus, BlogFaqEntry, BlogFields, BlogSource } from "../contract.js";

export const blogSchema = pgSchema("blog");

export const articles = blogSchema.table("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique("articles_slug_key"),
  kind: text("kind").$type<BlogArticleKind>().notNull(),
  cluster: text("cluster"),
  isPillar: boolean("is_pillar").notNull().default(false),
  title: text("title").notNull(),
  description: text("description").notNull(),
  summary: text("summary"),
  bodyMarkdown: text("body_markdown").notNull(),
  status: text("status").$type<BlogArticleStatus>().notNull(),
  currentAsOf: date("current_as_of", { mode: "string" }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  sources: jsonb("sources").$type<readonly BlogSource[]>().notNull().default([]),
  faq: jsonb("faq").$type<readonly BlogFaqEntry[]>().notNull().default([]),
  termForms: jsonb("term_forms").$type<readonly string[]>().notNull().default([]),
  fields: jsonb("fields").$type<BlogFields>().notNull().default({}),
  contentSha256: text("content_sha256").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const slugHistory = blogSchema.table("slug_history", {
  oldSlug: text("old_slug").primaryKey(),
  articleId: text("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull(),
});
