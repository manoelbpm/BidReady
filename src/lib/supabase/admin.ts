import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClientInstance: SupabaseClient | null = null;

export function isServiceRoleConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  if (key === 'dummy-service-role-key-for-local-mocking') return false;
  if (key.length < 20) return false;
  return true;
}

export function getAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !isServiceRoleConfigured()) {
    throw new Error(
      'Administrative Operation Blocked: SUPABASE_SERVICE_ROLE_KEY is not configured with a valid secret. ' +
      'Please configure SUPABASE_SERVICE_ROLE_KEY in .env.local to enable backend administrative actions.'
    );
  }

  if (!adminClientInstance) {
    adminClientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClientInstance;
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

