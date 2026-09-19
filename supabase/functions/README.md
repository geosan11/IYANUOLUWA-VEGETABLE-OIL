# Supabase Edge Functions

## `delete-staff-account`

Owner-only: permanently deletes a team member's account
(`admin.auth.admin.deleteUser`) — the matching `profiles` row cascades away
automatically. Deploy: `supabase functions deploy delete-staff-account`.
Wired into the trash-icon button on each row in Staff Management.

## `create-staff-account`

Lets an owner set a **username + password directly** for a new team member —
no email invite round-trip. Supabase Auth still requires a unique email per
account, so the username is turned into a synthetic address
(`<username>@staff.iyanuoluwa.local`) that's never used for real email — the
owner just tells the person their username and password directly. This is
the account-creation path used today (Staff Management screen, owner-only);
`invite-user` (below) remains available for real email invites if ever
needed again, but nothing in the UI calls it currently.

### Deploy (or redeploy after any edit to `create-staff-account/index.ts`)

```bash
supabase functions deploy create-staff-account
```

Same zero-extra-secrets setup as `invite-user` below — deploy it the same
way, from a repo already linked to your Supabase project.

### What the app does with it

`src/services/auth.tsx`'s `createStaffAccount()` calls this function. It's
wired into the "Add Team Member" form in
`src/components/common/ScreenAccessPanel.tsx`, rendered on the owner-only
**Staff Management** screen (`src/screens/StaffManagementScreen.tsx`).
`src/services/auth.tsx`'s `signIn()` resolves whatever's typed on the login
screen — a real email, or a bare username — into the right identifier before
calling Supabase; the two must stay in sync (`STAFF_LOGIN_DOMAIN` in
`auth.tsx` and the same constant inside this function's `index.ts`).

## `invite-user`

Sends a real Supabase auth invite (email + set-password link) to a new team
member, then sets their role/hub/screen access on the resulting `profiles`
row. This needs the **service role key**, which must never be shipped to the
browser — that's why it's a server-side function instead of client code, the
same way `auth.admin.inviteUserByEmail` can only ever be called from a
trusted backend.

### One-time setup

1. Install the Supabase CLI (skip if you already have it):
   ```bash
   npm install -g supabase
   ```
2. Log in and link this repo to your Supabase project (the project ref is the
   short id in your project's dashboard URL, `https://supabase.com/dashboard/project/<ref>`):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

### Deploy (or redeploy after any edit to `invite-user/index.ts`)

```bash
supabase functions deploy invite-user
```

That's it — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`
are injected into every Edge Function automatically by Supabase; there's
nothing to set manually for those three. No new secrets are needed for this
function.

### Verify it's live

```bash
supabase functions list
```
should show `invite-user` with a recent deploy time. You can also check the
**Edge Functions** tab in the Supabase dashboard.

### What the app does with it

`src/services/auth.tsx`'s `inviteUser()` calls this function via
`supabase.functions.invoke('invite-user', { body: { email, role, hub_id, allowed_screens } })`.
It's wired into the "Invite New Member" form in
`src/components/common/ScreenAccessPanel.tsx` (Settings → Team & User
Access), which only an owner can see. Until this function is deployed, that
form will show whatever error Supabase returns for a missing function (a
404-style response) — the rest of the app is unaffected either way.
