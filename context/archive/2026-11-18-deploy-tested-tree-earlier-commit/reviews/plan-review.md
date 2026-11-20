# Plan review: deploy-tested-tree-earlier-commit

Verdict: approved. The walk back is bounded (10 commits, one tree and one check-run read each), a doubt stops it, and
the soundness argument of 0.7.4 holds per commit: a commit is accepted only when its own tree equals the tag's outside
the ignored folders and its own checks passed.
