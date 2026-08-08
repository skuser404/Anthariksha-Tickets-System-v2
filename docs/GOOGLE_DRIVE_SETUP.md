# Google Drive Setup Guide

Ticket permit documents (PDF / JPG / PNG) are stored in Google Drive, not in
Supabase Storage. This guide takes you from a blank Google Cloud account to a
working upload.

Budget about 15 minutes. You need a Google account and admin access to the
Render service.

---

## The one thing that trips everyone up

**Use a Shared Drive, not a folder in your personal My Drive.**

A service account is not a person and has **no storage quota of its own**. When
it uploads into a My Drive folder, the bytes must be billed to *someone's*
quota — and the service account has none. The upload fails with:

```
storageQuotaExceeded: Service Accounts do not have storage quota
```

Files in a **Shared Drive** are owned by the drive itself, so there is no
personal quota to charge. The Settings page detects which kind you configured
and warns you if it is a My Drive folder.

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>
2. Click the project dropdown (top-left) → **New Project**
3. Name it e.g. `antariksha-drive` → **Create**

## 2. Enable the Drive API

1. In that project, open **APIs & Services → Library**
2. Search for **Google Drive API**
3. Click it → **Enable**

If you skip this, every call fails with `Google Drive API has not been used in
project … before or it is disabled`.

## 3. Create a service account

1. **APIs & Services → Credentials → Create credentials → Service account**
2. Name it e.g. `antariksha-uploader` → **Create and continue**
3. Skip the optional role/user grants → **Done**
4. Click the new service account → **Keys** tab → **Add key → Create new key**
5. Choose **JSON** → **Create**. A `.json` file downloads — this is a
   **secret**. Never commit it.

The JSON looks like:

```json
{
  "type": "service_account",
  "project_id": "antariksha-drive",
  "private_key_id": "…",
  "private_key": "-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n",
  "client_email": "antariksha-uploader@antariksha-drive.iam.gserviceaccount.com",
  …
}
```

Note the `client_email` — you need it in the next step.

## 4. Create the Shared Drive and share it

1. Open <https://drive.google.com/> → **Shared drives** → **+ New**
2. Name it e.g. `Antariksha Ticket System`
3. Open it → **Manage members**
4. Add the service account's `client_email` as **Content manager**
5. Open the drive (or a folder inside it) and copy the ID from the URL:

```
https://drive.google.com/drive/folders/0ABcDeFgHiJkLmNoPQ
                                       └─────────────────┘
                                          this is the ID
```

## 5. Configure the API server

Set two environment variables on Render (**Dashboard → your service →
Environment**):

| Variable | Value |
| --- | --- |
| `GOOGLE_DRIVE_CREDENTIALS` | The **entire JSON** from step 3, on one line. Base64 is also accepted. |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | The folder ID from step 4 (optional — the Settings page can set it instead). |

Two ways to supply the JSON:

**Raw JSON** — paste the file contents. Escaped `\n` inside `private_key` is
handled automatically.

**Base64** (easier to paste, avoids newline mangling):

```bash
# macOS / Linux
base64 -w0 service-account.json

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

> The private key is deliberately **not** stored in the database. A key in a
> settings table is readable by anything with DB access and ends up in every
> backup. Only the folder ID and non-secret status live in `settings`.

## 6. Verify

1. Redeploy / restart the API so it picks up the new environment
2. Sign in as a **super-admin** → **Google Drive** in the sidebar
3. Paste the folder ID if you did not set the env var → **Save & verify**
4. Click **Test connection**

A healthy result shows:

- **Connected**
- Drive type: **Shared Drive ✅**
- Service account email
- Storage used

---

## Folder structure

Folders are created on demand and **reused** if they already exist:

```
<root folder>/
└── 2026/
    └── August/
        └── 09-08-2026 - Kudremukh Trek/
            └── Sunil Kumar/
                ├── Ticket.pdf
                └── _archived/
                    └── 2026-08-05-11-30-00 Ticket.pdf
```

- Month is the full English name; the date folder is `DD-MM-YYYY - Trek Name`
- Replacing a permit moves the old file into `_archived/` with a timestamp
  prefix — nothing is deleted, so version history survives
- Concurrent submissions cannot create duplicate folders: a create that loses
  the race is detected, removed, and the older folder is used

## What gets stored in the database

`ticket_documents` records, per version:

| Column | Meaning |
| --- | --- |
| `drive_file_id` | Drive file ID |
| `drive_file_url` | `webViewLink` |
| `drive_folder_id` / `drive_folder_url` | Containing folder |
| `file_name`, `mime_type`, `file_size` | File metadata |
| `checksum` | Drive MD5 — used to detect the same file on another ticket |
| `version`, `is_current`, `archived_at` | Version history |
| `uploaded_by`, `uploaded_at` | Who and when |

## Document preview

Permits live in a private folder, so a raw Drive link 404s for the admin's own
Google identity. The API streams the file instead:

1. Client calls `POST /api/tickets/:id/documents/:docId/view-token`
2. Server returns a **5-minute token scoped to that one document**
3. Client renders `GET /api/tickets/:id/documents/:docId/content?t=…` in an
   `<iframe>` (PDF) or `<img>` (JPG/PNG)

An `<iframe>` cannot send an `Authorization` header, which is why the credential
is in the query string — and why it is narrowly scoped and short-lived rather
than a full session token.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Google Drive is not configured` | `GOOGLE_DRIVE_CREDENTIALS` unset or empty on the API server. |
| `GOOGLE_DRIVE_CREDENTIALS is not valid JSON` | Pasted a file path instead of contents, or the JSON was truncated. Try base64. |
| `storageQuotaExceeded` | Uploading into My Drive. Move to a **Shared Drive** (see top of this page). |
| `File not found: <id>` | Folder ID wrong, or the folder was never shared with the service account. |
| `can see the folder but cannot add files` | Service account has Viewer/Commenter. Change to **Content manager**. |
| `Drive API has not been used in project` | Step 2 was skipped. Enable the Drive API. |
| `invalid_grant: Invalid JWT Signature` | The key was rotated/deleted, or `private_key` newlines were mangled. Re-download the key and use base64. |
| Preview shows *"Document link has expired"* | The 5-minute view token lapsed. Close and reopen the ticket. |
| Upload rejected as *"not really a PDF"* | Magic-byte check failed — the file is corrupt or renamed from another format. |

## Rotating the key

1. Create a new JSON key on the same service account
2. Update `GOOGLE_DRIVE_CREDENTIALS` and restart the API
3. Super-admin → Google Drive → **Reconnect**, then **Test connection**
4. Delete the old key in Google Cloud

Existing files are unaffected — they belong to the Shared Drive, not the key.
