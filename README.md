# Antariksha Trek Operations & Commission Management System

A private internal portal (≈20–25 members + 2 admins) for tracking trek-permit
submissions, verification, member commissions, payments, cancellations/refunds,
replacements, analytics and reports.

> Members first book permits on the official **Aranya Vihara** website, then
> submit those booking details into this portal. **This is not a public booking site.**

---

## Tech stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React + TypeScript, Vite, Tailwind CSS, shadcn-style UI, Framer Motion, React Router, TanStack Query, Recharts |
| Backend   | Node.js + Express (TypeScript), Zod validation, JWT auth, bcrypt, Helmet, rate limiting |
| Database  | Supabase PostgreSQL (normalized schema + Row-Level Security) |
| Auth      | Email/password + **admin 2FA** (email OTP and optional TOTP authenticator) |
| Email     | Nodemailer (console transport in dev) |
| Deploy    | Frontend → Vercel, Backend → Railway |

---

## Monorepo layout

```
AT TICKET BOKING/
├── package.json            # npm workspaces + dev orchestration
├── README.md
├── docs/
│   └── API.md              # REST API reference
├── supabase/
│   └── migrations/
│       ├── 0001_schema.sql # all tables, enums, triggers, views
│       ├── 0002_rls.sql    # row-level security policies
│       └── 0003_seed.sql   # trek pricing + settings
├── server/                 # Express API
│   ├── src/
│   │   ├── config/env.ts
│   │   ├── lib/            # supabase, tokens, mailer, audit, http
│   │   ├── middleware/     # auth (RBAC), error handling
│   │   ├── routes/         # auth, tickets, treks, dashboard, notifications
│   │   ├── services/       # auth + tickets business logic
│   │   ├── app.ts
│   │   └── index.ts
│   └── scripts/seed.ts     # demo users + sample tickets (bcrypt-hashed)
└── client/                 # React app
    └── src/
        ├── components/     # ui primitives + layout (sidebar, topbar, bell)
        ├── context/        # Auth + Theme providers
        ├── lib/            # api client, utils
        └── pages/          # Login, dashboard, tickets, admin
```

---

## Prerequisites

- Node.js ≥ 18.18
- A Supabase project (free tier is fine) — **or** the Supabase CLI for local Postgres

---

## 1. Database setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run, in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_seed.sql`
3. From **Project Settings → API**, copy the **Project URL** and the
   **service_role** key (server-only secret).

> Using the Supabase CLI instead? `supabase db reset` will apply everything in
> `supabase/migrations/` automatically.

---

## 2. Backend

```bash
cd "AT TICKET BOKING"
npm install                        # installs both workspaces

cp server/.env.example server/.env # then fill in the values
# Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
#           JWT_ACCESS_SECRET, JWT_REFRESH_SECRET

npm --workspace server run seed    # create demo users + sample tickets
npm run dev:server                 # http://localhost:4000
```

Generate strong secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### Email / OTP in development
Leave `SMTP_HOST` empty and admin login OTP codes are **printed to the API
console** (look for the `📧 [DEV EMAIL]` block). Set real SMTP credentials to
send actual mail.

---

## 3. Frontend

```bash
npm run dev:client     # http://localhost:5173
```

Vite proxies `/api` → `http://localhost:4000`, so no client env is needed in dev.

Run both together from the repo root:

```bash
npm run dev            # server + client concurrently
```

---

## Demo accounts (from the seed script)

| Role   | Email                    | Password    | Notes |
|--------|--------------------------|-------------|-------|
| Admin  | `admin@antariksha.test`  | `Admin@123` | Requires email-OTP 2FA at login |
| Member | `ravi@antariksha.test`   | `Member@123`| |
| Member | `asha@antariksha.test`   | `Member@123`| |

**Change these immediately for any real deployment.**

---

## Core business rules

- **Commission** = `₹50 × persons`, credited only when an admin **approves** a ticket.
- **Permit price is snapshotted** onto each ticket at submission time, so editing
  a trek's price never alters historical records.
- **Duplicate ticket IDs are rejected** (app check + DB unique constraint).
- **Records are never deleted** — status transitions preserve full history.
- **Refund rules** on cancellation:
  | Cancel timing (before trek) | Refund |
  |---|---|
  | ≥ 7 days | 100% |
  | 4–6 days | 50% |
  | < 4 days | 0% |
  - Expected refund date = cancellation date + 30 days.
- **Balance** = approved commission − total paid.

---

## Security

- Admin **2FA** (email OTP, 5-min expiry, 60s resend cooldown; optional TOTP app).
- Account **lockout** for 15 min after 5 failed OTP attempts.
- All login attempts logged with IP, user-agent, stage and outcome.
- **RBAC** middleware, JWT access/refresh tokens, bcrypt password hashing.
- Row-Level Security policies as defense-in-depth.
- Helmet, CORS allow-list, global + per-route rate limiting, Zod input validation.
- Audit log for sensitive actions.

---

## Build status / roadmap

**Slice 1 — Foundation + Auth + Tickets:**

- ✅ Full normalized schema for **every** module (tickets, payments, refunds,
  replacements, original tickets, notifications, audit, settings, trek pricing).
- ✅ Auth: member login, **admin 2FA**, refresh, TOTP enrollment, lockout, attempt logging.
- ✅ Member dashboard (12 summary cards), add-ticket (live commission calc, duplicate guard).
- ✅ Admin: verify/reject workflow, trek pricing editor.
- ✅ In-app notifications + bell.

**Slice 2 — Payments, Refunds & Money-Flow analytics:**

- ✅ Payments: admin records payouts (receipt no. auto-generated), member balances
  table, per-member ledger, member "My Earnings" page.
- ✅ Cancellations & refunds: auto refund calc (100/50/0% policy + 30-day expected
  date), live preview, refund dashboard with 5 summary cards + timeline, mark-received.
- ✅ Money-Flow financial analytics with Recharts (revenue/commission/profit bars,
  expense pie, daily-revenue area, revenue-by-trek line) + 8 KPI cards.

**Slice 3 — Reports, Analytics UI & Registers:**

- ✅ Reports: 9 report types (daily/weekly/monthly/yearly/member/trek/refund/payment/commission)
  with on-screen tables, summary totals, and **CSV / Excel / PDF** export
  (server CSV + client-side xlsx & jsPDF).
- ✅ Filterable Analytics page (date / trek / status / member).
- ✅ Original-ticket reference register + Replacement module (auto-fills from the
  linked ticket and marks it `replacement_completed`).

**Phase 2 — Admin command center, members, settings & polish:**

- ✅ Dedicated **Admin Dashboard** (today's KPIs, pending queues, member counts +
  daily-trend / monthly-revenue / most-booked-trek charts); role-based home.
- ✅ **Members** management (create, activate/deactivate, balances) + rich **Member
  Profile** (performance, approval rate, tickets, payments, login history).
- ✅ **Audit Logs**, **Settings** (commission rate, refund rules, org), full
  **Notifications** page, **Profile** page (edit + change password), **Help** page.
- ✅ Topbar **profile dropdown**, Phase-2 sidebar menus, mobile **bottom navigation**.
- ✅ **404** page + global **error boundary**; richer member cards (avg/day, monthly earnings).
- ✅ **Lazy-loaded** route chunks + dynamic-imported export libs (main bundle ~149 KB gzip).
- ✅ **Unit tests** for commission + refund calculations (`npm --workspace server run test`).

### Testing

```bash
npm --workspace server run test   # commission + refund calculation tests (9 passing)
npm run build                     # type-checks + builds both workspaces
```

**Phase 3 — Premium UI/UX:**

- ✅ Runtime **accent-color theming** (blue/purple/emerald/orange/red/pink) via CSS
  variables + **light / dark / auto** mode, all from a navbar theme menu.
- ✅ **Aurora animated background**, 24px liquid-glass panels, gradient borders,
  hover-lift/glow cards, shimmer skeletons, Phase-3 dark palette (#070B14 / #101827).
- ✅ **⌘K / Ctrl-K command palette** for global navigation & quick actions.
- ✅ **Dashboard hero**: animated greeting, live clock, date, and **auto "smart
  insights"** (rule-based — `GET /api/dashboard/insights`).
- ✅ **Animated number counters** on every stat card; **confetti** on ticket submit.

**Phase 4 — Enterprise features & automation:**

- ✅ **Immutable financial ledger** (`ledger_entries`, append-only via DB trigger) —
  auto-posts on approval (permit cost + commission accrual), payment, cancellation
  (refund expected) and refund completion (refund received) + manual adjustments.
- ✅ **Smart verification & duplicate detection** — tickets are flagged on submit
  (duplicate booking email, same email+trek-date, repeat submission, unusual
  person/commission) and auto-tagged; flagged tickets are prioritised in the queue.
- ✅ **Approval queue** with **bulk approve/reject**, **colored tags**, and
  **private admin notes**; click any ticket for a **lifecycle timeline drawer**.
- ✅ **AI Operations Assistant** — floating chat answering natural-language
  questions from live data (today's summary, top earner, overdue refunds, top
  trek, balances, flagged tickets); intent-based, no external LLM.
- ✅ **Leaderboard** (top earners / approvals / approval-rate / most active + top
  treks) and a humanized **Activity Feed** from the audit log.

**Phase 4 (cont.) — gaps closed:**

- ✅ **Calendar view** — month grid with colour-coded bookings/treks/approvals/
  refunds/payments; click a day to see its records.
- ✅ **Smart-notification automation** — in-process scheduler (+ on-demand
  *Run smart checks*) flags stale approvals (>24h), large pending commission,
  due-soon and overdue refunds to admins.
- ✅ **Operational analytics** — approval %, cancellation ratio, avg verification
  time, avg refund time, trek popularity.
- ✅ **Bulk ops** — bulk assign tag + bulk CSV export in the queue.
- ✅ **Security** — optional **member email-2FA**, **login-alert emails**,
  **idle session timeout** (30 min), preferences under Profile → Security.
- ✅ **Backup/export** — admin **JSON database export** + automatic-backup guidance.
- ✅ **Docs** — [ARCHITECTURE](docs/ARCHITECTURE.md), [ER_DIAGRAM](docs/ER_DIAGRAM.md),
  [ADMIN_GUIDE](docs/ADMIN_GUIDE.md), [MEMBER_GUIDE](docs/MEMBER_GUIDE.md),
  [DEVELOPER_GUIDE](docs/DEVELOPER_GUIDE.md) (mermaid diagrams).

**Design system:** clean enterprise look (Stripe/Linear/Vercel-style) — flat
surfaces (light #FFFFFF / cards #F8FAFC; dark bg #0F172A / cards #111827 / sidebar
#020617), thin borders, soft shadows, 16px radius, subtle hover (no glow, no
aurora, no heavy glass). Switchable accent (default blue #2563EB/#3B82F6) + light/
dark/auto.

**Ticket Comments & Correction Requests:** members don't edit tickets directly —
they open a typed, chat-style conversation (correction request, booking issue,
etc.) with **JPG/PNG/PDF attachments** (Supabase Storage, signed URLs, ≤10 MB).
Admins reply, request info, resolve/close; both sides are notified; full history
is preserved (`edited_at`, never deleted). Member **ticket detail page**
(`/tickets/:id`) shows info + timeline + conversation; admins get it in the queue drawer.

**Public site + roles:** a public **landing page** (`/`) with About/Features/How-it-
works/FAQ/Contact and **Member / Admin login** CTAs, plus **Contact, Privacy & Terms**
pages and a footer. Internal dashboards are unreachable without login (logged-out
users hitting `/admin`, `/tickets`, … are redirected to `/login`). SEO is wired:
`robots.txt`, `sitemap.xml`, Open-Graph/meta tags, favicon and the **logo**.

**Super-Admin tier & management:** super-admins (an admin with `is_super`) get an
**Admin Management** page (create/edit/disable/delete admins, promote/demote super —
can't delete yourself or the last super-admin; deletes need password confirmation).
**User Management** gains edit, **password reset** (emailed), and **super-admin-only
permanent delete** with guards (blocked if the member has pending tickets, balance,
or refunds — disable instead). New accounts are **emailed their credentials**.
Members can opt into email-2FA and set a **profile photo** (Supabase Storage). Login
adds a **math CAPTCHA** after repeated failures (on top of rate-limit + lockout).

Run migrations **0001→0008** in order, **then re-seed** so the demo admin becomes a
super-admin: `npm --workspace server run seed`. Tests: `npm --workspace server run
test` (refund/commission/ledger-priority — 11 cases).

**Financial model — calculation & records only (no payment gateway).**
The app never initiates, authorises, or processes money. It only calculates
commission (₹50 × persons), permit cost (price × persons, snapshotted), refund
amounts (100/50/0% by timing) and member balances, and **records** manual
payments and refund-status changes (Pending → Processing → Completed). All
actual transfers happen outside the app. There is **no** Razorpay/Stripe/UPI/
bank integration anywhere in the codebase.

**Deploy:** client → Vercel (`client/vercel.json` ships SPA rewrites + security
headers + caching), API → Railway/Render or Vercel Serverless, DB → Supabase.
See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Licensed MIT ([LICENSE](LICENSE)).

Possible future work: restore-from-backup UI, drill-down charts, browser push,
full PWA offline, multi-step ticket wizard, broader e2e/integration test suite.

See [docs/API.md](docs/API.md) for the REST reference and
[docs/TESTING.md](docs/TESTING.md) for the manual test guide.

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel + Railway instructions.
#   A n t h a r i k s h a - T i c k e t s - s y s t e m  
 