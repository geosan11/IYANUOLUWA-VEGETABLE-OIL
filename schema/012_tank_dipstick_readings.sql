-- 012_tank_dipstick_readings.sql
-- Tank Dipstick Readings table: physical stick measurements of depot bulk tanks to audit against computed remaining litres

CREATE TABLE IF NOT EXISTS tank_dipstick_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tank_id UUID NOT NULL REFERENCES tanks(id) ON DELETE CASCADE,
    reading_litres NUMERIC(12, 2) NOT NULL CHECK (reading_litres >= 0),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tank_dipstick_tank ON tank_dipstick_readings(tank_id, recorded_at);
