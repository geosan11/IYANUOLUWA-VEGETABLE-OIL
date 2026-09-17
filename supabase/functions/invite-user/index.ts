// Supabase Edge Function — invite-user
// ============================================================================
// Sends a real Supabase auth invite email to a new team member and sets their
// role/hub/screen access on the resulting profile row. Requires the
// SUPABASE_SERVICE_ROLE_KEY, which the anon-key client the app normally uses
// can never have — inviteUserByEmail is an admin-only API. Supabase injects
// SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY into every
// Edge Function automatically; nothing to configure by hand for those three.
//
// Deploy: see supabase/functions/README.md in this same folder.
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const VALID_ROLES = ['owner', 'hub_manager', 'staff', 'driver'];

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

  // Client scoped to the caller's own JWT — used only to find out who's calling.
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

  // Admin client — the only thing in this whole app allowed to call
  // auth.admin.* or bypass RLS. Never send the service role key to the browser.
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', caller.id)
    .single();

  if (!callerProfile || callerProfile.role !== 'owner') {
    return json({ error: 'Only an owner can invite team members' }, 403);
  }

  let body: {
    email?: string;
    role?: string;
    hub_id?: string | null;
    allowed_screens?: string[] | null;
    redirectTo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  const role = body.role;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'A valid email address is required' }, 400);
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
  }

  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: body.redirectTo
  });

  if (inviteError || !inviteData?.user) {
    return json({ error: inviteError?.message || 'Could not send the invite' }, 400);
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      role,
      hub_id: role === 'owner' ? null : body.hub_id ?? null,
      allowed_screens: body.allowed_screens ?? null
    })
    .eq('id', inviteData.user.id);

  if (profileError) {
    // The invite email already went out at this point — surface it clearly
    // rather than pretending the whole operation failed.
    return json(
      { error: `Invite sent, but role/hub could not be set: ${profileError.message}. Set it manually in Team & User Access.` },
      200
    );
  }

  return json({ success: true, userId: inviteData.user.id });
});
