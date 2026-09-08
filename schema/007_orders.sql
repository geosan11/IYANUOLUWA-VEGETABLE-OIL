-- 007_orders.sql
-- Orders table: customer orders, FIFO invoices, payment status, pump and tank allocations (references customers, products, tanks, pumps)

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    unit VARCHAR(16) NOT NULL CHECK (unit IN ('litre', 'keg')),
    qty NUMERIC(12, 2) NOT NULL,
    litres NUMERIC(12, 2) NOT NULL,
    rate NUMERIC(12, 2) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    payment_method VARCHAR(32) NOT NULL CHECK (payment_method IN ('cash', 'transfer', 'credit')),
    keg_source VARCHAR(32) CHECK (keg_source IN ('company', 'own') OR keg_source IS NULL),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    source_tank_id UUID REFERENCES tanks(id) ON DELETE SET NULL,
    pump_id VARCHAR(32) REFERENCES pumps(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders(customer_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_pump_date ON orders(pump_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_due_date ON orders(due_date);
