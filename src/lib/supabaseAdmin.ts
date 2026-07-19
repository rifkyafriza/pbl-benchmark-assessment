// Server-only Supabase client using the service_role key.
// NEVER import this from a Client Component — it bypasses RLS entirely.
// This is intentional: RLS is enabled with zero policies (deny-all for anon/authenticated),
// and all data access goes through Server Actions/Route Handlers using this client after
// our own username+password session check. See README.md "Auth & RLS architecture".
import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY env var is not set (required for server-side data access)');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
