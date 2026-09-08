-- 005_pumps.sql
-- Pumps table: depot dispensing pumps with monotonic cumulative meter readings (odometer)

CREATE TABLE IF NOT EXISTS pumps (
    id VARCHAR(32) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    product_id VARCHAR(32) REFERENCES products(id) ON DELETE SET NULL,
    last_meter_reading NUMERIC(14, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed depot pumps
INSERT INTO pumps (id, label, product_id, last_meter_reading) VALUES
('p-1', 'Pump 1 (Golden Oil Line)', 'veg', 12450.00),
('p-2', 'Pump 2 (Golden Oil Line)', 'veg', 8920.00),
('p-3', 'Pump 3 (Palm Oil Line)', 'red', 5340.00)
ON CONFLICT (id) DO NOTHING;
