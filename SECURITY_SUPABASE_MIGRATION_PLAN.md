# GOLDENCAR security rollout — Supabase migration plan

## Current status — 2026-10-20

The user has tested the current Vercel Preview and confirms that the app workflows function. The latest branch commit is `441fbf410ac543f93d2975fb4b814152a4af9ed0`; GitHub Actions build and the Vercel Preview deployment status are successful.

The security branch is `security/device-registration`. PR #1 is still open and in draft: https://github.com/pietromarchioro2001/goldencar-app/pull/1. It has not been merged. The branch is 153 commits ahead of `main`; before merge, confirm that the complete release scope is intended.

## Implemented on the security branch

- Device-password access gate with signed HMAC cookie, HttpOnly and SameSite protections, and middleware validation.
- Sensitive data, OCR and R2 routes independently validate the device session.
- Reviewed browser-side Supabase operations have been migrated to domain-specific server APIs using server-only `SUPABASE_SERVICE_ROLE_KEY`.
- Request fields are validated and the jobs API allowlists writable columns.
- Generic R2 reads/deletes validate persisted vehicle/document/job references. Sales photos use a dedicated `annunci/` endpoint restricted to a specific key format and raster image content types.
- OCR routes reject empty and oversized images.
- The optional external rate-limiter has been removed. Login throttling is an in-memory best-effort counter (8 failures per IP in 15 minutes); Vercel serverless instances do not share memory. No Upstash variables or service are required.
- The Preview schema audit confirmed the 14 target tables exist, including `vehicle_documents`, and reviewed the relevant columns/functions/triggers.

## Known limitations / accepted scope

- Sales-photo per-listing ownership is out of scope for this security pass. The dedicated endpoint requires the device session and restricts the `annunci/` photo-key format, but does not enforce per-listing ownership.
- Login throttling is not deployment-wide.
- Profile saves perform sequential database writes and are not transactional; a failure midway can leave partial changes.
- A green build and successful Preview smoke test do not prove production environment configuration or database grants are secure.

## Production rollout blockers

1. Confirm the full PR change scope is intended. The branch is 153 commits ahead of `main` and the PR changes 41 files.
2. Confirm Vercel's Production branch and promotion settings.
3. Confirm these server-side Production variables are configured: `GOLDENCAR_DEVICE_PASSWORD` (at least 12 characters), `GOLDENCAR_SESSION_SECRET` (at least 32 characters), `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`. Never expose the service-role key to browser code.
4. Prepare a controlled release and rollback plan. Do not promote until the release target and environment are confirmed.
5. Export current live Supabase grants/policies and verify the audited functions/triggers against the actual project before mutation.

## Critical shared-database constraint

Preview and Production currently use the SAME Supabase project. Do NOT execute `supabase/security_lockdown.sql` while Production may still run the legacy browser-side Supabase client. The script changes database-wide grants/policies and revokes direct execution of audited functions; applying it too early could break the live workshop app.

## Safe rollout order

1. Confirm the intended PR scope and final source review.
2. Confirm Production environment variables and Vercel deployment/promotion settings.
3. Plan and perform a controlled release of the protected code to Production, with rollback ready.
4. Verify the Production deployment is the protected version and its UI uses the protected `/api/*` routes rather than direct browser-side Supabase table/RPC calls.
5. Export and review the live grants, policies, function and trigger inventory.
6. Only then apply `supabase/security_lockdown.sql` to the intended shared Supabase project in a controlled window.
7. Verify anonymous direct PostgREST table reads/writes and audited RPC execution are denied.
8. Run a focused smoke test on Production: login/logout, vehicle/client profile, job creation/editing/closing, job files/photos, appointments, orders/suppliers, revisions, payments, OCR, and sales photos.
9. If a workflow fails, stop and investigate; do not blindly restore permissive anonymous policies. Use the captured pre-change inventory and the specific rollback plan.

## SQL status

`supabase/security_lockdown.sql` has NOT been executed. It is a mutating transactional script: it enables RLS, drops existing policies on the listed tables, revokes direct privileges from `PUBLIC`, `anon` and `authenticated`, grants table privileges to `service_role`, and revokes execute on audited functions from browser roles. It does not delete application data. Keep the read-only audit output and a rollback plan.

## Login throttling

No external service is configured or required. The per-instance in-memory counter is defense-in-depth only; do not describe it as deployment-wide brute-force protection. The primary controls remain the device password, signed HttpOnly session cookie and in-handler authorization for sensitive APIs.
