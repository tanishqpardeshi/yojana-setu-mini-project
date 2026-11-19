import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  evaluateAdminAuthorization,
  verifyFirebaseIdToken,
} from './authMiddleware';

const TEST_PROJECT_ID = 'yojanasetu-test-proj';
const TEST_KID = 'test-key-1';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function base64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signTestJwt(
  payload: Record<string, unknown>,
  headerOverrides: Record<string, unknown> = {},
  signingKey: string = privateKey
): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: TEST_KID, ...headerOverrides };
  const h = base64Url(JSON.stringify(header));
  const p = base64Url(JSON.stringify(payload));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${h}.${p}`);
  signer.end();
  const sig = base64Url(signer.sign(signingKey));
  return `${h}.${p}.${sig}`;
}

const getTestCerts = async () => ({ [TEST_KID]: publicKey });

test('verifyFirebaseIdToken accepts valid RS256 token and evaluates admin custom claim', async () => {
  const nowSec = 1800000000;
  const token = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: 'admin-uid-001',
    iat: nowSec - 60,
    auth_time: nowSec - 60,
    exp: nowSec + 3600,
    email: 'officer@indore.gov.in',
    email_verified: true,
    role: 'admin',
  });

  const payload = await verifyFirebaseIdToken(token, {
    projectId: TEST_PROJECT_ID,
    nowSec,
    getCerts: getTestCerts,
  });
  assert.equal(payload.sub, 'admin-uid-001');

  const principal = await evaluateAdminAuthorization(payload, token, {
    allowlistEmails: [],
    checkFirestoreAdmin: async () => false,
  });
  assert.equal(principal.role, 'admin');
  assert.equal(principal.adminSource, 'custom_claim');
});

test('evaluateAdminAuthorization rejects normal citizen and spoofed unverified admin email', async () => {
  const nowSec = 1800000000;

  // Normal verified citizen
  const citizenToken = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: 'citizen-uid-002',
    iat: nowSec - 60,
    auth_time: nowSec - 60,
    exp: nowSec + 3600,
    email: 'citizen@example.com',
    email_verified: true,
    role: 'citizen',
  });

  const citizenPayload = await verifyFirebaseIdToken(citizenToken, {
    projectId: TEST_PROJECT_ID,
    nowSec,
    getCerts: getTestCerts,
  });
  const citizenPrincipal = await evaluateAdminAuthorization(citizenPayload, citizenToken, {
    allowlistEmails: ['admin@indore.gov.in'],
    checkFirestoreAdmin: async () => false,
  });
  assert.equal(citizenPrincipal.role, 'citizen');

  // Spoofed admin email with email_verified: false MUST be rejected
  const spoofToken = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: 'spoof-uid-003',
    iat: nowSec - 60,
    auth_time: nowSec - 60,
    exp: nowSec + 3600,
    email: 'admin@indore.gov.in',
    email_verified: false,
  });
  const spoofPayload = await verifyFirebaseIdToken(spoofToken, {
    projectId: TEST_PROJECT_ID,
    nowSec,
    getCerts: getTestCerts,
  });
  const spoofPrincipal = await evaluateAdminAuthorization(spoofPayload, spoofToken, {
    allowlistEmails: ['admin@indore.gov.in'],
    checkFirestoreAdmin: async () => true,
  });
  assert.equal(spoofPrincipal.role, 'citizen');
});

test('verifyFirebaseIdToken rejects expired, wrong-audience, and tampered tokens', async () => {
  const nowSec = 1800000000;

  const expiredToken = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: 'uid-expired',
    iat: nowSec - 7200,
    exp: nowSec - 10,
  });
  await assert.rejects(
    () => verifyFirebaseIdToken(expiredToken, { projectId: TEST_PROJECT_ID, nowSec, getCerts: getTestCerts }),
    /expired/i
  );

  const wrongAudToken = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: 'other-project',
    sub: 'uid-aud',
    iat: nowSec - 60,
    exp: nowSec + 3600,
  });
  await assert.rejects(
    () => verifyFirebaseIdToken(wrongAudToken, { projectId: TEST_PROJECT_ID, nowSec, getCerts: getTestCerts }),
    /audience/i
  );

  // Tamper payload after signing
  const validToken = signTestJwt({
    iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
    aud: TEST_PROJECT_ID,
    sub: 'citizen-uid',
    iat: nowSec - 60,
    exp: nowSec + 3600,
    role: 'citizen',
  });
  const parts = validToken.split('.');
  const forgedPayload = base64Url(
    JSON.stringify({
      iss: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
      aud: TEST_PROJECT_ID,
      sub: 'citizen-uid',
      iat: nowSec - 60,
      exp: nowSec + 3600,
      role: 'admin',
    })
  );
  const tamperedToken = `${parts[0]}.${forgedPayload}.${parts[2]}`;
  await assert.rejects(
    () => verifyFirebaseIdToken(tamperedToken, { projectId: TEST_PROJECT_ID, nowSec, getCerts: getTestCerts }),
    /signature/i
  );
});
