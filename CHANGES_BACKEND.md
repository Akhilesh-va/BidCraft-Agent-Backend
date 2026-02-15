# Backend Changes Summary

This document summarizes all edits made to the `BidCraft-Agent-Backend` repository during the recent integration work. It focuses on the backend changes that were required to make the backend work well with the Android app and development environment, and documents the new behavior, configuration, and debugging helpers.

Everything changed in this list was performed in this development session (chat); keep this file with the repo for future reference.

---

## High-level goals
- Enable CORS and request logging so the Android app (emulator and device) can call the backend and you can debug requests.
- Ensure Firebase Admin initialization is robust and avoid crashing when credentials or GROQ are not present.
- Add safe development shortcuts (dev-token, debug verify, and a dev bypass) to simplify local testing.
- Integrate SRS/profile upload endpoints with the Android app and return structured results to the UI.
- Add a heuristic fallback for Groq-based extraction so uploads don't fail when Groq is rate-limited or unavailable.
- Improve Android <-> backend integration and provide clear instructions for local testing.

---

## Files Added / Modified (backend)
List of backend files that were created or updated during the session (path is relative to repository root).

- `package.json`
  - Added runtime dependencies: `cors` and `morgan` for CORS and request logging.

- `src/app.ts`
  - Enabled `cors` and `morgan` middleware (CORS origin=true; morgan('combined')).
  - Added `requireFirebaseEnv()` startup check to ensure Firebase credentials exist.
  - Switched to lazy-loading route modules after the env check to prevent controllers from initializing before envs are validated.
  - Centralized error handler kept.

- `src/routes/parseRoutes.ts`
  - Protected the SRS overview upload endpoint with `protect` middleware:
    - `POST /api/parse/srs/upload/overview` now requires authentication (or dev bypass).

- `src/routes/authRoutes.ts`
  - Added route: `POST /api/auth/debug-verify` (dev-only) for detailed token verification diagnostics.
  - Existing `POST /api/auth/verify-token` kept.

- `src/controllers/authController.ts`
  - Ensured Firebase admin is initialized just before verifying tokens (moved from module init to call site).
  - Added `debugVerifyToken` controller (dev-only) to return verification diagnostics (errors + decoded claims).
  - `verifyToken` now uses lazy `initFirebase()` and returns decoded firebase claims with the user creation/update logic unchanged.

- `src/controllers/devAuthController.ts`
  - Ensured `initFirebase()` is called lazily (wrapped in try) so controller load doesn't crash when credentials missing.
  - Dev endpoint remains to create custom tokens and exchange for ID tokens when `ENABLE_DEV_AUTH=true`.

- `src/middleware/authMiddleware.ts`
  - Implemented a safe local dev bypass: if `SKIP_FIREBASE_VERIFY=true` in `.env`, the `protect` middleware does NOT call `admin.auth().verifyIdToken` and instead creates/uses a dev user with email taken from `X-DEV-USER-EMAIL` header (defaults to `dev@local`).
  - For normal operation, it still verifies ID token and attaches `req.user`.

- `src/config/firebase.ts`
  - Left logic that initializes Firebase Admin from either:
    - `FIREBASE_SERVICE_ACCOUNT` (JSON string), or
    - `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON).
  - `initFirebase()` returns admin instance and logs successful initialization.

- `src/controllers/groqController.ts`
  - Modified to initialize Groq client lazily and return an early error when key is missing.
  - Avoids throwing at module load time.

- `src/utils/aiAgents.ts`
  - Deferred Groq SDK initialization to avoid startup crash when no API key.
  - Added a robust heuristic fallback extractor (`fallbackProfile`) that builds a conservative company profile JSON when Groq fails, is rate-limited, or returns malformed output.
  - When Groq returns valid JSON, existing parsing logic is used; otherwise the fallback is used and the function returns a structured object.
  - When SDK or HTTP fallback fails, the function now returns fallback rather than throwing, so uploads don't return 500.

- `DEV_SETUP.md`
  - Added development notes describing how to run the backend, how to configure Firebase credentials (file or env), and how to enable the dev bypass.

- `.env` (local edits)
  - Set `GOOGLE_APPLICATION_CREDENTIALS` to an absolute local path (developer-specific) so the server finds the service account reliably.
  - Set `SKIP_FIREBASE_VERIFY=true` (only for local dev convenience; DO NOT set in production).
  - Contains `GROQ_API_KEY`, `GROQ_API_URL`, `MONGO_URI`, `ENABLE_DEV_AUTH`, etc.

---

## New / Changed Endpoints (dev helpers)
- `POST /api/auth/verify-token`
  - Verifies Firebase ID token and creates/updates a user record in MongoDB. Accepts `idToken` in body or Authorization header.

- `POST /api/auth/debug-verify` (dev-only)
  - Requires `ENABLE_DEV_AUTH=true`.
  - Accepts `idToken` and returns either decoded claims or a detailed verification error + stack for debugging.

- `POST /api/auth/dev-token`
  - Dev endpoint to create a Firebase custom token and exchange for an ID token (enabled by `ENABLE_DEV_AUTH=true` and `FIREBASE_WEB_API_KEY`).

- `POST /api/parse/srs/upload/overview`
  - Previously present; now protected by `protect`. Accepts `file` multipart upload.
  - Returns structured SRS JSON. Backend now uses a fallback extractor when Groq fails.

- `POST /api/provider/profile/upload`
  - Accepts company profile PDF and extracts profile using Groq or fallback and persists profile to user.

- `GET /api/provider/profile`
  - Returns stored company profile and user object.

Notes: In local dev with `SKIP_FIREBASE_VERIFY=true` the `protect` middleware will accept requests and create a dev user if required. Use the `X-DEV-USER-EMAIL` request header to set the dev user's email when testing.

---

## Why these changes were required
- The backend crashed early on start when Groq or Firebase credentials were missing; deferring initialization avoids startup failure and allows running the server in limited environments.
- During local testing the Android emulator/device needs CORS + clear, consistent logs; adding `cors` and `morgan` makes debugging straightforward.
- Groq requests may be rate-limited in development; without a fallback uploads would fail with 500. The fallback extractor ensures uploaded files get processed into a usable profile even when the LLM service is unavailable.
- Verifying Firebase tokens early caused tight coupling between controller import-time and env availability. Lazy init and the ability to bypass verification during local dev improved developer UX.

---

## How to run locally (quick)
1. Ensure you have a service account JSON for the Firebase project and DO NOT commit it.
   - Option A: place it at `BidCraftAgentBackend/serviceAccountKey.json` and set `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to that path (absolute recommended).
   - Option B: set `FIREBASE_SERVICE_ACCOUNT` env var to the JSON contents (safer for CI).
2. Install dependencies and run:
   - cd BidCraftAgentBackend
   - npm install
   - npm run dev
3. Use the Android app:
   - Set the app's `server_base_url` to your machine IP (e.g., `http://192.168.1.100:4000/`), rebuild and install on a device on the same network.
4. For local testing without Firebase verification:
   - Set `SKIP_FIREBASE_VERIFY=true` in `.env` (already included during dev).
   - Optionally add header `X-DEV-USER-EMAIL: dev@local` to requests to control the dev user identity.

---

## Important security notes
- NEVER set `SKIP_FIREBASE_VERIFY=true` in production or CI pipelines. This bypasses authentication and should only be used locally.
- Do not commit `serviceAccountKey.json` or `.env` with credentials to git. Use secret management in production.
- The heuristic fallback is intended for resilience in dev or limited production cases; evaluate its accuracy before relying on it in production workflows.

---

If you want, I can:
- Produce a diff or PR summarizing these backend changes.
- Revert any dev-only toggles (SKIP_FIREBASE_VERIFY) before preparing a staging build.
- Expand the heuristic extractor with additional rules or machine-based fallbacks.

