# Administrator Guide

## Signing in
1. Go to the portal and enter your email + password.
2. A 6-digit code is emailed (in dev it prints to the API server console).
3. Enter the code within 5 minutes. After 5 wrong codes the account locks for 15 minutes.
4. You can additionally enrol an authenticator app via `POST /api/auth/totp/setup`.

## Daily workflow

### 1. Dashboard
Live clock, **smart insights**, today's KPIs and pending queues. The floating
**AI Assistant** (✨, bottom-right) answers questions like *"Show today's summary"*
or *"List refunds pending more than 30 days."* Press **⌘K / Ctrl-K** to jump anywhere.

### 2. Verification Queue (`Ticket Verification`)
- Flagged/duplicate tickets are sorted to the top with a ⚠ icon.
- Tick rows for **bulk approve / reject / assign tag / export CSV**.
- Click any ticket to open the drawer: lifecycle **timeline**, verification
  **flags**, **tags**, and **private notes**. Approve to credit commission and
  post permit-cost + commission to the ledger.

### 3. Payments & Ledger
- **Payment Management**: record a payout (auto-generates a receipt); balances update live.
- **Financial Ledger**: immutable record of every event. Post **manual adjustments**;
  the ledger can never be edited or deleted.

### 4. Refunds
Cancel an approved ticket — the refund is auto-calculated (≥7d 100%, 4–6d 50%,
<4d 0%; expected = cancel + 30 days). Mark refunds received when the money lands.

### 5. Members
Create accounts, enable/disable members, and open a member profile for
performance, ticket/payment history and login history.

### 6. Insight tools
**Money Flow** (financial charts), **Analytics** (approval %, avg verification/refund
time, cancellation ratio, filters), **Leaderboard**, **Activity Feed**, **Calendar**,
**Reports** (CSV/Excel/PDF) and **Audit Logs**.

### 7. Settings
Commission rate, refund rules, organisation details, **manual DB export (JSON)**,
and **Run smart checks now** (stale approvals, due/overdue refunds → admin notifications).
Smart checks also run automatically in the background.

## Good practice
- Review ⚠ flagged tickets before approving.
- Keep refunds moving before their expected date (Calendar + Activity Feed help).
- Export a JSON snapshot before bulk operations; enable Supabase daily backups.
