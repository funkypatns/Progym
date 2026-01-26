ALTER TABLE  Payment ADD COLUMN idempotencyKey TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS Payment_idempotencyKey_key ON Payment (idempotencyKey);
