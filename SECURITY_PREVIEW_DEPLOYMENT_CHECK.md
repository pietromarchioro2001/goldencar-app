# Security Preview deployment check

## Current result — 2026-10-20

The user has tested the current Preview workflows and confirms that the app functions. The latest checked branch commit before this note had successful GitHub Actions build and Vercel Preview deployment status. Follow-up documentation commits may trigger a new Preview deployment; verify the latest branch head's CI/deployment status before release.

Expected security behavior:
- `/accesso` is reachable without a session.
- Unauthenticated page requests redirect to `/accesso`.
- Unauthenticated `/api/*` requests return HTTP 401, except the device login endpoint.
- Sensitive API handlers independently validate the signed device session.

## Release safety

PR #1 remains draft and unmerged. Do not execute `supabase/security_lockdown.sql` until the protected code has been deployed to Production and verified there. Preview and Production currently share the same Supabase project; applying the database lockdown before Production stops relying on browser-side anonymous table access could break the live app.

Before production rollout, confirm the full PR scope, required server-side Vercel environment variables, Production branch/promotion settings, and rollback plan. After the protected Production deployment is verified, export live grants/policies and function/trigger inventory before applying the lockdown. Then test anonymous PostgREST denial and the workshop workflows.

No Supabase lockdown SQL has been executed.
