// Supabase Edge Function — delete-staff-account
// ============================================================================
// Owner-only: permanently deletes a team member's Supabase auth account.
// admin.deleteUser is an admin-only API (needs the service role key, which
// the browser never has), and profiles.id has `references auth.users(id)
// on delete cascade` (see 0002_auth_rls.sql), so the matching profile row
// is removed automatically in the same operation — nothing else to clean up.
//
// Deploy: supabase functions deploy delete-staff-account (see README.md).
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } }
  });
  const {
    data: { user: caller },
    error: callerError
  } = await callerClient.auth.getUser();
  if (callerError || !caller) {
    return json({ error: 'Not signed in' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'owner') {
    return json({ error: 'Only an owner can remove team member accounts' }, 403);
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const userId = body.userId;
  if (!userId) {
    return json({ error: 'userId is required' }, 400);
  }
  if (userId === caller.id) {
    return json({ error: "You can't delete your own signed-in account this way." }, 400);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message || 'Could not delete the account' }, 400);
  }

  return json({ success: true });
});
