// Supabase Edge Function — create-staff-account
// ============================================================================
// Lets an owner set a username + password directly for a new team member —
// no email round-trip required, unlike invite-user. Supabase Auth still
// needs a unique "email" per account, so the chosen username is turned into
// a synthetic address under a fixed local domain (never sent anywhere, never
// shown to the user as an email — it's just a stable unique key). The owner
// tells the staff member their username and password directly; the login
// screen accepts either a real email or a bare username and resolves the
// same synthetic address before calling signInWithPassword (see
// resolveLoginIdentifier in src/services/auth.tsx — the domain constant
// below MUST match STAFF_LOGIN_DOMAIN there exactly).
//
// Requires SUPABASE_SERVICE_ROLE_KEY — auto-injected, nothing to configure.
// Deploy: supabase functions deploy create-staff-account (see README.md).
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const VALID_ROLES = ['owner', 'hub_manager', 'staff', 'driver'];

// Keep in sync with STAFF_LOGIN_DOMAIN in src/services/auth.tsx.
const STAFF_LOGIN_DOMAIN = 'staff.iyanuoluwa.local';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

/** lowercase, spaces -> dots, strip anything not safe in an email local-part. */
function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '');
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
    return json({ error: 'Only an owner can create team member accounts' }, 403);
  }

  let body: {
    username?: string;
    password?: string;
    full_name?: string | null;
    role?: string;
    hub_id?: string | null;
    allowed_screens?: string[] | null;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body' }, 400);
  }

  const username = sanitizeUsername(body.username || '');
  const password = body.password || '';
  const role = body.role;
  const fullName = body.full_name?.trim() || null;

  if (!username || username.length < 3) {
    return json({ error: 'Username must be at least 3 characters (letters, numbers, dots, dashes, underscores only).' }, 400);
  }
  if (!password || password.length < 6) {
    return json({ error: 'Password must be at least 6 characters.' }, 400);
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` }, 400);
  }

  const syntheticEmail = `${username}@${STAFF_LOGIN_DOMAIN}`;

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : undefined
  });

  if (createError || !created?.user) {
    const msg = createError?.message || 'Could not create the account';
    return json(
      { error: /already.*registered|already exists/i.test(msg) ? `Username "${username}" is already taken.` : msg },
      400
    );
  }

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      role,
      hub_id: role === 'owner' ? null : body.hub_id ?? null,
      allowed_screens: body.allowed_screens ?? null,
      ...(fullName ? { full_name: fullName } : {})
    })
    .eq('id', created.user.id);

  if (profileError) {
    return json(
      { error: `Account created, but role/hub could not be set: ${profileError.message}. Set it manually in Team & User Access.` },
      200
    );
  }

  return json({ success: true, userId: created.user.id, username });
});
