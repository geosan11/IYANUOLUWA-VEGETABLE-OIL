-- 010_settings.sql
-- Settings table: consolidated key/value store for company profile and operational thresholds

CREATE TABLE IF NOT EXISTS settings (
    key VARCHAR(64) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed consolidated settings (single source of truth)
INSERT INTO settings (key, value) VALUES
('litres_per_keg', '30'::jsonb),
('total_company_kegs', '500'::jsonb),
('kegs_at_depot_low_threshold', '20'::jsonb),
('low_stock_litres_threshold', '500'::jsonb),
('truck_shortfall_threshold', '50'::jsonb),
('pump_variance_threshold', '20'::jsonb),
('dipstick_variance_threshold', '30'::jsonb),
('default_daily_float', '150000'::jsonb),
('company_name', '"Iyanuoluwa Vegetable & Palm Oil Depot"'::jsonb),
('company_phone', '"+234 802 000 1122"'::jsonb),
('company_address', '"Plot 14, Commercial Avenue, Alaba Depot, Lagos"'::jsonb),
('company_logo_url', 'null'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

