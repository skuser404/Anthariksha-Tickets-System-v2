# Deployment Guide (Vercel + Supabase)

Three pieces: the **client** (Vercel), the **API** (Vercel Serverless *or* a
separate Node host like Railway/Render), and **Supabase** PostgreSQL.

> **Repo layout note.** This monorepo uses `client/` (the spec's `frontend/`) and
> `server/` (the spec's `backend/`). Point each host at the matching subfolder.

> **No payment gateway.** This app never moves money. It only calculates
> commission/permit/refund/balance and records manual payments and refund-status
> updates. There is nothing to configure for payment processing.

---

## 1. Supabase (database + storage)

1. Create a project; copy the **Project URL** and the **service_role** key.
2. SQL Editor → run `supabase/migrations/0001 … 0006` **in order**
   (or `supabase db reset` with the Supabase CLI).
3. Optional: `npm --workspace server run seed` for demo accounts.
4. Project Settings → Database → **enable daily backups** (or schedule `pg_dump`).
   Supabase **Storage** is available for future file uploads (attachments).

---

## 2. Frontend → Vercel

1. Push to GitHub, then **Import Project** in Vercel.
2. **Root Directory:** `client`. Framework preset **Vite** (auto-detected from
   [client/vercel.json](../client/vercel.json), which also sets SPA rewrites,
   security headers, and asset caching).
3. **Environment variable:**
   ```
   VITE_API_URL=https://your-api-host        # the API origin (Railway/Render/Vercel fn)
   ```
4. Deploy. Every push to `main` auto-builds and deploys; previous deployments stay
   available for instant rollback. Preview deployments are created per PR.

`client/vercel.json` already sends: `Content-Security-Policy`, `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS, and
`Cache-Control: immutable` for hashed assets. **Edit the CSP `connect-src`** to
include your real API origin.

---

## 3. API — choose one

### Option A — separate Node host (Railway/Render) *(recommended, used today)*
1. New project from the GitHub repo; **Root Directory:** `server`.
2. Build `npm install && npm run build`; Start `npm run start`.
3. Env vars: see [.env.example](../.env.example) (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `JWT_*`, `CLIENT_ORIGIN`, SMTP…).
4. Copy the public URL into the client's `VITE_API_URL` and the API's `CLIENT_ORIGIN`.

### Option B — Vercel Serverless
The Express app is created by `createApp()` ([server/src/app.ts](../server/src/app.ts)),
so it can be wrapped in a Vercel Node function. Add `server/api/index.ts`:
```ts
import { createApp } from '../src/app.js';
const app = createApp();
export default app; // Vercel adapts an Express app as a serverless handler
```
…and deploy `server/` as a second Vercel project with the same env vars.
**Note:** the in-process smart-notification scheduler doesn't run on serverless —
trigger `POST /api/intel/run-checks` from a **Vercel Cron** instead.

---

## 4. One-click flow (summary)

1. Push code to GitHub.
2. Import the repo into Vercel (Root Directory `client`).
3. Add `VITE_API_URL` (+ deploy the API and its env vars).
4. Click **Deploy**.

---

## 5. Post-deploy checklist

- [ ] `GET https://<api>/health` returns ok.
- [ ] Admin login emails an OTP (check SMTP / spam).
- [ ] Client origin is in the API's `CLIENT_ORIGIN` (comma-separate multiples).
- [ ] CSP `connect-src` includes the API origin.
- [ ] Seeded demo passwords rotated.
- [ ] HTTPS enforced (default on Vercel + Railway).
