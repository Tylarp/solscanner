/*
# Create watchlist, alerts, and alert history tables (single-tenant, no auth)

1. New Tables
- `watchlist` — saved Solana token addresses the user wants to track
  - `id` (uuid, primary key)
  - `token_address` (text, unique — the on-chain mint address)
  - `token_symbol` (text, not null)
  - `token_name` (text, nullable)
  - `notes` (text, nullable)
  - `added_at` (timestamptz, default now())
- `alerts` — user-configured alert rules for token metric thresholds
  - `id` (uuid, primary key)
  - `token_address` (text, not null)
  - `token_symbol` (text, not null)
  - `alert_type` (text, not null — one of: price_up, price_down, volume_spike, liquidity_drop, holder_change, momentum)
  - `threshold` (numeric, nullable — the value that triggers the alert)
  - `timeframe` (text, default 'h24' — m5, h1, h6, h24)
  - `active` (boolean, default true)
  - `created_at` (timestamptz, default now())
- `alert_history` — log of triggered alerts
  - `id` (uuid, primary key)
  - `alert_id` (uuid, FK to alerts, ON DELETE CASCADE)
  - `token_address` (text, not null)
  - `token_symbol` (text, not null)
  - `alert_type` (text, not null)
  - `triggered_value` (numeric, nullable)
  - `message` (text, not null)
  - `triggered_at` (timestamptz, default now())
2. Security
- Enable RLS on all three tables.
- Allow anon + authenticated full CRUD because the data is intentionally public/shared (single-tenant app, no sign-in screen).
3. Indexes
- Index on watchlist.token_address for quick lookups
- Index on alerts.token_address and alerts.active for filtering
- Index on alert_history.alert_id for joins
*/

CREATE TABLE IF NOT EXISTS watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  token_symbol text NOT NULL,
  token_name text,
  notes text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(token_address)
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_address text NOT NULL,
  token_symbol text NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('price_up', 'price_down', 'volume_spike', 'liquidity_drop', 'holder_change', 'momentum')),
  threshold numeric,
  timeframe text NOT NULL DEFAULT 'h24',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid REFERENCES alerts(id) ON DELETE CASCADE,
  token_address text NOT NULL,
  token_symbol text NOT NULL,
  alert_type text NOT NULL,
  triggered_value numeric,
  message text NOT NULL,
  triggered_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_token_address ON watchlist(token_address);
CREATE INDEX IF NOT EXISTS idx_alerts_token_address ON alerts(token_address);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active);
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_token_address ON alert_history(token_address);

ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_watchlist" ON watchlist;
CREATE POLICY "anon_select_watchlist" ON watchlist FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_watchlist" ON watchlist;
CREATE POLICY "anon_insert_watchlist" ON watchlist FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_watchlist" ON watchlist;
CREATE POLICY "anon_update_watchlist" ON watchlist FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_watchlist" ON watchlist;
CREATE POLICY "anon_delete_watchlist" ON watchlist FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_alerts" ON alerts;
CREATE POLICY "anon_select_alerts" ON alerts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alerts" ON alerts;
CREATE POLICY "anon_insert_alerts" ON alerts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_alerts" ON alerts;
CREATE POLICY "anon_update_alerts" ON alerts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alerts" ON alerts;
CREATE POLICY "anon_delete_alerts" ON alerts FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_select_alert_history" ON alert_history;
CREATE POLICY "anon_select_alert_history" ON alert_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_alert_history" ON alert_history;
CREATE POLICY "anon_insert_alert_history" ON alert_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_alert_history" ON alert_history;
CREATE POLICY "anon_delete_alert_history" ON alert_history FOR DELETE
  TO anon, authenticated USING (true);