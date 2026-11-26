# Plan review: deploy-tested-tree-tag-commit

Verdict: approved. Both new paths stay bounded (one check-run read for the tag; at most 5 pull requests, one tree read
per older merge commit plus the existing 11 commits each). Soundness: the tag's own commit is the tag's code; an older
pull request is reached only while every newer merge commit kept the tag's tree outside the ignored folders, and still
needs a commit of its own with that tree and green checks. The final "false" keeps the old outputs and messages, so the
callers' summaries do not change meaning. Note: the plan was written after a first prototype of the step in this
session; the review was done on the plan before the tests and docs were finished.
