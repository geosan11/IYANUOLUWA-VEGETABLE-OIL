-- 008_keg_returns.sql
-- Keg returns table: audit log for customer company keg returns (references customers)

CREATE TABLE IF NOT EXISTS keg_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_keg_returns_customer_date ON keg_returns(customer_id, date);
