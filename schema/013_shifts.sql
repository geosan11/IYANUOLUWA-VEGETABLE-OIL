-- 013_shifts.sql
-- Shifts table: formal daily depot work shifts, supervisor sign-offs, and expected vs counted physical cash reconciliation

CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supervisor_name VARCHAR(128) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    opening_float NUMERIC(12, 2) NOT NULL DEFAULT 150000,
    cash_sales NUMERIC(14, 2) NOT NULL DEFAULT 0,
    cash_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(14, 2) NOT NULL DEFAULT 0,
    cash_counted NUMERIC(14, 2),
    cash_variance NUMERIC(14, 2),
    notes TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_status_time ON shifts(status, start_time);
