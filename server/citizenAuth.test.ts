import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashCitizenPassword,
  verifyCitizenPassword,
  signCitizenSessionToken,
  verifyCitizenSessionToken,
} from './citizenAuth.js';
import { verifyFirebaseIdToken } from './authMiddleware.js';

const TEST_SECRET = 'unit-test-citizen-secret-key-at-least-32-chars';

test('hashCitizenPassword hashes with unique salts and verifies matching password', async () => {
  const hash1 = await hashCitizenPassword('indore@2026');
  const hash2 = await hashCitizenPassword('indore@2026');

  assert.notEqual(hash1, hash2);
  assert.ok(hash1.startsWith('scrypt$16384$'));
  assert.equal(await verifyCitizenPassword('indore@2026', hash1), true);
  assert.equal(await verifyCitizenPassword('indore@2026', hash2), true);
  assert.equal(await verifyCitizenPassword('wrong-pass', hash1), false);
  assert.equal(await verifyCitizenPassword('indore@2026', 'malformed-hash'), false);
});

test('signCitizenSessionToken & verifyCitizenSessionToken enforce citizen role and detect tampering', () => {
  const nowSec = 1_750_000_000;
  const token = signCitizenSessionToken(
    {
      uid: 'cit_123',
      email: 'Citizen@Example.COM',
      displayName: 'Asha Sharma',
    },
    { secret: TEST_SECRET, ttlSeconds: 3600, nowSec }
  );

  const verified = verifyCitizenSessionToken(token, {
    secret: TEST_SECRET,
    nowSec: nowSec + 100,
  });
  assert.equal(verified.sub, 'cit_123');
  assert.equal(verified.email, 'citizen@example.com');
  assert.equal(verified.role, 'citizen');
  assert.equal(verified.typ, 'citizen_session');

  // Expired token rejected
  assert.throws(
    () => verifyCitizenSessionToken(token, { secret: TEST_SECRET, nowSec: nowSec + 3601 }),
    /expired/
  );

  // Tampered payload (e.g. privilege escalation attempt to role=admin) rejected
  const parts = token.split('.');
  const fakePayload = Buffer.from(
    JSON.stringify({
      typ: 'citizen_session',
      sub: 'cit_123',
      email: 'citizen@example.com',
      displayName: 'Asha Sharma',
      role: 'admin',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  ).toString('base64url');
  assert.throws(
    () => verifyCitizenSessionToken(`${parts[0]}.${fakePayload}.${parts[2]}`, { secret: TEST_SECRET, nowSec }),
    /Invalid citizen session signature/
  );
});

test('citizen HS256 session tokens are strictly rejected by Admin RS256 verifier', async () => {
  const citizenToken = signCitizenSessionToken(
    {
      uid: 'cit_999',
      email: 'tanishqpardeshi9the12102@gmail.com',
      displayName: 'Attempted Escalation',
    },
    { secret: TEST_SECRET, ttlSeconds: 3600 }
  );

  await assert.rejects(
    () => verifyFirebaseIdToken(citizenToken, { projectId: 'demo-proj' }),
    /Unsupported JWT algorithm/
  );
});
