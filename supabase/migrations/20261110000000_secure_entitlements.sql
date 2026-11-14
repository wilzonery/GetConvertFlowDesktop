-- The original migration exposed device, usage, and license rows to the anon key.
-- These tables must never be written directly by the renderer.
REVOKE ALL ON TABLE devices, usage_records, licenses FROM anon, authenticated;
DROP POLICY IF EXISTS "anon_select_devices" ON devices;
DROP POLICY IF EXISTS "anon_insert_devices" ON devices;
DROP POLICY IF EXISTS "anon_update_devices" ON devices;
DROP POLICY IF EXISTS "anon_select_usage" ON usage_records;
DROP POLICY IF EXISTS "anon_insert_usage" ON usage_records;
DROP POLICY IF EXISTS "anon_select_licenses" ON licenses;
DROP POLICY IF EXISTS "anon_insert_licenses" ON licenses;
DROP POLICY IF EXISTS "anon_update_licenses" ON licenses;
DROP POLICY IF EXISTS "anon_delete_licenses" ON licenses;

CREATE TABLE IF NOT EXISTS entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_checkout_session_id text UNIQUE NOT NULL,
  stripe_price_id text,
  license_key_hash text UNIQUE NOT NULL,
  email text,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'refunded', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlement_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id uuid NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  install_id uuid NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entitlement_id, install_id)
);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_activations ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only Edge Functions using the service-role key
-- may read or modify paid entitlement data.
REVOKE ALL ON TABLE entitlements, entitlement_activations FROM anon, authenticated;
GRANT ALL ON TABLE entitlements, entitlement_activations TO service_role;

CREATE INDEX IF NOT EXISTS entitlements_status_idx ON entitlements(status);
CREATE INDEX IF NOT EXISTS entitlement_activations_entitlement_idx ON entitlement_activations(entitlement_id);
