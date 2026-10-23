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

### Relationship validation pass (2026-10-20)

The protected Orders API now verifies that a linked job belongs to the selected vehicle on order creation, and validates the final vehicle/job pair on order edits (including when only one of those fields changes). The protected vehicle-profile PATCH now also verifies that Client 1 is the selected vehicle's primary/legacy client and that Client 2 is linked as the secondary client before updating personal data. These checks prevent valid-but-unrelated IDs from being used to link orders or edit another vehicle's client through a profile request. These are source-level fixes; the latest build must pass and the existing Preview order/profile workflows should remain covered by the previously completed smoke tests.

Scope decision (2026-10-20): sales-announcement photos do not require per-listing ownership checks for this project. Their protection is the dedicated R2 endpoint, device-session authorization, strict `annunci/` key validation, raster-only content types, and rejection by the generic vehicle-file endpoints. Do not migrate sales listings to server-side storage just for this security pass.


## Login attempt throttling

The device-password endpoint uses a best-effort in-memory counter: after 8 failed attempts from the same detected IP within a 15-minute window, further attempts are temporarily rejected. This requires no external service or additional environment variables.

Important limitation: Vercel serverless instances do not share memory, so this is a basic deterrent, not a deployment-wide brute-force limit. Keep the endpoint behind the trusted Vercel proxy, and do not treat this control as a substitute for the device password, signed HttpOnly session cookie, or authorization checks inside protected API handlers.

## R2 authorization boundary — required before Production

The generic `/api/r2/file` and `/api/vision/r2/file` endpoints now call `lib/r2-access.ts` before issuing upload/download URLs or deleting objects. For `veicoli/` keys, reads and deletes require an exact persisted reference in `vehicle_media`, `vehicle_documents`, or a job's `dettagli`; vehicle media references are also checked against the matching vehicle ID. Uploads are restricted to recognized vehicle key formats. Job-media upload is allowed for an existing vehicle while a draft is being edited, but later reads/deletes require a saved reference.

The sales screen uses a separate `/api/r2/announcement-file` endpoint that validates a narrow photo-key format and allows only raster image content types (JPEG, PNG, WebP, AVIF, GIF, BMP, HEIC and HEIF; SVG is rejected), while the generic R2 endpoints reject the `annunci/` namespace. Scope decision (2026-10-20): per-listing ownership for sales photos is intentionally out of scope. For this app, the relevant boundary is R2 access: the dedicated endpoint requires an authorized device session, validates the `annunci/` photo-key format, accepts raster image types only, and is separate from generic vehicle/document endpoints.

Before Production:
- test vehicle-media, libretto-image and job-PDF upload/download/delete paths, including cross-vehicle keys and unknown references;
- verify cleanup behavior if an R2 upload succeeds but its database metadata save fails;
- confirm the protected code is ready for controlled rollout and keep the shared Supabase lockdown unapplied until Production no longer relies on direct browser-side table access.

Do not migrate sales listings or add per-listing authorization solely for this security pass.

## Safe rollout gate

The Preview and Production deployments currently share the same Supabase project. The database lockdown remains unapplied. Do not run `supabase/security_lockdown.sql` until the protected code is live in Production in a controlled rollout, the rollback procedure is ready, and Production workflows no longer rely on direct anonymous Supabase table access.
