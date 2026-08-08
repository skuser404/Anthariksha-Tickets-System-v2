import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  sign2faChallenge,
  signAccessToken,
  signRefreshToken,
  verify2fa,
  verifyAccess,
  verifyRefresh,
  type AccessClaims,
} from '../src/lib/tokens.js';
import { env } from '../src/config/env.js';

const claims: AccessClaims = {
  sub: '00000000-0000-0000-0000-000000000001',
  role: 'admin',
  email: 'admin@antariksha.test',
  name: 'Admin',
  isSuper: true,
};

test('a valid access token round-trips', () => {
  const decoded = verifyAccess(signAccessToken(claims));
  assert.equal(decoded.sub, claims.sub);
  assert.equal(decoded.role, 'admin');
  assert.equal(decoded.isSuper, true);
});

test('refresh and 2FA tokens round-trip', () => {
  assert.equal(verifyRefresh(signRefreshToken(claims.sub)).sub, claims.sub);
  assert.equal(verify2fa(sign2faChallenge(claims.sub)).sub, claims.sub);
});

// The 2FA challenge is issued after the password step but BEFORE the OTP step,
// and is signed with the access secret. If verifyAccess did not check the token
// type it would be accepted as a session token - a complete 2FA bypass.
test('a 2FA challenge token is NOT accepted as an access token', () => {
  const challenge = sign2faChallenge(claims.sub);
  assert.throws(() => verifyAccess(challenge), /expected "access"/);
});

// These two also cross the secret boundary, so they fail on the signature before
// the type check is reached - either rejection is correct.
test('an access token is NOT accepted as a refresh token', () => {
  assert.throws(() => verifyRefresh(signAccessToken(claims)));
});

test('a refresh token is NOT accepted as an access token', () => {
  assert.throws(() => verifyAccess(signRefreshToken(claims.sub)));
});

test('an access token is NOT accepted as a 2FA challenge', () => {
  assert.throws(() => verify2fa(signAccessToken(claims)), /expected "2fa"/);
});

test('a token carrying no type at all is rejected everywhere', () => {
  const untyped = jwt.sign({ sub: claims.sub }, env.jwt.accessSecret, { expiresIn: '5m' });
  assert.throws(() => verifyAccess(untyped));
  assert.throws(() => verify2fa(untyped));
});
