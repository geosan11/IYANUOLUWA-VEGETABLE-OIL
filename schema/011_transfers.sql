-- 011_transfers.sql
-- Transfers table: tracks direct redistribution of company kegs or bulk litres between customers/agents without touching depot yard inventory

CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    to_customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    item_type VARCHAR(16) NOT NULL CHECK (item_type IN ('keg', 'litres')),
    qty NUMERIC(12, 2) NOT NULL CHECK (qty > 0),
    product_id VARCHAR(32) REFERENCES products(id) ON DELETE SET NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_different_customers CHECK (from_customer_id <> to_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_transfers_from_customer ON transfers(from_customer_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_to_customer ON transfers(to_customer_id, date);
CREATE INDEX IF NOT EXISTS idx_transfers_date ON transfers(date);
