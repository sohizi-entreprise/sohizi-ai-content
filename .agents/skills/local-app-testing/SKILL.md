---
name: local-app-testing
description: Prepare and sign in to the local Sohizi app with its dedicated test account before carrying out an authorized app test. Use only for localhost development testing.
---

# Local app testing

Use this skill when a task requires signing in to the locally running Sohizi app. It does not authorize actions beyond the test the user assigned.

## Prepare the account

From the repository root, run:

```bash
cd apps/api && bun run src/db/scripts/ensure-local-app-testing.ts
```

The script reads `apps/api/.env` through the API's normal environment loading. It refuses database, auth, or frontend URLs that are not local loopback addresses. It can be run again safely. If the database or app is unavailable, report that and stop rather than using a remote environment.

## Sign in and test

- Open the local frontend configured by `FRONTEND_URL` (normally `http://localhost:3000`).
- Sign in with email `local-user@test.com` and password `testing-agent-password`.
- Use the `test-organisation` organization. The frontend selects an available organization after sign-in if none is active. For direct API testing, set the active organization through Better Auth's `/api/auth/organization/set-active` endpoint using the authenticated session cookie and the organization ID returned by the setup script.
- Confirm the session and active organization before testing authenticated features. Keep any further app actions within the user's requested test.

This account and fixed password are for local development only. Never use them on a remote or production app.
