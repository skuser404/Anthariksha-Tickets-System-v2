# Manual Testing Guide

Prereq: migrations applied, `npm --workspace server run seed` run, then
`npm run dev` (server + client). Open http://localhost:5173.

---

## 1. Member login (no 2FA)
1. Log in as `ravi@antariksha.test` / `Member@123`.
2. Expect to land on the dashboard with 12 stat cards populated from seed data.

## 2. Admin login (2FA / OTP)
1. Log in as `admin@antariksha.test` / `Admin@123`.
2. The UI switches to the OTP step.
3. **Find the OTP** in the API server console (`📧 [DEV EMAIL]` block).
4. Enter it → admin lands on the dashboard; "Admin" badge + admin nav appear.
5. **Lockout:** enter a wrong code 5 times → account locks for 15 minutes (`423`).
6. **Resend:** the resend link is disabled for 60s, then works.

## 3. Add ticket + duplicate guard
1. As a member, go to **Add Ticket**.
2. Pick a trek → permit total and `₹50 × persons` commission update live.
3. Submit → toast confirms, ticket shows as **Pending Verification**.
4. Submit the **same Ticket ID** again → rejected with a duplicate error (`409`).

## 4. Admin verify workflow
1. As admin → **Verify Tickets** (defaults to the pending filter).
2. **Approve** the member's ticket → status flips to Approved.
3. Re-check the member dashboard → Commission Earned / Balance increase by
   `₹50 × persons`; Approved count +1.
4. **Reject** another ticket (optional reason) → status becomes Not Confirmed;
   the record is retained (never deleted).

## 5. Trek pricing snapshot
1. As admin → **Trek Pricing**; change a trek's price and Save.
2. Open an existing ticket for that trek → its permit price is **unchanged**
   (snapshot). New tickets use the new price.

## 6. Notifications
1. After a member submits a ticket, the admin's bell shows an unread count.
2. After approval/rejection, the member's bell updates. "Mark all read" clears it.

## 7. Security spot-checks
- Hit `GET /api/tickets` without a token → `401`.
- As a member, call `POST /api/tickets/:id/verify` → `403`.
- Rapidly repeat `POST /api/auth/login` → rate limited after 20 tries / 15 min.

---

## API smoke test (curl)

```bash
# Member login
curl -s localhost:4000/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"ravi@antariksha.test","password":"Member@123"}'

# Use the returned accessToken:
TOKEN=...
curl -s localhost:4000/api/dashboard/member -H "authorization: Bearer $TOKEN"
```
