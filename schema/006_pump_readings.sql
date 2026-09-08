-- 006_pump_readings.sql
-- Pump readings table: audit log of cumulative meter readings taken at shift starts/ends or interval checks (references pumps)

CREATE TABLE IF NOT EXISTS pump_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pump_id VARCHAR(32) NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    reading NUMERIC(14, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pump_readings_pump_date ON pump_readings(pump_id, recorded_at);

-- Seed initial pump readings
INSERT INTO pump_readings (pump_id, reading, recorded_at, note) VALUES
('p-1', 11160.00, '2026-08-01T06:00:00Z', 'Monthly baseline calibration'),
('p-1', 12450.00, '2026-09-08T07:00:00Z', 'Morning shift meter verification'),
('p-2', 8920.00, '2026-09-08T07:00:00Z', 'Morning shift meter verification'),
('p-3', 5040.00, '2026-09-07T06:00:00Z', 'Baseline palm oil meter reading'),
('p-3', 5340.00, '2026-09-07T18:00:00Z', 'End of day reading')
ON CONFLICT DO NOTHING;
