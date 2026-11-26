# Implementation review: deploy-tested-tree-tag-commit

Verdict: approved. Every existing test keeps its answer and message (the fake API answers 404 for the tag's check
runs, which goes on to the pull requests as before). `answer` still exits from loops that read files through
redirects, so the outputs are written once. A compare failure for an older pull request no longer fails the whole
answer once one pull request was found. The step stays within bash 3.2 (`local`, here-strings, process substitution,
no associative arrays).
