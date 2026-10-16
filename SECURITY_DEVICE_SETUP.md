# GOLDENCAR device access rollout

This branch is for staging only. Do not merge to main until Preview testing is complete.

## Environment variables

- `GOLDENCAR_DEVICE_PASSWORD`: unique password with at least 12 characters.
- `GOLDENCAR_SESSION_SECRET`: random secret with at least 32 characters.

Set these in Vercel project settings, not in source code and never with a `NEXT_PUBLIC_` prefix.

## Rollout

1. Add and test the device authorization flow on Preview.
2. Verify unauthenticated page and API requests are rejected.
3. Verify OCR, vehicle lookup, uploads, downloads, deletes, appointments, jobs, orders, payments and reminders.
4. Only after testing, migrate Supabase RLS policies. Do not drop existing policies before the app no longer depends on direct anonymous database access.

## Known limitations

The shared password is not individual device management. The current Supabase anon policies may still permit direct database access, and signed R2 URLs remain usable until expiration. These need separate remediation before considering the system fully secured.


## Additional server-side database setting

The reviewed database-backed screens now use protected server APIs, including `/api/appointments`, `/api/home`, `/api/orders`, `/api/payments`, `/api/jobs`, `/api/revisioni`, and `/api/vehicles`. These routes require the server-only Vercel environment variable:

- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase service-role key for this project. Set it only in Vercel server-side environment variables (Preview first); never use a `NEXT_PUBLIC_` prefix and never put the value in the repository.

The route returns HTTP 503 if this variable or the Supabase URL is missing. Until it is configured in the Preview environment, database-backed operations routed through these APIs will return a configuration error. This is intentional fail-closed behavior. Do not revoke existing Supabase anon grants yet: although the reviewed pages have been migrated to protected APIs, the live Preview still needs end-to-end verification and a final full-repository scan before changing RLS/grants.

## Preview migration verification

On the security Preview, verify:
- unauthenticated requests to every protected database API return HTTP 401;
- an authenticated session can load Home, Agenda, Orders, Revisions, vehicle/profile, and Job Sheet;
- create, edit, and delete operations persist and remain correct after refreshing;
- malformed IDs, blank descriptions, invalid dates, and descriptions over 1000 characters are rejected;
- Supabase service-role key is available only server-side;
- other workshop screens continue to work.

The service-role key bypasses RLS, so every future server endpoint using it must perform its own device-session check and input/record validation.
