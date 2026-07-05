# API Reference

Base URL: `http://localhost:4000/api` (dev) · all responses are JSON.

**Envelope**

```jsonc
// success
{ "ok": true, "data": { /* ... */ } }
// error
{ "ok": false, "error": { "message": "string", "details": {} } }
```

Authenticated routes require `Authorization: Bearer <accessToken>`.

---

## Auth — `/api/auth`

### POST `/login`
Step 1 of login.

```json
{ "email": "admin@antariksha.test", "password": "Admin@123" }
```

- **Member** → returns a full session:
  ```json
  { "twoFactorRequired": false, "accessToken": "...", "refreshToken": "...",
    "user": { "id": "...", "name": "...", "email": "...", "role": "member" } }
  ```
- **Admin** → returns a 2FA challenge (OTP emailed):
  ```json
  { "twoFactorRequired": true, "method": "email", "challengeToken": "..." }
  ```

### POST `/verify-otp`
Step 2 — completes admin login.
```json
{ "challengeToken": "...", "code": "123456" }
```
Returns a full session. After 5 wrong codes the account locks for 15 minutes.

### POST `/resend-otp`
```json
{ "challengeToken": "..." }
```
Rejected with `429` inside the 60-second cooldown.

### POST `/refresh`
```json
{ "refreshToken": "..." }
```
Returns a fresh `accessToken` / `refreshToken`.

### GET `/me`  _(auth)_
Returns the decoded token claims.

### POST `/totp/setup`  _(admin)_
Returns `{ secret, otpauth }` — render `otpauth` as a QR for an authenticator app.

### POST `/totp/confirm`  _(auth)_
```json
{ "code": "123456" }
```
Enables TOTP as the admin's second factor.

---

## Tickets — `/api/tickets`  _(auth)_

### GET `/`
Query params: `status`, `trek`, `search`, `from`, `to`, `page`, `pageSize`,
and (admin only) `memberId`. Members are always scoped to their own tickets.

```json
{ "items": [ /* tickets, with member:{full_name,email} */ ], "total": 42,
  "page": 1, "pageSize": 20 }
```

### POST `/`  _(member)_
```json
{
  "ticketCode": "AV-100231",
  "trekId": "uuid",            // optional; price also resolvable by trekName
  "trekName": "Kudremukh",
  "bookingEmail": "bookings@aranyavihara.test",
  "bookingDate": "2026-06-01",
  "trekDate": "2026-06-15",
  "persons": 3,
  "remarks": "optional"
}
```
Server snapshots the permit price, computes commission (`₹50 × persons`),
rejects duplicate `ticketCode` (`409`), and notifies admins.

### POST `/:id/verify`  _(admin)_
```json
{ "decision": "approved", "remarks": "optional" }   // or "not_confirmed"
```
Approval credits commission and notifies the member. Only valid on tickets that
are `pending_verification`.

---

## Treks — `/api/treks`  _(auth)_

| Method | Path | Role | Body |
|--------|------|------|------|
| GET    | `/`      | any   | — |
| POST   | `/`      | admin | `{ name, permitPrice, isActive? }` |
| PATCH  | `/:id`   | admin | `{ name?, permitPrice?, isActive? }` |

Editing a price does **not** affect existing tickets (they store a snapshot).

---

## Dashboard — `/api/dashboard`  _(auth)_

### GET `/member`
Returns the member summary-card values: `totalTickets, totalPersons,
totalCommissionEarned, totalPaid, currentBalance, workingDays, approvedTickets,
pendingVerification, notConfirmed, cancelled, refundPending, refundCompleted,
avgTicketsPerDay, monthlyEarnings`.

### GET `/admin`  _(admin)_
Returns `{ cards, charts }`. `cards` holds today's KPIs + pending queues + member
counts (today's tickets/persons/permit cost/commission/refund/revenue/expenses,
net profit, monthly revenue, pending verifications/refunds/payments, total &
active members, total/cancelled/replacement tickets). `charts` holds
`dailyTrend`, `monthly`, and `mostBookedTrek` series.

### GET `/insights`  _(auth)_
Rule-based "smart insights" for the dashboard hero (no LLM). Returns
`[{ tone, icon, text }]` — admins get org-wide observations (pending approvals,
overdue refunds, top-revenue trek, weekly refund trend, today's submissions);
members get personal ones (awaiting verification, monthly earnings, approval rate).

---

## Notifications — `/api/notifications`  _(auth)_

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/`          | Latest 50 + `unread` count |
| POST | `/:id/read`  | Mark one read |
| POST | `/read-all`  | Mark all read |

---

## Payments — `/api/payments`  _(auth)_

| Method | Path | Role | Notes |
|--------|------|------|-------|
| POST | `/`           | admin  | Record a payout (see body below). Generates a receipt no. |
| GET  | `/`           | any    | List payments. Members scoped to self; admins may pass `?memberId=`. |
| GET  | `/financials` | admin  | Org-wide per-member `total_earned / total_paid / balance`. |
| GET  | `/ledger`     | any    | A member's ledger; admins may pass `?memberId=`. |

POST body:
```json
{ "memberId": "uuid", "amount": 1500, "paymentDate": "2026-06-27",
  "method": "upi", "referenceNumber": "UTR123", "remarks": "optional" }
```
`method` ∈ `upi | bank_transfer | cash | cheque | other`. Approving commission
minus total payments gives the member balance.

---

## Refunds & cancellations — `/api/refunds`  _(auth)_

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET  | `/`            | any   | Refund list + summary cards. Members scoped to self. |
| GET  | `/preview`     | admin | `?ticketId=&cancellationDate=` → live refund calc, no write. |
| POST | `/cancel`      | admin | `{ ticketId, cancellationDate, remarks? }` → cancels ticket, creates refund. |
| POST | `/:id/complete`| admin | `{ receivedDate }` → marks refund received, ticket `refund_completed`. |

**Refund policy** (days before trek): `≥7 → 100%`, `4–6 → 50%`, `<4 → 0%`.
Expected refund date = cancellation date + 30 days.

---

## Analytics — `/api/analytics`  _(admin)_

### GET `/money-flow`
Returns financial-dashboard `cards` (total permit cost, commission, paid to
members, pending commission, refund amount, gross revenue, net profit, today's
revenue, profit margin) plus `expenseBreakdown`, `monthlySeries`, `dailySeries`
and `trekBreakdown` for the charts.

### GET `/`
Filterable totals — params: `from`, `to`, `trek`, `status`, `memberId`. Returns
`{ tickets, persons, permitCost, commission, netProfit }`.

---

## Users — `/api/users`  _(auth)_

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET   | `/members`      | admin | Members + financial summary (earned/paid/balance). |
| POST  | `/members`      | admin | `{ fullName, email, phone?, password }` → creates a member. |
| PATCH | `/members/:id`  | admin | `{ isActive }` → activate / deactivate. |
| GET   | `/members/:id`  | admin | Full profile: financials, performance (approval rate, avg/day), recent tickets, payments, login history. |
| GET   | `/me`           | any   | The signed-in user's own profile. |
| PATCH | `/me`           | any   | `{ fullName?, phone? }`. |
| POST  | `/me/password`  | any   | `{ currentPassword, newPassword }`. |

---

## Audit logs — `/api/audit`  _(admin)_

### GET `/`
Append-only log with `?entity=`, `?action=`, `page`, `pageSize`. Returns
`{ items: [{ action, entity, entity_id, ip_address, created_at, actor }], total }`.

---

## Settings — `/api/settings`

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/` | any   | Returns all settings as a `key → value` map. |
| PUT | `/` | admin | `{ key, value }` upsert (e.g. `commission_per_person`, `refund_window`, `org`). Audited. |

---

## Reports — `/api/reports`  _(admin)_

### GET `/`
Params: `type` (required), `from`, `to`, `memberId`, `trek`.
`type` ∈ `daily | weekly | monthly | yearly | member | trek | refund | payment | commission`.
Returns `{ type, title, generatedAt, columns, rows, summary }` — `columns`
describe each field (`key`, `label`, `type`) so the client can render and export.

### GET `/csv`
Same params; streams a `text/csv` download. (Excel/PDF are generated client-side
from the JSON in `GET /`.)

---

## Registers — `/api/registers`  _(admin)_

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/originals`     | Original-ticket reference register |
| POST | `/originals`     | `{ ticketCode, bookingEmail, bookingDate, trekDate, persons, permitPrice, status?, remarks? }` |
| GET  | `/replacements`  | Replacement history (with old-ticket member) |
| POST | `/replacements`  | `{ oldTicketId?, oldTicketCode, newTicketCode, bookingEmail, replacementDate, persons, permitCost, remarks? }` — if `oldTicketId` is set, that ticket becomes `replacement_completed` and its owner is notified |

---

## Tickets — Phase 4 additions  _(admin unless noted)_

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/tickets/bulk-verify` | `{ ids[], decision, remarks? }` → `{ succeeded, skipped, ids }` |
| PUT  | `/api/tickets/:id/tags`    | `{ tags: string[] }` |
| GET/POST | `/api/tickets/:id/notes` | Private admin notes |
| GET  | `/api/tickets/:id/timeline` | Lifecycle steps + audit (owner member may read their own) |

Submitting a ticket now also stores **smart-verification `flags`** (duplicate
booking email, same email+trek-date, repeat member submission, unusual person
count/commission) and auto **`tags`**. List supports `?tag=`.

---

## Financial Ledger — `/api/ledger`  _(admin)_

Append-only; rows are auto-posted on approval (permit_cost + commission_earned),
payment (commission_paid), cancellation (refund_expected) and refund completion
(refund_received). A DB trigger blocks UPDATE/DELETE.

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/`            | Filter `type,memberId,from,to`; returns items + per-type `totals`, `inflow`, `outflow`, `net` |
| POST | `/adjustment`  | `{ amount, flow: in\|out, memberId?, referenceNumber?, notes }` — manual entry |

---

## Intelligence — `/api/intel`  _(admin)_

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/assistant/suggestions` | Example questions |
| POST | `/assistant/ask`         | `{ question }` → `{ answer, data, matched }` (intent-based NL, no LLM) |
| GET  | `/activity`              | Humanized live activity feed from the audit log |
| GET  | `/leaderboard`           | Per-member performance + top-earner/approval/active boards |
| GET  | `/top-treks`             | Treks ranked by approved revenue |

---

## Ticket Comments & Correction Requests  _(auth; member scoped to own ticket)_

Chat-style conversation between a member and admins on a ticket. Members cannot
directly edit a ticket — they raise a typed comment; the admin actions it.

| Method | Path | Notes |
|--------|------|-------|
| GET  | `/api/tickets/:id/comments` | Messages (oldest→newest) + conversation `status` + signed attachment URLs |
| POST | `/api/tickets/:id/comments` | `{ type, message(≤500), attachmentPath?, attachmentName? }` |
| POST | `/api/tickets/:id/comments/upload-url` | `{ fileName }` → `{ path, signedUrl }` (client PUTs the file straight to Supabase Storage) |
| POST | `/api/tickets/:id/comments/status` | admin: `{ status: waiting_member\|resolved\|closed\|open }` |
| PATCH| `/api/tickets/comments/:commentId` | edit own message (keeps `edited_at`) |

`type` ∈ `correction_request, ticket_info, booking_issue, cancellation_request,
replacement_request, general_question, other`.
Conversation status follows who spoke last (`waiting_admin` / `waiting_member`),
or an admin-set `resolved` / `closed`. New comments notify the other party.
Attachments (JPG/PNG/PDF, ≤10 MB) live in the private `ticket-attachments` bucket;
reads use 1-hour signed URLs.

---

## Health

`GET /health` → `{ "ok": true, "service": "antariksha-api", "ts": 1719500000000 }`
