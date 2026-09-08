-- 003_customers.sql
-- Customers table: credit limits, credit terms (days), tier type, contact information

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('retail', 'agent', 'corporate')),
    credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    credit_term_days INT NOT NULL DEFAULT 14,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);

-- Seed sample customers
INSERT INTO customers (id, name, type, credit_limit, credit_term_days, phone) VALUES
('c0000000-0000-0000-0000-000000000001', 'Mr Samson', 'corporate', 300000.00, 30, '+2348031234567'),
('c0000000-0000-0000-0000-000000000002', 'Arena', 'agent', 200000.00, 14, '+2348022345678'),
('c0000000-0000-0000-0000-000000000003', 'Iya Aige', 'agent', 150000.00, 14, '+2348053456789'),
('c0000000-0000-0000-0000-000000000004', 'Lekki Agent', 'agent', 100000.00, 14, '+2348094567890')
ON CONFLICT (id) DO NOTHING;
