# Developer Guide

## Stack
React 18 + TypeScript + Vite + Tailwind + TanStack Query + Framer Motion +
Recharts (client) · Node + Express + TypeScript + Zod + JWT + bcrypt (server) ·
Supabase PostgreSQL.

## Local setup
```bash
npm install                          # root: installs both workspaces
cp server/.env.example server/.env   # fill SUPABASE_URL, SERVICE_ROLE_KEY, JWT secrets
# Apply supabase/migrations/0001 → 0005 in order (SQL editor or `supabase db reset`)
npm --workspace server run seed      # demo users + sample tickets
npm run dev                          # API :4000 + client :5173
```

## Project layout
```
server/src/
  config/   env loading
  lib/      supabase, tokens, http, audit, mailer, calc, ledger, verification, format
  middleware/ auth (RBAC), error
  routes/   one module per domain (auth, tickets, payments, refunds, ledger,
            analytics, reports, registers, calendar, intel, audit, settings, users…)
  services/ business logic (auth, tickets, payments, refunds, analytics, reports,
            assistant, reporting, calendar, dashboard, insights)
  jobs/     notifications.job (in-process scheduler)
  tests/    node:test unit tests
client/src/
  components/ ui kit, layout, drawers, command palette, AI assistant, charts
  context/    Auth + Theme
  lib/        api client, utils, export, accents
  pages/      member + admin pages (lazy-loaded routes)
```

## Conventions
- **Response envelope**: `{ ok, data }` or `{ ok: false, error: { message, details } }`.
- **Validation**: every body/query parsed with Zod; failures → `422`.
- **Auth**: `requireAuth` + `requireRole('admin')`; the server holds the Supabase
  service-role key (never shipped to the browser).
- **Immutability**: financial events → `lib/ledger.postLedger`; sensitive actions
  → `lib/audit.audit`. The ledger is protected by a DB trigger.
- **Money rules** live in `lib/calc.ts` (pure, unit-tested). Permit price is
  snapshotted onto each ticket; changing trek pricing never rewrites history.

## Adding an endpoint
1. Add/extend a `*.service.ts` with the logic (+ Zod schema).
2. Add a route in the matching `*.routes.ts` (auth + role + `asyncHandler`).
3. Mount it in `src/app.ts` if it's a new module.
4. Document it in `docs/API.md`; add a unit test if it contains pure logic.

## Tests
```bash
npm --workspace server run test   # node:test — calc + refund + ledger-priority
```
Add new pure logic to `lib/*` so it stays I/O-free and testable.

## Build / deploy
```bash
npm run build                     # server tsc → dist, client vite → dist
```
See [DEPLOYMENT.md](DEPLOYMENT.md) (Railway API + Vercel client + Supabase).

## Background jobs
`jobs/notifications.job.ts` runs on boot and every 6h (and via
`POST /api/intel/run-checks`). For multi-instance deployments move this to an
external scheduler/cron hitting the endpoint so it runs once per interval.
