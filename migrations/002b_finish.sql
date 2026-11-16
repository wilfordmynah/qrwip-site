-- Safe to run any number of times (finishes 002_admin.sql if it stopped partway).
UPDATE orders SET status = 'done' WHERE claim_code IS NULL AND status = 'new';
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe ON orders (stripe_session) WHERE stripe_session IS NOT NULL;
INSERT OR IGNORE INTO signs (id) VALUES ('0001'),('0002'),('0003'),('0004'),('0005'),('0006'),('0007'),('0008'),('0009'),('0010');
UPDATE signs SET reserved = 1 WHERE id IN ('0001','0002','0003','0004','0005','0006','0007','0008','0009','0010');
