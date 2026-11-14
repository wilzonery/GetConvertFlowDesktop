import { invokeEdgeFunction, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'convertflow-license';
const INSTALL_ID_KEY = 'convertflow-install-id';
export const TEST_LICENSE_KEY = 'CONVERTFLOW-TEST-9999';

export interface LicenseState {
  key: string;
  status: 'active' | 'test';
  activatedAt: string;
}

interface ActivationResult {
  license?: LicenseState;
  error?: string;
}

function saveLicense(license: LicenseState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(license));
}

export function getSavedLicense(): LicenseState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const license = JSON.parse(raw) as LicenseState;
    return license.status === 'active' || license.status === 'test' ? license : null;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearSavedLicense() {
  localStorage.removeItem(STORAGE_KEY);
}

function getInstallId(): string {
  let id = localStorage.getItem(INSTALL_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(INSTALL_ID_KEY, id);
  }
  return id;
}

const CHECKOUT_URL = 'https://buy.stripe.com/4gM00jaS23rW27B5C528805';

export async function startCheckout(): Promise<string> {
  return CHECKOUT_URL;
}

export async function activateLicense(input: string): Promise<ActivationResult> {
  const key = input.trim().toUpperCase();
  if (!key) return { error: 'Enter your license key.' };

  // The test key is intentionally development-only and cannot unlock a packaged release.
  if (import.meta.env.DEV && key === TEST_LICENSE_KEY) {
    const license: LicenseState = { key, status: 'test', activatedAt: new Date().toISOString() };
    saveLicense(license);
    return { license };
  }

  if (!isSupabaseConfigured) {
    return { error: 'Payments are not configured for this build yet.' };
  }

  try {
    const result = await invokeEdgeFunction<{ active?: boolean; error?: string }>('activate-license', {
      licenseKey: key,
      installId: getInstallId(),
    });
    if (!result.active) return { error: result.error || 'That license key is not active.' };

    const license: LicenseState = { key, status: 'active', activatedAt: new Date().toISOString() };
    saveLicense(license);
    return { license };
  } catch {
    return { error: 'Could not reach the license service. Check your connection and try again.' };
  }
}
