-- Delivery ids of third-party webhooks already received, so a provider's retry is acknowledged and skipped.
-- Rollback: DROP TABLE security.webhook_deliveries; then
--   DELETE FROM softure.migrations WHERE module = 'security' AND version = 2;
CREATE TABLE webhook_deliveries (
  source text NOT NULL CHECK (source ~ '^[a-z][a-z0-9_.-]{0,62}$'),
  delivery_id text NOT NULL CHECK (char_length(delivery_id) BETWEEN 1 AND 200 AND delivery_id !~ '[[:cntrl:]]'),
  received_at timestamptz NOT NULL,
  PRIMARY KEY (source, delivery_id)
);

-- Pruning deletes by age; without the index every run scans the whole table.
CREATE INDEX webhook_deliveries_received_at_idx ON webhook_deliveries (received_at);
