-- A hand-over left without an answer (the process stopped between the claim and `onRequest`'s
-- answer) is handed over again by a later ask. The claim moves to its own column,
-- handover_claimed_at, which blocks other asks for a bounded time only; handed_over_at now records
-- a hand-over that answered Ok and is never repeated. Rows from before keep handed_over_at: they
-- count as handed over (a claim left behind before this migration cannot be told apart).
-- Rollback: ALTER TABLE billing.payment_requests DROP COLUMN handover_claimed_at; then
--   DELETE FROM softure.migrations WHERE module = 'billing' AND version = 8;
--   (the previous code reads handed_over_at as a claim again: nothing is handed over twice).
ALTER TABLE payment_requests ADD COLUMN handover_claimed_at timestamptz;
