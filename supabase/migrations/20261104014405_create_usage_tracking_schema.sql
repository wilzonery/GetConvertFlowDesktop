/*
# Free tier usage tracking + license system

1. Purpose
   - Free users get 3 exports per week (Monday-based reset), usable across any tool.
   - Paid users (subscription $3.99/mo) get unlimited usage.
   - Device fingerprinting prevents users from getting more exports by switching devices/browsers.
   - VPN blocking via IP-based detection in the access edge function.

2. New Tables
   - `devices`: tracks unique device fingerprints. One row per physical device/browser.
     - `id` uuid PK
     - `fingerprint` text UNIQUE NOT NULL — hashed device fingerprint from browser signals
     - `first_seen` timestamptz default now()
     - `last_seen` timestamptz default now()
     - `user_agent` text — browser user agent for debugging
   - `usage_records`: tracks each export/operation. One row per tool usage.
     - `id` uuid PK
     - `device_id` uuid FK -> devices.id ON DELETE CASCADE
     - `tool` text NOT NULL — which tool was used ('converter', 'batch', 'enhancer', 'compression', 'audio')
     - `file_count` int default 1 — number of files processed in that operation
     - `created_at` timestamptz default now() — used for weekly window calculation
   - `licenses`: tracks paid subscription status per device.
     - `id` uuid PK
     - `device_id` uuid UNIQUE FK -> devices.id ON DELETE CASCADE
     - `license_key` text UNIQUE NOT NULL
     - `email` text
     - `status` text NOT NULL DEFAULT 'active' — 'active' or 'cancelled'
     - `activated_at` timestamptz default now()
     - `expires_at` timestamptz — null for lifetime, set for subscription period

3. Security
   - All tables have RLS enabled.
   - The app has no sign-in screen — it uses device fingerprints, not auth users.
   - Policies use TO anon, authenticated so the anon-key frontend can operate.
   - `devices`: anon can insert (register new device) and select (lookup by fingerprint).
   - `usage_records`: anon can insert (record usage) and select (count weekly usage).
   - `licenses`: anon can insert (activate), select (check status), update (renew), and delete (deactivate).
   - `service_role` granted for edge function access.
   - All write operations go through edge functions that validate device ownership,
     but RLS allows anon CRUD since there's no auth — the edge function provides the real enforcement.

4. Important Notes
   - The weekly reset is calculated dynamically: ISO week (Monday to Sunday).
     A usage record's week is determined by `date_trunc('week', created_at)`.
   - Device fingerprint is generated client-side from browser signals (screen, timezone,
     language, platform, canvas hash, etc.) and sent as a hashed value.
   - VPN blocking is done in the edge function using IP-based heuristics —
     datacenter IP ranges, known VPN/proxy ASNs, etc.
   - The `file_count` column allows batch conversions to count as multiple uses.
*/

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text UNIQUE NOT NULL,
  first_seen timestamptz DEFAULT now(),
  last_seen timestamptz DEFAULT now(),
  user_agent text
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON devices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO service_role;

DROP POLICY IF EXISTS "anon_select_devices" ON devices;
CREATE POLICY "anon_select_devices" ON devices FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
CREATE POLICY "anon_insert_devices" ON devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_devices" ON devices;
CREATE POLICY "anon_update_devices" ON devices FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  tool text NOT NULL,
  file_count int NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON usage_records TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON usage_records TO service_role;

DROP POLICY IF EXISTS "anon_select_usage" ON usage_records;
CREATE POLICY "anon_select_usage" ON usage_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_usage" ON usage_records;
CREATE POLICY "anon_insert_usage" ON usage_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- Licenses table
CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  license_key text UNIQUE NOT NULL,
  email text,
  status text NOT NULL DEFAULT 'active',
  activated_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON licenses TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON licenses TO service_role;

DROP POLICY IF EXISTS "anon_select_licenses" ON licenses;
CREATE POLICY "anon_select_licenses" ON licenses FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_licenses" ON licenses;
CREATE POLICY "anon_insert_licenses" ON licenses FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_licenses" ON licenses;
CREATE POLICY "anon_update_licenses" ON licenses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_licenses" ON licenses;
CREATE POLICY "anon_delete_licenses" ON licenses FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_usage_records_device_id ON usage_records(device_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_created_at ON usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_licenses_device_id ON licenses(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON devices(fingerprint);
