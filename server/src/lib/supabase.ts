import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Service-role client. Bypasses RLS; only ever used from the trusted server.
 * NEVER ship this key to the browser.
 */
export const supabase: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.serviceKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
