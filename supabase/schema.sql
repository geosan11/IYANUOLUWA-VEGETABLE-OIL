-- ==============================================================================
-- Iyanuoluwa Digital Operations - PostgreSQL Database Schema & Seed Data
-- ==============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    litres_per_ton NUMERIC(10, 2) NOT NULL,
    color_light VARCHAR(32) NOT NULL,
    color_dark VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RATE CARDS TABLE
CREATE TABLE IF NOT EXISTS rate_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(32) REFERENCES products(id) ON DELETE CASCADE,
    tier VARCHAR(32) NOT NULL CHECK (tier IN ('retail', 'agent', 'corporate')),
    rate_per_litre NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (product_id, tier)
);

-- 3. CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('retail', 'agent', 'corporate')),
    credit_limit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    credit_term_days INT NOT NULL DEFAULT 14,
    phone VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TANKS TABLE
CREATE TABLE IF NOT EXISTS tanks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(32) REFERENCES products(id) ON DELETE RESTRICT,
    truck_label VARCHAR(255) NOT NULL,
    tons NUMERIC(10, 3) NOT NULL,
    received_litres NUMERIC(12, 2) NOT NULL,
    remaining_litres NUMERIC(12, 2) NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shortfall NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    product_id VARCHAR(32) REFERENCES products(id) ON DELETE RESTRICT,
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
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. KEG RETURNS TABLE (Audit Log)
CREATE TABLE IF NOT EXISTS keg_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT,
    qty INT NOT NULL CHECK (qty > 0),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- STORAGE BUCKET FOR LOGOS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('depot_assets', 'depot_assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'depot_assets' );

CREATE POLICY "Authenticated & Anon Uploads" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'depot_assets' );

CREATE POLICY "Authenticated & Anon Updates" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'depot_assets' );

-- ==============================================================================
-- SEED INITIAL DATA
-- ==============================================================================

-- Products
INSERT INTO products (id, name, litres_per_ton, color_light, color_dark) VALUES
('veg', 'Golden Vegetable Oil', 1090.00, '#FCD34D', '#B45309'),
('red', 'Red / Palm Oil', 1085.00, '#F87171', '#7F1D1D')
ON CONFLICT (id) DO UPDATE SET 
    litres_per_ton = EXCLUDED.litres_per_ton,
    color_light = EXCLUDED.color_light,
    color_dark = EXCLUDED.color_dark;

-- Rate Cards
INSERT INTO rate_cards (product_id, tier, rate_per_litre) VALUES
('veg', 'retail', 5200.00),
('veg', 'agent', 4800.00),
('veg', 'corporate', 4500.00),
('red', 'retail', 5600.00),
('red', 'agent', 5100.00),
('red', 'corporate', 4800.00)
ON CONFLICT (product_id, tier) DO UPDATE SET rate_per_litre = EXCLUDED.rate_per_litre;

-- Sample Customers
INSERT INTO customers (id, name, type, credit_limit, credit_term_days, phone) VALUES
('c0000000-0000-0000-0000-000000000001', 'Mr Samson', 'corporate', 300000.00, 30, '+2348031234567'),
('c0000000-0000-0000-0000-000000000002', 'Arena', 'agent', 200000.00, 14, '+2348022345678'),
('c0000000-0000-0000-0000-000000000003', 'Iya Aige', 'agent', 150000.00, 14, '+2348053456789'),
('c0000000-0000-0000-0000-000000000004', 'Lekki Agent', 'agent', 100000.00, 14, '+2348094567890')
ON CONFLICT (id) DO NOTHING;

-- Initial Settings
INSERT INTO settings (key, value) VALUES
('total_company_kegs', '500'::jsonb),
('daily_float', '150000'::jsonb),
('company_name', '"Iyanuoluwa Vegetable & Palm Oil Depot"'::jsonb),
('company_phone', '"+234 802 000 1122"'::jsonb),
('company_address', '"Plot 14, Commercial Avenue, Alaba Depot, Lagos"'::jsonb),
('company_logo_url', 'null'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
