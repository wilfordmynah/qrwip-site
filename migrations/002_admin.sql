-- Run ONCE:  npx wrangler d1 execute qrwip --local|--remote --file=migrations/002_admin.sql
ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'new';
ALTER TABLE orders ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN customer_email TEXT;
ALTER TABLE orders ADD COLUMN ship_to TEXT;
ALTER TABLE orders ADD COLUMN color_hex TEXT;
ALTER TABLE orders ADD COLUMN amount_cents INTEGER;
ALTER TABLE orders ADD COLUMN stripe_session TEXT;
ALTER TABLE orders ADD COLUMN tracking TEXT;
ALTER TABLE orders ADD COLUMN shipped_at INTEGER;
ALTER TABLE orders ADD COLUMN claim_code TEXT;
ALTER TABLE signs ADD COLUMN reserved INTEGER NOT NULL DEFAULT 0;
UPDATE orders SET status = 'done';
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe ON orders (stripe_session) WHERE stripe_session IS NOT NULL;
INSERT OR IGNORE INTO signs (id) VALUES ('0001'),('0002'),('0003'),('0004'),('0005'),('0006'),('0007'),('0008'),('0009'),('0010');
UPDATE signs SET reserved = 1 WHERE id IN ('0001','0002','0003','0004','0005','0006','0007','0008','0009','0010');
