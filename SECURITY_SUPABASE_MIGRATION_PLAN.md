# GOLDENCAR security rollout — Supabase migration plan

## Current status — 2026-10-20

The user confirms the current Vercel Preview deployments are green and the tested app workflows work. The latest commits extend the R2 authorization boundary and remove the optional external login-rate-limit dependency. GitHub Actions must be checked for the newest commit before treating the build as verified.

Implemented on `security/device-registration`:
- Browser-side Supabase data operations for the reviewed screens have been moved to server-side APIs using the server-only service-role key.
- Device session checks run in protected API handlers.
- Generic R2 endpoints check persisted vehicle/document/job references before issuing URLs or deleting objects. Sales photos use a dedicated endpoint and SVG content types are rejected.
- Device login uses best-effort per-instance in-memory throttling; it does not require an external rate-limiting service.

Remaining blockers:
1. No external login-limiter setup is required. The in-memory counter is only best-effort across Vercel serverless instances, so do not describe it as deployment-wide brute-force protection.
2. Sales-photo per-listing ownership is intentionally out of scope. The dedicated R2 endpoint protects the `annunci/` namespace with device-session checks and raster-only content types. Do not migrate listings solely for this security pass.
3. Review multi-step profile writes and order/job/payment mutations for consistency and cross-record validation.
4. Confirm Vercel Production branch/promotion settings and prepare rollback.
5. Do not run `supabase/security_lockdown.sql` while Production still uses the same Supabase project and may run legacy browser-side table operations. No lockdown SQL has been executed.

The Preview being green is useful validation of the current app flows, but does not prove the Production branch is migrated or that direct anonymous PostgREST access is blocked. Keep the PR in draft until the blockers and controlled rollout sequence are closed.

---

Status: staging only. No Supabase SQL has been run. This document does not authorize removing existing policies.

## Current findings

The device-session middleware and API-level checks protect the page shell and the API routes that have been updated. This is not sufficient to secure database access: the browser bundle still imports the public Supabase client and sends database queries directly.

The browser-side Supabase client remains initialized in `lib/supabase.ts`. A manual scan of all tracked `.ts`/`.tsx` application pages, components, and API routes on branch `security/device-registration` found no imports of `lib/supabase`, no direct `supabase.from(...)` or `supabase.rpc(...)` calls in UI files, and no hard-coded Supabase REST `/rest/v1` calls. The server APIs now own those database operations. Keep the legacy helper until a final diff review confirms it is unused; do not treat this source scan as proof that Preview runtime and remote database behavior are correct. The original code inventory covered these screens:

| Screen | Tables | Operations found |
|---|---|---|
| Home / dashboard | `vehicles`, `vehicle_clients`, `clients`, `jobs`, `payments`, `appointments`, `orders`, `suppliers` | Reads and mutations migrated to `/api/home` and domain APIs; Preview verification pending |
| Ordini | `orders`, `suppliers`, `vehicles`, `clients`, `vehicle_clients` | Reads; order insert/update/delete; supplier insert |
| Revisioni | `vehicles`, `vehicle_clients`, `clients`, `jobs` | Reads and revision-date update migrated to `/api/revisioni`; Preview verification pending |
| Veicolo | `jobs`, `vehicles`, `clients`, `vehicle_clients`, `vehicle_media` | Reads; client/vehicle updates; media insert/read/delete |
| Scheda lavoro | `jobs`, `orders` | Reads; job insert/update/delete; order insert/update/delete |
| Agenda | `appointments` | Read, insert, update, delete |
| Profilo veicolo | `clients`, `vehicles`, `vehicle_clients`, `vehicle_documents` | Upserts and relation/document writes migrated to protected `POST /api/vehicles`; Preview verification pending |
| Server API | `vehicles`, `clients`, `vehicle_clients` | Protected aggregate read in `/api/vehicles` |

This is a minimum inventory from the currently reviewed pages; before final RLS changes, search the full repository for `supabase.from(`, `supabase.rpc(`, direct `fetch` calls to Supabase REST, and any SQL RPC usage. Table names and operations may change as the UI evolves.

## Progress made in this branch

The Agenda screen now uses the device-session-protected `/api/appointments` endpoint for list/create/update/delete operations. The route requires the server-only `SUPABASE_SERVICE_ROLE_KEY`, validates IDs/descriptions/dates, and fails closed with HTTP 503 if the server configuration is missing. The Vehicle screen's vehicle/client/relation reads and profile updates now use the protected `/api/vehicles` route, which requires the server-only service-role key. Its job history reads use `/api/vehicles/jobs`, and vehicle media metadata list/create/delete use `/api/vehicles/media`. The browser no longer calls Supabase directly from `app/veicolo/page.tsx`. The Revisions screen now loads vehicle revision data and completed jobs through `/api/revisioni`; the Orders screen loads orders, suppliers, vehicles, clients and relations through `/api/orders`. Orders now also supports protected create/update/delete and supplier upsert operations; the Orders page has been moved to those endpoints for its primary order and supplier writes. The Home screen's payment, voice-appointment, order, and supplier mutations now use protected APIs. The Job Sheet's save/update/delete, PDF metadata update, and linked-order sync also use protected APIs. Home data loading now uses protected `/api/home`; Check-in uses `/api/checkin`. Vehicle profile client/vehicle/relation/document writes now use protected `POST /api/vehicles`. All reviewed page-level direct Supabase calls have been migrated; final full-repository scan and Preview verification are still required.

## Recommended architecture

Use a server-only Supabase client with a server-only service-role secret, and expose narrowly scoped application APIs. Do not create a generic endpoint that accepts arbitrary table names, column lists, filters, or operations from the browser: that would turn the device cookie into a broad database proxy.

Each server handler must:
- call `isDeviceRequestAuthorized(request)` itself;
- validate request bodies and constrain fields/operations;
- verify record relationships server-side (e.g. a job belongs to the selected vehicle);
- return only fields needed by the UI;
- avoid returning service-role credentials or upstream secrets;
- handle Supabase errors without leaking secrets or internal configuration.

## Safe migration order

1. Complete the operation inventory for every page and helper.
2. The Agenda and Vehicle read endpoints now use server-only database clients requiring `SUPABASE_URL` (or the existing public URL variable) and `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_` for the service-role key). Configure the key on Preview and test Agenda and vehicle lookup/history before expanding the pattern.
3. Implement domain-specific endpoints: appointments, vehicle/client/relation reads and profile creation/update, vehicle job-history and media metadata, Revisions, Orders, Home aggregate data and Check-in (implemented in branch; Preview verification pending). Run a final full-repository search for browser-side Supabase calls and migrate any remaining helper/component usage.
4. Review every protected API for field validation and relationship checks; address any remaining direct DB operation found by the repository-wide scan.
5. Run the Vercel Preview and verify vehicle lookup/edit, job create/edit/close, job media upload/download/delete, appointments, orders/suppliers, revisions, payments, OCR, and R2.
6. Inspect the live Supabase grants and RLS policies and export them before making changes. Policy names and current grants must be read from the actual project, not guessed.
7. Apply restrictive policies only after the affected browser operations no longer need direct anonymous access.
8. Test direct PostgREST requests using only the anon key: protected reads and writes must fail while the authenticated application workflows continue to pass.
9. Keep a rollback script for the exact policy changes. Do not merge/deploy to production before the acceptance checklist passes.

## SQL safety rules

- Do not run a blanket `REVOKE` or `DROP POLICY` across all public tables.
- Do not disable RLS or expose the service-role key in browser code.
- A signed cookie on the Next.js site does not automatically authenticate a direct PostgREST request.
- Do not apply new policies until every browser operation they affect has been migrated and tested.
- Do not guess policy names or current grants.

## Device login throttling

The device-password endpoint uses a best-effort per-instance in-memory counter: after 8 failed attempts from the same detected IP within 15 minutes, further attempts are temporarily rejected. No external service or additional environment variables are required.

This is defense-in-depth, not a deployment-wide limiter: Vercel serverless instances do not share memory. IP headers must only be trusted when set by the trusted deployment proxy. The primary security controls remain the device password, signed HttpOnly session cookie, and in-handler authorization on every protected API.

## Acceptance checklist

- [ ] No app page can load without a valid device session (except the access screen and public static assets).
- [ ] Every sensitive API validates the device session inside the handler.
- [ ] Device login's best-effort local throttling behavior is understood; deployment-wide throttling is intentionally not configured.
- [ ] All direct browser Supabase operations have been inventoried and migrated or explicitly justified.
- [ ] Preview environment and branch are confirmed separate from production; do not merge PR or promote a deployment before sign-off.
- [ ] The service-role secret exists only in server-side environment variables.
- [ ] RLS/grants have been reviewed from the live Supabase project and backed up.
- [ ] Anonymous direct REST SELECT/INSERT/UPDATE/DELETE tests fail for protected tables.
- [ ] All workshop workflows pass on Preview.
- [ ] SQL rollback steps are documented and reviewed.
- [ ] No changes are deployed to production before the above checks pass.


## Repository-wide source scan (2026-10-19)

A manual scan of all tracked application page/component files and API routes found no `lib/supabase` imports in the UI, no direct browser-side `supabase.from(...)` or `supabase.rpc(...)` calls, and no hard-coded Supabase REST `/rest/v1` calls. The screens call the domain-specific `/api/*` routes instead. `lib/supabase.ts` still defines a public anon client but appears unused in the scanned tracked files; retain it until the final diff/runtime review, then remove it only if no hidden build/tool usage depends on it. GitHub code-search results alone are not considered authoritative.

The API inventory includes device auth, appointments, check-in, Home and Home-data, job reads/writes/payment status, orders/suppliers, manual payments, revision dates, vehicle/profile/client/relation/document operations, vehicle job history/media, OCR/plate recognition, and R2 signing/deletion. The reviewed sensitive routes perform an in-handler device-session check, with the expected exception of the device login/logout endpoint. This is a source review, not an end-to-end test of Preview or a live verification of Supabase grants.

Outstanding compatibility checks remain:
- Verify the Preview database contains `vehicle_documents` with the columns used by `POST /api/vehicles`; no checked-in migration creates that table.
- Test all job/payment/order/appointment flows in Preview against the actual schema and realistic records.
- Review the multi-step profile save: client, vehicle, relation, and document writes are sequential and are not transactional, so a mid-operation error can leave partial changes.
- Review R2 shared-device authorization and deployment-wide login throttling before production rollout.
- Review dependency/runtime compatibility and current package audit findings separately; do not apply automatic breaking upgrades without testing.

Latest checked branch commit `b4b6ffc6ee7648e257ded15325917c0978660498` has passing CI build runs. The read-only SQL audit file is available at `supabase/security_audit_readonly.sql`. Build success does not verify remote database schema, configured Preview secrets, or runtime behavior.

## Additional findings from the latest review

- The device-login endpoint's attempt counter is process-local memory. It is useful as best-effort throttling but is not global across Vercel serverless instances. Before calling the login flow production-ready, add shared rate limiting (for example, a managed KV/Redis provider or an appropriate edge/WAF rule). This requires a separate configuration decision; no provider has been enabled by this code change.
- The protected profile-creation endpoint writes to `vehicle_documents`, but no checked-in migration in this repository defines that table. This does not prove the live Supabase table is absent; verify the actual Preview database schema before relying on this endpoint. Do not remove the write or invent a schema migration without checking the existing table definition and R2 document flow.
- The Home aggregate endpoint now explicitly selects `jobs.lavori` because the Home mapper uses that field as a fallback when structured work details are absent. Runtime verification against the Preview database is still required; a successful TypeScript build does not validate remote table/column names.
- The Vehicle aggregate endpoint now fails explicitly if loading `vehicle_clients` relations fails, instead of silently returning profiles without their client links.

- OCR endpoints `/api/vision` and `/api/vision/plate` require the device session and reject empty/oversized images before invoking Google Vision. Current limits are 15 MiB per image and 30 MiB aggregate for the multi-image vehicle-document request. These are application-level checks; verify real Android photos and cropped images in Preview, and remember that the hosting platform may parse/limit request bodies before the route handler runs.
- R2 signing/deletion endpoints apply route-specific key validation. Vehicle/document/job files require persisted references for reads/deletes; sales photos use a dedicated `annunci/` endpoint with an authorized device session and raster-only content types. For this project, per-listing ownership for sales photos is intentionally out of scope; do not add listing storage or per-listing permissions solely for this security pass.
- `/api/vehicles/media` validates the media key prefix against the supplied vehicle ID and caps declared metadata size at 50 MiB; however, declared size is client-supplied and does not itself enforce the actual R2 upload size. Confirm upload constraints and consistency between R2 objects and metadata in Preview tests.

- The Jobs API allowlists the columns accepted by POST/PATCH before passing values to the service-role Supabase client. This reduces the risk of callers setting unreviewed columns such as ownership/admin-like fields through arbitrary JSON properties. The latest branch build at commit `4231d4afc002ae365de9749e49ee8fa3d67161f9` passed; this confirms compilation only, not Preview runtime/database compatibility.

- The legacy `/api/vision/r2/file` endpoint now validates empty keys and content-type input consistently with the main R2 endpoint. The OCR endpoints now reject empty/oversized image files before invoking Google Vision: 15 MiB per image, with a 30 MiB aggregate limit for the vehicle-document OCR request. Verify real Android photos and cropped images in Preview before rollout.


## Preview schema audit result (2026-10-19)

The read-only schema audit confirms that all 14 targeted tables exist in Preview, including `job_files`, `payments_due`, and `vehicle_documents`. The `vehicle_documents` columns match the fields used by the protected profile endpoint: `id`, `vehicle_id`, `tipo`, `nome`, `r2_key`, and timestamps.

The observed `payments` schema includes `paid_amount`, `description`, `amount`, `status`, `client_id`, and `nome_cliente`; the protected manual-payment endpoint uses these column names. The `jobs` schema includes `manodopera`, `lavori`, `payment_amount`, `payment_paid_amount`, `payment_status`, and `dettagli`, matching the job API allowlist.

Function/trigger review found `set_job_id()` attached to `jobs` as `trg_job_id`; it calls `genera_numero_scheda()`, which updates `job_counter`. Both functions are `SECURITY DEFINER` with `search_path=public, pg_temp`. Preserve the trigger and owner privileges. `set_order_number()` is attached to `orders` and updates `order_counter`; the protected server API uses `service_role`. Timestamp triggers are attached to `clients`, `vehicles`, `vehicle_documents`, `suppliers`, and `orders`.

This audit confirms the reported schema and function definitions, but it does not validate Vercel environment variables or prove runtime behavior. Before running the mutating lockdown, configure Preview secrets and test the protected app workflows against Preview. After applying lockdown in Preview, verify that direct anonymous PostgREST access is denied and the app workflows still succeed. Never run this SQL against production during this staging phase.


## Client-save compatibility fix (2026-10-19)

The Preview constraints audit showed that `clients.codice_fiscale` does not have a unique constraint/index, so `upsert(..., { onConflict: "codice_fiscale" })` could fail with an ON CONFLICT error. The protected `POST /api/vehicles` path was updated on the security branch to look up the client by tax code, update the existing record if found, or insert a new record otherwise. This matches the observed Preview schema without adding a database constraint or altering existing data. The change compiled successfully in GitHub Actions on commit `fee70c90e903116350aaf6ca99a22972cd5709e1` (run https://github.com/pietromarchioro2001/goldencar-app/actions/runs/39230494642). Runtime save/update tests are still required; because there is no unique index, concurrent requests could theoretically create duplicate tax codes, though the expected workshop usage is low-concurrency.


## Updated rollout constraint (2026-10-19)

The Vercel Preview and Production currently use the SAME Supabase project. This changes the rollout order and is a hard safety constraint:

- Do NOT execute `supabase/security_lockdown.sql` against the shared database while Production may still run the legacy browser-side Supabase client. The script revokes direct `anon`/`authenticated` table grants and removes policies; the legacy Production frontend could stop reading/writing data immediately.
- Source review of all tracked `app/api/**/route.ts` files on `security/device-registration` found 17 route handlers: all data, OCR, and R2 handlers perform a device-session check in the handler; `/api/auth/device` is the intentional login/logout exception. Database handlers use server-side `SUPABASE_SERVICE_ROLE_KEY`. The reviewed pages use the protected APIs rather than direct Supabase table/RPC calls.
- This source review does not prove that the currently deployed Production frontend has migrated, nor does it prove runtime security. Do not infer that the shared Supabase database is safe to lock down merely because Preview workflows pass.
- Safe next sequence: (1) complete Preview regression tests and verify the exact branch/commit deployed; (2) review and validate the full PR diff; (3) schedule a controlled Production rollout of the protected API code, with a rollback plan; (4) only after confirming the deployed Production frontend no longer depends on direct anon table access, export current grants/policies and apply the lockdown during a controlled window; (5) verify direct PostgREST denial and every workshop workflow.
- If zero downtime / zero Production risk is required, first create a separate Supabase project for Preview. Until either a separate database or the controlled Production code rollout exists, keep the mutating lockdown unapplied.

The current branch is still a draft PR and must not be merged or promoted automatically. The latest branch head `074f43288c617216d81d5412cb527b7dee07d364` has a successful GitHub Actions build (`39264718967`). This verifies compilation only; manual regression testing of the recent order UI changes and runtime verification against the deployed Preview remain required. A direct web check of the Preview URL was not possible from the available inspection environment, so do not claim that endpoint denial or deployment behavior has been independently reverified.
