# Security Preview deployment check

This file exists to trigger a fresh Vercel Preview deployment from `security/device-registration` after the access-control smoke test revealed that the tested deployment did not include `/accesso` and returned vehicle profiles without a session.

Expected routes in this branch include `/accesso` and `middleware.ts` must redirect unauthenticated page requests to `/accesso` and return HTTP 401 for unauthenticated `/api/*` requests.

Do not merge this branch or run `supabase/security_lockdown.sql` until the new Preview deployment is verified with those checks and end-to-end workflows.
