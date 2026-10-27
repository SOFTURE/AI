---
change_id: auth-oidc-opt-in-786
verdict: approved
---

# Plan review

- Coverage: the comment's two bullets. Messages: done in 0.2.7 (#796), restated in the notes. Tables and buckets:
  the plan takes the comment's own fallback ("a clear note that they are inert") with the reasons in R1 and R2, and
  the comment's last paragraph (exact steps every app takes) is step 4.
- Proof: step 1 makes "inert" a tested claim, not just a sentence: no bucket needed, no row written.
- Risk: an app reading "no change" when a migration is due. Step 4 states `softure migrate` as the one step. Accepted.
- Scope: no behaviour change, no version bump. Approved.
