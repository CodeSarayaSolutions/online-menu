# Saraya menu — Postgres schema `sarayamenu`

All app tables live in **`sarayamenu`**. This app does **not** use Supabase Auth (`auth.users`) — another app on the same database can use Supabase Auth without conflict.

## Run order (SQL editor or `psql`)

1. `001_create_schema_and_tables.sql`
2. `002_row_level_security_and_grants.sql`
3. `003_realtime_triggers_updated_at.sql` — realtime + restaurant CMS triggers (no `auth.users` triggers)
4. `004_custom_accounts.sql` — passwords, sessions, RLS helpers, seed admin
5. `005_roles_and_stations.sql` — owner/manager/kitchen/bar roles + product `station` column
6. `006_invite_otp.sql` — invite codes (no email server) + optional `ADMIN_CREATE_ACCOUNT.sql` for your admin
7. `007_storage_bucket.sql` — storage policies for bucket `sarayamenu` (create bucket as **public** in Coolify)

## Login flow

1. User enters **email** → Continue  
2. If account has a password → **password** field  
3. If invited (no password yet) → **6-digit code** + set new password  
4. Admin creates invites under **Users & Roles → Invite user** and copies the code to the client

If you already ran **001 + 002** from an older copy (with `auth_id`), run **003** then **004** only.

## Login (app-owned)

| Piece | Role |
|-------|------|
| `sarayamenu.users.password_hash` | bcrypt; set via SQL seed or admin API |
| `sarayamenu.sessions` | opaque token (hashed in DB) after `POST /api/auth/login` |
| Header `x-sarayamenu-session` | sent by the Next.js app so RLS knows who you are |

Seed admin (from `004`): **admin@saraya.dev** / **admin123** — change in production.

## PostgREST / self-hosted (required — or login says “no account”)

Your row can exist in **Table Editor** but the app still gets “No account” if the **REST API** does not expose `sarayamenu`.

Error in logs/API: `PGRST106` / `Invalid schema: sarayamenu`

**Fix:** add `sarayamenu` to PostgREST exposed schemas, then **restart** the API container/service.

- **Docker env** — append `sarayamenu` to your existing list (do not remove other apps’ schemas), then restart API:
  ```env
  PGRST_DB_SCHEMAS=public,storage,graphql_public,accountsystem,sarayaconnect,rewardscenter,gamelauncher,sarayaquiz,tshirtba,b2bprint,giftshop,clienths,sarayasite,bscsite,qrcode,sarayamenu
  ```
- **Supabase Cloud:** Dashboard → Project Settings → API → **Exposed schemas** → add `sarayamenu`.

Verify (replace URL and service role key):
```bash
curl -s 'https://YOUR-API/rest/v1/users?select=email&limit=1' \
  -H 'apikey: SERVICE_ROLE_KEY' \
  -H 'Authorization: Bearer SERVICE_ROLE_KEY' \
  -H 'Accept-Profile: sarayamenu'
```
Should return JSON (not `Invalid schema`).

## Trigger syntax

Scripts use `EXECUTE PROCEDURE function_name();` (with parentheses). If your Postgres only accepts `EXECUTE FUNCTION`, replace that keyword in `003`.
