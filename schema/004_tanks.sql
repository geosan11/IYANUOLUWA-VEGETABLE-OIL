-- 004_tanks.sql
-- Tanks table: offloaded truck batches, remaining inventory, FIFO allocation (references products)

CREATE TABLE IF NOT EXISTS tanks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    truck_label VARCHAR(255) NOT NULL,
    tons NUMERIC(10, 3) NOT NULL,
    received_litres NUMERIC(12, 2) NOT NULL,
    remaining_litres NUMERIC(12, 2) NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shortfall NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tanks_product_date ON tanks(product_id, date);
CREATE INDEX IF NOT EXISTS idx_tanks_remaining ON tanks(remaining_litres);
