-- 002_rate_cards.sql
-- Rate cards table: product × tier → rate per litre matrix (references products)

CREATE TABLE IF NOT EXISTS rate_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tier VARCHAR(32) NOT NULL CHECK (tier IN ('retail', 'agent', 'corporate')),
    rate_per_litre NUMERIC(12, 2) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (product_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_product_tier ON rate_cards(product_id, tier);

-- Seed initial rate cards
INSERT INTO rate_cards (product_id, tier, rate_per_litre) VALUES
('veg', 'retail', 5200.00),
('veg', 'agent', 4800.00),
('veg', 'corporate', 4500.00),
('red', 'retail', 5600.00),
('red', 'agent', 5100.00),
('red', 'corporate', 4800.00)
ON CONFLICT (product_id, tier) DO UPDATE SET rate_per_litre = EXCLUDED.rate_per_litre;
