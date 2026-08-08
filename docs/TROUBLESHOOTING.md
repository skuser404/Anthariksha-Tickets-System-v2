# Troubleshooting Guide

Real failure modes for this codebase, with the exact error text you will see.

---

## Database & migrations

### `ERROR: 42710: trigger "trg_users_updated" for relation "users" already exists`

You are re-running `0001_schema.sql` after a partial run. As of the current
version every trigger is guarded with `drop trigger if exists`, so **`0001` is
safe to re-run from the top**. If you still see this, you are running an older
copy of the file — pull the latest and retry.

Run the migrations strictly in order: `0001` → `0002` → … → `0011`. Later files
alter tables that earlier files create.

### Every query fails / `fetch failed` / `TypeError: Invalid URL`

`SUPABASE_URL` is almost certainly the **dashboard** URL. It must be the API URL:

```diff
- SUPABASE_URL=https://supabase.com/dashboard/project/abcdefghijklmnop   # wrong
+ SUPABASE_URL=https://abcdefghijklmnop.supabase.co                      # right
```

The project ref is the same in both — only the host differs.

### `Missing required environment variable: JWT_ACCESS_SECRET` on startup

Intentional. When `NODE_ENV=production` the server refuses to boot rather than
fall back to the well-known development secrets (anyone could forge admin JWTs
with them). The message names the missing variable. Set it and redeploy.

In development the fallbacks apply and the server starts with no `.env` at all.

### `relation "ticket_documents" does not exist`

Migration `0011` has not been applied. It is the one that adds Google Drive
document storage.

---

## Authentication

### Admin login never arrives — no OTP email

Admins always require a second factor. With `SMTP_HOST` empty, `sendMail` falls
back to a console transport: **the 6-digit code is printed to the API server
log**, not emailed.

- Locally: read it from the terminal running `npm run dev`.
- On Render: it is in the service logs — workable but unpleasant. Configure SMTP.

Members do not need OTP unless they enable it in Profile → Security.

### `Please wait 47s before requesting another code`

Resend cooldown (`OTP_RESEND_SECONDS`, default 60). Working as intended.

### `Too many attempts. Account locked for 15 minutes.`

Five bad OTPs (`OTP_MAX_ATTEMPTS`) locks the account for
`ACCOUNT_LOCK_MINUTES`. To clear it early:

```sql
update users set failed_otp_count = 0, locked_until = null where email = '…';
```

### `Invalid or expired token` immediately after logging in

Access tokens carry an explicit `type` claim and each verifier accepts only its
own type. If you upgraded mid-session, old tokens without the claim are
rejected. Log out and back in — refresh tokens issued before the change still
work, so most sessions recover on their own.

### Logged in, but every request 401s and the UI still looks signed in

Fixed in the current version: a rejected refresh token now clears the cached
user and redirects to `/login`. If you see it, clear site data for the origin.

---

## Google Drive

### `storageQuotaExceeded: Service Accounts do not have storage quota`

The single most common Drive failure. The target folder lives in someone's
**My Drive**. Service accounts have no personal storage, so they cannot own
files there.

Fix: create a **Shared Drive**, move the folder into it, and share it with the
service-account email as **Content manager**. See
[GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md).

### `Google Drive is not configured (GOOGLE_DRIVE_CREDENTIALS is unset)`

The env var is missing on the API server. On Render it must be set in the
dashboard — `render.yaml` marks it `sync: false`, so it is never committed.

### `GOOGLE_DRIVE_CREDENTIALS is not valid JSON`

The service-account key got mangled in transit — usually the `private_key`
newlines. Base64-encode the whole file instead; the server accepts either form:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\service-account.json"))
```

### `File not found` / 404 when the service account reads the folder

The folder ID is wrong, or it was never shared with the service account. A
service account sees **nothing** by default. Confirm on
Settings → Google Drive → **Test connection**.

### "The service account can see the folder but cannot add files to it"

Shared with **Viewer** or **Commenter**. Change to **Content manager**
(Shared Drive) or **Editor** (folder share).

### Document preview shows "Document link has expired — reopen the ticket"

Preview URLs carry a 5-minute, single-document token because an `<iframe>`
cannot send an `Authorization` header. Closing and reopening the ticket mints a
fresh one. The client auto-refreshes it every 4 minutes while the drawer is
open, so this only appears on a stale tab.

### Duplicate folders appearing in Drive

Should not happen: folder creation re-queries after a lost race and keeps the
oldest folder. If you see duplicates, they almost certainly predate the current
version, or were created by hand. Merge them manually — the app will reuse
whichever it finds oldest.

---

## Uploads

| Error | Cause |
|---|---|
| `Unsupported file type "…"` | Only PDF, JPG, PNG are accepted |
| `File is too large (max 10 MB)` | Hard limit, enforced client- and server-side |
| `File appears corrupt or is not really a PDF` | Magic-byte check failed — the extension lies about the contents |
| `Upload rejected: Unexpected field` | Form field must be named `file` |

### "Ticket was saved, but the permit upload failed"

Deliberate: the ticket is created first, then the document is attached. A Drive
outage does not lose the member's data entry — reopen the ticket and upload the
permit again.

---

## Approvals

### `Cannot approve — 2 check(s) failed: …`

The pre-approval checklist runs **server-side**, so it cannot be clicked past.
Fix the underlying issue (usually a missing permit or a duplicate ticket code),
or approve with an explicit override and written justification — the override is
recorded in the audit log.

### `A reason is required when rejecting a ticket`

Rejections must tell the member what to fix. Applies to bulk rejection too.

---

## Frontend / build

### Blank page after deploying to Vercel

Almost always **Root Directory** was not set to `client`.

### CORS errors in the browser console

`CLIENT_ORIGIN` on the API does not match the Vercel URL. It accepts a
comma-separated list. Redeploy the API after changing it.

### API calls 404 against the Vercel domain

`VITE_API_URL` is unset, so the client falls back to a relative `/api` (correct
for local dev, wrong in production). Set it to the API origin — **no trailing
slash and no `/api` suffix**; the client appends that itself.

### `npm run lint` fails with "eslint is not recognized"

Dependencies are not installed. Run `npm install` at the repo root — this is an
npm workspace, so install from the root, not from `client/` or `server/`.

---

## Diagnostics

```powershell
# API alive?
curl https://your-api.onrender.com/health

# Full local check
npm run build
npm run lint
npm --workspace server run test
```

`/health` returns `{"ok":true,"service":"antariksha-api","ts":…}` and requires
no authentication, which makes it safe for uptime monitoring.
