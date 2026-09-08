-- 001_products.sql
-- Products table: defines product catalog (vegetable oil, palm oil) and baseline conversion rates

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    litres_per_ton NUMERIC(10, 2) NOT NULL,
    color_light VARCHAR(32) NOT NULL,
    color_dark VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial products
INSERT INTO products (id, name, litres_per_ton, color_light, color_dark) VALUES
('veg', 'Golden Vegetable Oil', 1090.00, '#FCD34D', '#B45309'),
('red', 'Red / Palm Oil', 1085.00, '#F87171', '#7F1D1D')
ON CONFLICT (id) DO UPDATE SET 
    litres_per_ton = EXCLUDED.litres_per_ton,
    color_light = EXCLUDED.color_light,
    color_dark = EXCLUDED.color_dark;
