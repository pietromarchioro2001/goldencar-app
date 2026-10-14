# GOLDENCAR security rollout — Supabase migration plan

Status: staging only. This document does not change Supabase and does not authorize removing existing policies.

## Current findings

The device-session middleware and API-level checks protect the page shell and the API routes that have been updated. This is not sufficient to secure database access: the browser bundle still imports the public Supabase client and sends database queries directly.

The current client-side code has direct Supabase calls in at least these screens:

- `app/home/page.tsx`: clients, vehicles, vehicle_clients, jobs, payments, appointments, orders, suppliers.
- `app/ordini/page.tsx`: orders, suppliers, vehicles, clients and vehicle_clients (the last two are queried in the same data-loading function).
- `app/revisioni/page.tsx`: clients and jobs.
- `app/veicolo/page.tsx`: clients, vehicles, vehicle_media.
- `app/veicolo/scheda/page.tsx`: jobs and orders.

Other screens and components must be audited before RLS policies are tightened. Search the whole repository for `supabase.from(` and `supabase.rpc(`, including helper modules.

## Safe migration order

1. Inventory every table operation (SELECT, INSERT, UPDATE, DELETE, RPC) and the exact fields used by each screen.
2. Create server-side handlers for each required operation. Every handler must independently validate the signed device cookie, validate inputs, and enforce the allowed operation and record scope. Do not treat possession of a vehicle/job ID as authorization.
3. Move browser calls to those handlers and remove direct browser access for the migrated operation.
4. Test each workflow against the Vercel Preview: vehicle lookup/edit, job create/edit/close, job media upload/download/delete, appointments, orders and suppliers, revisions, payments, OCR, and R2.
5. In Supabase, inspect the existing policies and grants before changing anything. Back up/export the current policies. Apply restrictive policies only for tables whose app flows no longer require direct anonymous access.
6. Test both the normal app session and direct REST requests using only the anon key. Unauthenticated reads and writes to protected business tables must fail.
7. Keep a rollback script for the exact policy changes and merge only after the checks pass.

## SQL safety rules

- Do not run a blanket `REVOKE` or `DROP POLICY` across all public tables.
- Do not disable RLS or expose the service-role key in browser code.
- A signed cookie on the Next.js site does not automatically authenticate a direct PostgREST request.
- Do not apply new policies until every browser operation they affect has been migrated and tested.
- Do not guess policy names or current grants. Read the live schema/policies first.

## Device login throttling

The device-password endpoint now includes best-effort per-instance throttling. This is not a global rate limiter: serverless instances do not share memory, and IP headers must only be trusted when set by a trusted proxy. Before treating brute-force protection as complete, add a Vercel/WAF rate limit or a shared-store limiter and test it from the deployed Preview.

## Acceptance checklist

- [ ] No app page can load without a valid device session (except the access screen and public static assets).
- [ ] Every sensitive API validates the device session inside the handler.
- [ ] Device password attempts are throttled by a deployment-wide mechanism.
- [ ] All direct browser Supabase operations have been inventoried and migrated or explicitly justified.
- [ ] RLS/grants have been reviewed from the live Supabase project.
- [ ] Anonymous direct REST SELECT/INSERT/UPDATE/DELETE tests fail for protected tables.
- [ ] All workshop workflows pass on Preview.
- [ ] SQL rollback steps are documented and reviewed.
- [ ] No changes are deployed to production before the above checks pass.
