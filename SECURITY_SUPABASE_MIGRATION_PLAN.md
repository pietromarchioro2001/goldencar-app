# GOLDENCAR security rollout — Supabase migration plan

Status: staging only. No Supabase SQL has been run. This document does not authorize removing existing policies.

## Current findings

The device-session middleware and API-level checks protect the page shell and the API routes that have been updated. This is not sufficient to secure database access: the browser bundle still imports the public Supabase client and sends database queries directly.

The browser-side Supabase client remains initialized in `lib/supabase.ts`, but the reviewed application pages no longer issue direct `supabase.from(...)` or `supabase.rpc(...)` calls after the latest migration commits. The server APIs now own those database operations. A final repository-wide search (including helpers and non-page files) is still required before RLS changes. The original code inventory covered these screens:

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

The device-password endpoint now includes best-effort per-instance throttling. This is defense-in-depth, not a deployment-wide limiter: serverless instances do not share memory, and IP headers must only be trusted when set by a trusted proxy. Before considering brute-force protection complete, configure a deployment-wide rate limit/WAF rule or a shared-store limiter and test it from Preview.

## Acceptance checklist

- [ ] No app page can load without a valid device session (except the access screen and public static assets).
- [ ] Every sensitive API validates the device session inside the handler.
- [ ] Device password attempts are throttled by a deployment-wide mechanism.
- [ ] All direct browser Supabase operations have been inventoried and migrated or explicitly justified.
- [ ] Preview environment and branch are confirmed separate from production; do not merge PR or promote a deployment before sign-off.
- [ ] The service-role secret exists only in server-side environment variables.
- [ ] RLS/grants have been reviewed from the live Supabase project and backed up.
- [ ] Anonymous direct REST SELECT/INSERT/UPDATE/DELETE tests fail for protected tables.
- [ ] All workshop workflows pass on Preview.
- [ ] SQL rollback steps are documented and reviewed.
- [ ] No changes are deployed to production before the above checks pass.


## Additional findings from the latest review

- The device-login endpoint's attempt counter is process-local memory. It is useful as best-effort throttling but is not global across Vercel serverless instances. Before calling the login flow production-ready, add shared rate limiting (for example, a managed KV/Redis provider or an appropriate edge/WAF rule). This requires a separate configuration decision; no provider has been enabled by this code change.
- The protected profile-creation endpoint writes to `vehicle_documents`, but no checked-in migration in this repository defines that table. This does not prove the live Supabase table is absent; verify the actual Preview database schema before relying on this endpoint. Do not remove the write or invent a schema migration without checking the existing table definition and R2 document flow.
- The Home aggregate endpoint now explicitly selects `jobs.lavori` because the Home mapper uses that field as a fallback when structured work details are absent. Runtime verification against the Preview database is still required; a successful TypeScript build does not validate remote table/column names.
- The Vehicle aggregate endpoint now fails explicitly if loading `vehicle_clients` relations fails, instead of silently returning profiles without their client links.

- OCR endpoints `/api/vision` and `/api/vision/plate` require the device session and reject empty/oversized images before invoking Google Vision. Current limits are 15 MiB per image and 30 MiB aggregate for the multi-image vehicle-document request. These are application-level checks; verify real Android photos and cropped images in Preview, and remember that the hosting platform may parse/limit request bodies before the route handler runs.
- The R2 signing/deletion endpoints validate key prefixes (`veicoli/`, `annunci/`) and reject traversal-like `..`, but authorization is at the shared-device level rather than per record/object. Any holder of the device session can request a signed download or deletion for any key in those prefixes. Before production rollout, inspect all existing key conventions and decide whether route-specific prefix constraints or record-ownership checks are feasible without breaking existing vehicle media and sales-ad workflows.
- `/api/vehicles/media` validates the media key prefix against the supplied vehicle ID and caps declared metadata size at 50 MiB; however, declared size is client-supplied and does not itself enforce the actual R2 upload size. Confirm upload constraints and consistency between R2 objects and metadata in Preview tests.

- The Jobs API allowlists the columns accepted by POST/PATCH before passing values to the service-role Supabase client. This reduces the risk of callers setting unreviewed columns such as ownership/admin-like fields through arbitrary JSON properties. The latest branch build at commit `4231d4afc002ae365de9749e49ee8fa3d67161f9` passed; this confirms compilation only, not Preview runtime/database compatibility.

- The legacy `/api/vision/r2/file` endpoint now validates empty keys and content-type input consistently with the main R2 endpoint. The OCR endpoints now reject empty/oversized image files before invoking Google Vision: 15 MiB per image, with a 30 MiB aggregate limit for the vehicle-document OCR request. Verify real Android photos and cropped images in Preview before rollout.
