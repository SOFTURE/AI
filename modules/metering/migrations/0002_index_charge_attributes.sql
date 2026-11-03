-- Spend of one item (`getSpend` / `getSpendBreakdown` with `filter: { attribute, value }`) reads charges through
-- `attributes @> jsonb_build_object(attribute, value)`; this index serves that containment check for any key.
-- Rollback: DROP INDEX metering.charges_attributes_idx; then
--   DELETE FROM softure.migrations WHERE module = 'metering' AND version = 2;
CREATE INDEX charges_attributes_idx ON charges USING gin (attributes jsonb_path_ops);
