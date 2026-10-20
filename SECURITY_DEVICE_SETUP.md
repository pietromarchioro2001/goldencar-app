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

Preview status: the user has confirmed the latest Preview is green and the tested flows work. Keep the checks below as the final regression checklist before merge/Production:
- unauthenticated requests to every protected database API return HTTP 401;
- an authenticated session can load Home, Agenda, Orders, Revisions, vehicle/profile, and Job Sheet;
- create, edit, and delete operations persist and remain correct after refreshing;
- malformed IDs, blank descriptions, invalid dates, and descriptions over 1000 characters are rejected;
- Supabase service-role key is available only server-side;
- other workshop screens continue to work.

The service-role key bypasses RLS, so every future server endpoint using it must perform its own device-session check and input/record validation.


## Shared login throttling — required before Production

The in-memory counter in `app/api/auth/device/route.ts` is only best-effort. It is not shared between Vercel serverless instances and must not be treated as production brute-force protection.

The login endpoint now supports a deployment-wide Upstash Redis limiter. Configure both of these server-side Vercel environment variables to activate it:
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

With both variables absent, only the best-effort per-instance fallback runs; that is not sufficient for Production. If only one variable is set, or Redis is configured but unavailable, login fails closed with HTTP 503 rather than bypassing the shared limiter. Alternatively, an edge/WAF rule scoped to `POST /api/auth/device` can provide deployment-wide throttling.

Do not add credentials to the repository or use `NEXT_PUBLIC_` variables. The endpoint prefers `x-real-ip` and otherwise uses the final address appended to `x-forwarded-for`; keep it behind the trusted Vercel proxy. After configuring Redis or the edge rule, test repeated login requests across separate requests/instances, verify HTTP 429 after the threshold, and confirm a correct password works again after the limit expires. The current Redis limiter counts login requests (not only failed passwords), so tune the threshold/window deliberately and verify expected legitimate usage.

## R2 authorization boundary — required before Production

The generic `/api/r2/file` and `/api/vision/r2/file` endpoints now call `lib/r2-access.ts` before issuing upload/download URLs or deleting objects. For `veicoli/` keys, reads and deletes require an exact persisted reference in `vehicle_media`, `vehicle_documents`, or a job's `dettagli`; vehicle media references are also checked against the matching vehicle ID. Uploads are restricted to recognized vehicle key formats. Job-media upload is allowed for an existing vehicle while a draft is being edited, but later reads/deletes require a saved reference.

Known remaining limitation: `annunci/` keys are now rejected (HTTP 403) until the sales-ad callers and their persisted record relationship are mapped and migrated. If a sales-ad workflow currently depends on this namespace, it will need a dedicated server-side authorization path before that workflow is used again.

Before Production:
- map sales-ad callers and add a dedicated per-record authorization path for `annunci/`, then test the sales-ad workflow;
- test valid and invalid uploads, downloads and deletes for vehicle media, libretto images and job PDFs, including cross-vehicle keys and unknown references;
- verify cleanup behavior if an R2 upload succeeds but its database metadata save fails (an unreferenced object is intentionally not deletable through the normal record-authorized endpoint);
- re-run the full Preview workflow checklist.

Do not run the Supabase lockdown SQL until the remaining sales-ad authorization and rollout gates are closed.

## Safe rollout gate

The Preview and Production deployments currently share the same Supabase project. The database lockdown remains unapplied. Do not run `supabase/security_lockdown.sql` until the protected code is live in Production in a controlled rollout, the rollback procedure is ready, and Production workflows no longer rely on direct anonymous Supabase table access.
