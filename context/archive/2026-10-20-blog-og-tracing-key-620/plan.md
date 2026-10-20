---
change_id: blog-og-tracing-key-620
status: archived
---

# Plan: escaped tracing key in the blog README (issue #620)

Input: change.md, research.md. Complexity: trivial (one README bullet and the CHANGELOG).

## Goal

A standalone app that copies the README example ships its brand fonts under Turbopack and webpack alike.

## Approach

Replace the key with `"/blog/\\[slug\\]/opengraph-image"` and add one sentence on why. Rejected: a helper export
(new API for one string), a `softure-blog check` warning (cannot read the app's build config reliably).

## Phase 1: README and CHANGELOG

Files: `modules/blog/README.md`, `modules/blog/CHANGELOG.md`.

1. README §8: escaped key; the brackets are escaped because the keys are globs (Turbopack reads `[slug]` as a
   character class and traces nothing, the cards then fail with ENOENT); the escaped form works with webpack too.
2. CHANGELOG `## Unreleased`: docs fix; an app that copied `/blog/[slug]/opengraph-image` changes the key.

## Risks and rollback

Docs only; revert the commit.

## Progress

- [x] Phase 1: README and CHANGELOG (escaped key and the reason in README §8, CHANGELOG `## Unreleased`; picomatch matches the route with the escaped key; 8f456ef)
