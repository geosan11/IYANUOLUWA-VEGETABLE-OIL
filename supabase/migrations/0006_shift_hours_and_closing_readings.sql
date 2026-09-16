-- 0006_shift_hours_and_closing_readings.sql
-- Add scheduled shift operating hours to app_settings and closing pump meter readings to shifts
--
-- Runs as supabase_admin — see the note at the top of 0001_init.sql.

SET ROLE supabase_admin;

alter table app_settings
  add column if not exists shift_start_time text not null default '07:00',
  add column if not exists shift_end_time text not null default '18:00',
  add column if not exists require_pump_readings_to_start_shift boolean not null default true,
  add column if not exists require_pump_readings_to_close_shift boolean not null default true;

alter table shifts
  add column if not exists closing_readings jsonb default '{}'::jsonb;

comment on column shifts.closing_readings is 'JSON object keyed by pump id -> closing odometer reading recorded when closing shift to reconcile volume dispensed. Shape: {"p-1": 12850, "p-2": 9320, "p-3": 5510}.';

RESET ROLE;
