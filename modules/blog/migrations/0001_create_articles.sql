-- Blog articles and glossary terms, a copy of the app's Markdown files (`softure-blog publish`), and
-- the history of their old slugs (301 targets). The files are the source of truth; rows change only
-- through the publish command. A withdrawn article keeps its row (the page answers 410, not 404).
-- Rollback: DROP TABLE blog.slug_history; DROP TABLE blog.articles; DROP FUNCTION blog.is_kebab(text);
--   then DELETE FROM softure.migrations WHERE module = 'blog' AND version = 1;

-- A stable key or address segment: lowercase letters and digits joined by single hyphens, at most
-- 100 characters.
CREATE FUNCTION is_kebab(value text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT char_length(value) <= 100 AND value ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
$$;

CREATE TABLE articles (
  -- The file's `id`: given once and never changed, so a slug can change.
  id text PRIMARY KEY CHECK (is_kebab(id)),
  -- The address segment; the file is named `<slug>.md`.
  slug text NOT NULL CHECK (is_kebab(slug)),
  kind text NOT NULL CHECK (kind IN ('article', 'term')),
  -- The topic for "read next" lists; the pillar is the main text of its cluster.
  cluster text CHECK (cluster IS NULL OR is_kebab(cluster)),
  is_pillar boolean NOT NULL DEFAULT false,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 320),
  -- The "in short" box above the body; NULL for none.
  summary text CHECK (summary IS NULL OR char_length(summary) BETWEEN 1 AND 600),
  body_markdown text NOT NULL CHECK (body_markdown <> ''),
  status text NOT NULL CHECK (status IN ('draft', 'published', 'withdrawn')),
  -- The day the facts in the text were checked.
  current_as_of date NOT NULL,
  published_at timestamptz,
  -- Moves only when the content of an already published text changes.
  updated_at timestamptz,
  -- [{ "name": ..., "url": ... }]
  sources jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(sources) = 'array'),
  -- [{ "question": ..., "answer": ... }]
  faq jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(faq) = 'array'),
  -- The phrases that link to a term's definition (["tax wrapper", "tax wrappers"]); empty for articles.
  term_forms jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(term_forms) = 'array'),
  -- The app's own frontmatter fields (blog({ fields })), as parsed.
  fields jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(fields) = 'object'),
  -- sha256 (hex) of the content the reader sees; unchanged files are skipped by it.
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  CONSTRAINT articles_slug_key UNIQUE (slug),
  CONSTRAINT articles_published_has_date CHECK (status <> 'published' OR published_at IS NOT NULL),
  CONSTRAINT articles_updated_after_publication CHECK (updated_at IS NULL OR published_at IS NOT NULL),
  CONSTRAINT articles_pillar_has_cluster CHECK (NOT is_pillar OR cluster IS NOT NULL),
  CONSTRAINT articles_term_forms_by_kind CHECK (
    (kind = 'term' AND jsonb_array_length(term_forms) > 0) OR (kind = 'article' AND jsonb_array_length(term_forms) = 0)
  ),
  -- One pillar per cluster among the texts that are not withdrawn. Deferred to the end of the
  -- transaction, so a publish run can move the pillar from one article to another.
  CONSTRAINT articles_one_pillar_per_cluster EXCLUDE USING btree (cluster WITH =)
    WHERE (is_pillar AND status <> 'withdrawn') DEFERRABLE INITIALLY DEFERRED
);

-- Lists of published texts, newest first.
CREATE INDEX articles_published_idx ON articles (published_at DESC, slug) WHERE status = 'published';

CREATE TABLE slug_history (
  -- A slug the article had before; it redirects to the article's current slug.
  old_slug text PRIMARY KEY CHECK (is_kebab(old_slug)),
  article_id text NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
  changed_at timestamptz NOT NULL
);

CREATE INDEX slug_history_article_idx ON slug_history (article_id);
