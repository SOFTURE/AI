# Implementation review: deploy-tested-tree-earlier-commit

Verdict: approved. Every existing case keeps its answer and message; the head is never retried; `answer` exits from
inside the loop, which reads a file through a redirect (not a pipe), so the step's outputs are written once. The
scripts stay within bash 3.2 (`local`, process substitution, no associative arrays).
