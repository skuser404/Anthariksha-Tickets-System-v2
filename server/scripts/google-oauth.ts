/**
 * One-time helper: obtain a Google Drive refresh token.
 *
 * Run this when you are using a personal Google account rather than Google
 * Workspace. A service account has no storage quota of its own, so it can only
 * write into a Shared Drive; OAuth makes the files belong to your account and
 * draw on its quota instead.
 *
 *   npm --workspace server run google:oauth
 *
 * Prerequisites in Google Cloud → APIs & Services → Credentials:
 *   Create credentials → OAuth client ID → Web application
 *   Authorised redirect URI: http://localhost:5555/oauth2callback
 *
 * Then set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in server/.env
 * before running this.
 */
import http from 'node:http';
import { google } from 'googleapis';
import { env } from '../src/config/env.js';

const PORT = 5555;
const REDIRECT = `http://localhost:${PORT}/oauth2callback`;

async function main() {
  const { oauthClientId, oauthClientSecret } = env.drive;
  if (!oauthClientId || !oauthClientSecret) {
    console.error('Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in server/.env first.');
    process.exit(1);
  }

  const client = new google.auth.OAuth2(oauthClientId, oauthClientSecret, REDIRECT);
  const url = client.generateAuthUrl({
    access_type: 'offline',      // required to receive a refresh token
    prompt: 'consent',           // force one even if previously granted
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  console.log('\n1. Open this URL in your browser and approve access:\n');
  console.log(url);
  console.log('\n2. Waiting for the redirect…\n');

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = new URL(req.url ?? '/', `http://localhost:${PORT}`);
      if (parsed.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const c = parsed.searchParams.get('code');
      const err = parsed.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<body style="font-family:system-ui;padding:3rem;text-align:center">
           <h2>${c ? 'Authorised — you can close this tab.' : 'Authorisation failed'}</h2>
           <p>${c ? 'Return to your terminal for the refresh token.' : err ?? ''}</p>
         </body>`,
      );
      server.close();
      if (c) resolve(c);
      else reject(new Error(err ?? 'No authorisation code returned'));
    });
    server.listen(PORT);
    setTimeout(() => { server.close(); reject(new Error('Timed out after 5 minutes')); }, 5 * 60_000);
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nNo refresh token returned. Revoke the app at');
    console.error('https://myaccount.google.com/permissions and run this again.');
    process.exit(1);
  }

  console.log('SUCCESS. Add this line to server/.env:\n');
  console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  console.log('Then restart the API and use Settings → Google Drive → Test connection.');
}

main().catch((e) => {
  console.error('Failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
