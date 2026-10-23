# Doctor Tracker

A small full-stack app for managing doctors and their patients, with a database-backed analytics dashboard.
Next.js (App Router) frontend, standalone Express + MongoDB API.

> **Status.** Implemented and checked locally: typecheck, lint, builds, 150 backend unit tests, 52 frontend tests.
> Run against a real local MongoDB by the repository owner: `seed:admin`, `seed:demo` and `explain` succeeded, and all 67 integration tests pass. **Not yet verified:** real screenshots and an end-to-end browser pass.
> **Not deployed**; no live URLs exist. See [Verification status](#12-verification-status).

## 1. Overview
Admins manage doctors and patients; viewers have read-only access. Patients are assigned to at most one doctor. The dashboard shows
totals, growth over time, doctors by patient load, specialization breakdown and condition distribution, all computed in MongoDB.

## 2. Tech stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, React Hook Form + Zod, TanStack Query, Recharts, Radix UI, Lucide.
- **Backend:** Node 20+, Express 5, TypeScript, Mongoose 9/MongoDB, Zod, JWT, bcryptjs, Helmet, express-rate-limit, pino.
- **Tests:** Vitest (backend unit + integration with an in-memory MongoDB; frontend with React Testing Library + MSW).

## 3. Repository layout
```
backend/    Express API (src/{config,models,validators,middleware,services,controllers,routes}, scripts/, tests/)
frontend/   Next.js app (src/{app,components,features,hooks,lib,providers}, tests/)
render.yaml Render blueprint for the API (unapplied)
```

## 4. Quick start (local)
Requires Node 20+ and a MongoDB (local or Atlas).
```bash
npm run install:all
cp backend/.env.example backend/.env       # set MONGODB_URI and a JWT_SECRET of 32+ random chars
cp frontend/.env.example frontend/.env.local
cd backend && npm run seed:admin -- --email you@example.com   # prompts for a password
npm run seed:demo                          # optional, synthetic data only
cd .. && npm run dev:backend               # http://localhost:4000
npm run dev:frontend                       # http://localhost:3000
```

## 5. Environment variables
Backend (`backend/.env.example` documents all): `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL` (exact origins, comma-separated),
`COOKIE_SAMESITE` (`lax` locally, `none` for cross-site deploys), `COOKIE_SECURE`, `TRUST_PROXY`, `JWT_EXPIRES_IN_MINUTES`, `LOG_LEVEL`.
The server refuses to start on invalid config. Frontend: `NEXT_PUBLIC_API_BASE_URL` (public values only).

## 6. Scripts
Root: `lint`, `typecheck`, `test`, `build`. Backend: `dev`, `build`, `start`, `test:unit`, `test:integration`, `seed:admin`, `seed:demo`, `explain`.
Frontend: `dev`, `build`, `start`, `lint`, `typecheck`, `test`.
`REQUIRE_DB_TESTS=1` turns a skipped integration suite into a hard failure (use it in CI).

## 7. Architecture and data model
- `Patient.doctor` is a single ObjectId reference (null = unassigned). Doctor patient counts are computed, never stored.
- Search is a **prefix match** over normalized tokens (multikey index); infix search is not supported.
- Lists use server-side filter, sort (allow-listed fields, `_id` tie-breaker), offset pagination (limit ≤ 100) and URL-driven state.
- Dashboard: aggregation pipelines (`$match` → `$group` → `$lookup` after reducing), UTC dates, zero-filled time series.
- Deleting a doctor with patients returns `409 DOCTOR_HAS_PATIENTS` unless `?patients=unassign`; patients are never deleted by it.

## 8. API
Base `/api/v1`; envelope `{success, data}` or `{success:false, error:{code,message,details?}}`.
`POST /auth/login|logout`, `GET /auth/me`; `GET|POST /doctors`, `GET|PATCH|DELETE /doctors/:id`, `GET /doctors/filters`,
`GET /doctors/:id/patients`, `DELETE /doctors/:id/patients/:patientId` (unassign); `GET|POST /patients`, `GET|PATCH|DELETE /patients/:id`;
`GET /dashboard/{overview,trends,doctor-statistics,condition-distribution,recent-activity}`; `GET /health`, `/health/ready`.
OpenAPI is served at `/api/docs` outside production only.

## 9. Security
HttpOnly JWT cookie (HS256, iss/aud/exp checked, server-side revocation via `tokenVersion`, role read from the DB); no public
registration; bcrypt with uniform login failures and rate limits; CSRF via Origin allow-list plus an HMAC `X-CSRF-Token` header;
Zod `.strict()` validation on every input; Helmet; `Cache-Control: no-store`; logs omit query strings and personal data; no secrets in the repo.
Data is synthetic only; this is not a compliance-reviewed medical system.

## 10. Testing
```bash
npm test                    # all workspaces
cd backend && npm run test:integration   # needs a downloadable or local MongoDB
```
Backend integration tests cover auth, CSRF, authorization, CRUD, filtering, pagination, delete semantics and dashboard numbers.

## 11. Deployment (Vercel + Render + Atlas)
`render.yaml` is provided for the API.
1. Atlas M0 cluster, DB user, network access (free Render has no static IP, so `0.0.0.0/0` with a strong DB password).
2. Render web service from `backend/` (build `npm ci && npm run build`, start `npm start`, health `/health`); set the env vars from `render.yaml`.
3. Create the first admin from your machine with `npm run seed:admin` pointed at Atlas.
4. Vercel project from `frontend/` with `NEXT_PUBLIC_API_BASE_URL=https://<api-host>/api/v1`; then set `FRONTEND_URL` on Render to the Vercel origin.
5. Verify: login sets `dt_session` (HttpOnly, Secure, SameSite=None); mutation without CSRF header → 403.
Cross-site cookies: the frontend host and Render are different sites, so a direct browser-to-API cookie is third-party and is dropped by Safari,
Brave and some Chrome/Firefox settings (symptom: login succeeds, then you are signed out immediately). **Recommended setup: same-origin proxy.**
On the frontend host set `API_PROXY_TARGET=https://<api-host>` and `NEXT_PUBLIC_API_BASE_URL=/api/v1` (rebuild), and on Render set
`COOKIE_SAMESITE=lax`, `COOKIE_SECURE=true`, `FRONTEND_URL=https://<frontend-origin>`. The browser then only talks to its own origin, and Next.js forwards `/api/*` to Render.
Note: behind two proxies, per-IP rate limits may see the frontend host's address for all users (acceptable for a demo).
The database name must be present in `MONGODB_URI` (`.../doctor_tracker?...`), otherwise MongoDB uses `test`.
Free Render instances sleep; the first request can take 30-60 s (the UI shows a waking-up notice).

## 12. Verification status
| Item | Status |
|---|---|
| Backend typecheck, lint, build | verified locally |
| Backend unit tests (150) | passing locally |
| Backend integration tests (67) | 67/67 passed on a local MongoDB (run by the repository owner) |
| `seed:admin`, `seed:demo` (24 doctors, 320 patients) | run successfully on a local MongoDB |
| `npm run explain` | run on that dataset; every listed query uses an index (table below) |
| Frontend typecheck, lint, production build | verified locally |
| Frontend tests (52) | passing locally |
| Screenshots, e2e browser flow | **not captured** |
| Deployment | **not deployed** |

Query plans (local MongoDB, 24 doctors / 320 patients, generated by `npm run explain`):

| Query | Winning index | Keys / Docs examined / Returned |
|---|---|---|
| doctors: default list | createdAt_-1__id_-1 | 10 / 10 / 10 |
| doctors: sort by name | nameSort_1__id_1 | 10 / 10 / 10 |
| doctors: filter specialization | specialization_1_createdAt_-1 | 3 / 3 / 3 |
| doctors: prefix search | searchTokens_1 | 4 / 1 / 1 |
| patients: default list | createdAt_-1__id_-1 | 10 / 10 / 10 |
| patients: of one doctor | doctor_1_createdAt_-1 | 13 / 13 / 10 |
| patients: unassigned | doctor_1_createdAt_-1 | 19 / 18 / 10 |
| patients: filter condition | createdAt_-1__id_-1 | 30 / 30 / 10 |
| patients: prefix search | searchTokens_1 | 31 / 12 / 10 |
| agg: top doctors (90d) | doctor_1_createdAt_-1 (covered) | 229 / 0 / 24 |
| agg: patient trend (90d) | createdAt_-1__id_-1 (covered) | 226 / 0 / 226 |
| agg: condition distribution (90d) | createdAt_-1__id_-1, then FETCH | 226 / 226 / 12 |

Timings at this size are not meaningful (all 0-37 ms). The condition-distribution aggregation fetches documents; a compound
`{createdAt, condition}` index would cover it if the dataset grows.

## 13. Known limitations
Prefix-only search; offset pagination (capped at offset 50,000); no refresh tokens (re-login after expiry); no audit log; no password reset or
user management UI (accounts via `seed:admin`); desktop/mobile layouts implemented but not yet checked in screenshots.

## 14. Possible next steps
Run integration tests and `explain` against a real MongoDB; capture screenshots; deploy and record the live checks; cursor pagination;
text search index if infix search is required; audit trail; user administration.
