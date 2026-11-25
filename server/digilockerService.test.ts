import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDigiLockerAuthorizeUrl,
  buildDigiLockerRedirectUri,
  computePkceChallenge,
  generateOAuthState,
  generatePkcePair,
  inferCanonicalDocId,
  isDigiLockerOAuthConfigured,
  mapDigiLockerIssuedDocsPayload,
  resolveAppBaseUrl,
} from './digilockerService.js';

test('generatePkcePair produces valid RFC 7636 verifier and S256 challenge', () => {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  assert.ok(codeVerifier.length >= 43);
  assert.equal(computePkceChallenge(codeVerifier), codeChallenge);
  assert.ok(!codeChallenge.includes('='));
  assert.ok(!codeChallenge.includes('+'));
  assert.ok(!codeChallenge.includes('/'));
});

test('generateOAuthState returns unique URL-safe states', () => {
  const a = generateOAuthState();
  const b = generateOAuthState();
  assert.notEqual(a, b);
  assert.ok(a.length >= 32);
});

test('resolveAppBaseUrl prefers APP_URL over request headers', () => {
  const prevAppUrl = process.env.APP_URL;
  process.env.APP_URL = 'https://yojanasetu.example.gov.in/';

  const base = resolveAppBaseUrl({
    protocol: 'http',
    headers: { host: 'localhost:3000' },
  });
  assert.equal(base, 'https://yojanasetu.example.gov.in');
  assert.equal(
    buildDigiLockerRedirectUri(base),
    'https://yojanasetu.example.gov.in/api/auth/digilocker/callback'
  );

  if (prevAppUrl !== undefined) process.env.APP_URL = prevAppUrl;
  else delete process.env.APP_URL;
});

test('buildDigiLockerAuthorizeUrl constructs OAuth 2.0 + PKCE query parameters', () => {
  const url = new URL(
    buildDigiLockerAuthorizeUrl({
      config: {
        clientId: 'dl_client_123',
        clientSecret: 'dl_secret',
        authUrl: 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize',
        tokenUrl: 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token',
        issuedDocsUrl: 'https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued',
      },
      redirectUri: 'https://example.app/api/auth/digilocker/callback',
      state: 'state_abc',
      codeChallenge: 'challenge_xyz',
    })
  );

  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), 'dl_client_123');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.app/api/auth/digilocker/callback');
  assert.equal(url.searchParams.get('state'), 'state_abc');
  assert.equal(url.searchParams.get('code_challenge'), 'challenge_xyz');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
});

test('inferCanonicalDocId maps official doc types and names', () => {
  assert.equal(inferCanonicalDocId({ doctype: 'ADHAR', name: 'Aadhaar Card' }), 'aadhaar');
  assert.equal(inferCanonicalDocId({ doctype: 'CASTE', name: 'Caste Certificate' }), 'caste_cert');
  assert.equal(inferCanonicalDocId({ doctype: 'INCM', name: 'Income Certificate' }), 'income_cert');
  assert.equal(inferCanonicalDocId({ doctype: 'DMCL', name: 'MP Domicile Certificate' }), 'mp_domicile');
  assert.equal(inferCanonicalDocId({ doctype: 'LAND', name: 'Khasra B-1 Record' }), 'khasra_b1');
});

test('mapDigiLockerIssuedDocsPayload deduplicates by doc_uri and skips empty URIs', () => {
  const mapped = mapDigiLockerIssuedDocsPayload(
    {
      items: [
        {
          uri: 'in.gov.uidai-ADHAR-1111',
          name: 'Aadhaar Card',
          doctype: 'ADHAR',
          issuer: 'UIDAI',
          docno: 'XXXX-XXXX-4411',
        },
        {
          uri: 'in.gov.uidai-ADHAR-1111',
          name: 'Duplicate Aadhaar',
          doctype: 'ADHAR',
          issuer: 'UIDAI',
        },
        {
          uri: 'in.gov.mp.edistrict-INCM-9922',
          name: 'Income Certificate',
          doctype: 'INCM',
          issuer: 'MP e-District',
        },
        {
          name: 'Missing URI item',
        },
      ],
    },
    '123456789'
  );

  assert.equal(mapped.length, 2);
  assert.equal(mapped[0].docId, 'aadhaar');
  assert.equal(mapped[0].docUri, 'in.gov.uidai-ADHAR-1111');
  assert.equal(mapped[1].docId, 'income_cert');
});

test('isDigiLockerOAuthConfigured requires DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET', () => {
  const prevId = process.env.DIGILOCKER_CLIENT_ID;
  const prevSec = process.env.DIGILOCKER_CLIENT_SECRET;
  delete process.env.DIGILOCKER_CLIENT_ID;
  delete process.env.DIGILOCKER_CLIENT_SECRET;
  assert.equal(isDigiLockerOAuthConfigured(), false);

  process.env.DIGILOCKER_CLIENT_ID = 'id';
  process.env.DIGILOCKER_CLIENT_SECRET = 'sec';
  assert.equal(isDigiLockerOAuthConfigured(), true);

  if (prevId !== undefined) process.env.DIGILOCKER_CLIENT_ID = prevId;
  else delete process.env.DIGILOCKER_CLIENT_ID;
  if (prevSec !== undefined) process.env.DIGILOCKER_CLIENT_SECRET = prevSec;
  else delete process.env.DIGILOCKER_CLIENT_SECRET;
});

test('dbService.revokeDigiLockerEntry removes both credential and document by cred.id or canonical docId', async () => {
  const { dbService } = await import('./db.js');
  await dbService.init();
  const citizenKey = `test_revoke_${Date.now()}`;
  const credId = `dl_test_${Date.now()}_aadhaar`;
  const credUri = `in.gov.uidai-ADHAR-${Date.now()}`;

  try {
    await dbService.upsertDigiLockerCredential({
      id: credId,
      citizenId: citizenKey,
      docId: 'aadhaar',
      docUri: credUri,
      docName: 'Aadhaar Card',
      docNumber: 'XXXX-XXXX-4411',
      issuer: 'UIDAI',
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
    await dbService.upsertDigiLockerDocument({
      citizenKey,
      docId: 'aadhaar',
      docNumber: 'XXXX-XXXX-4411',
      source: 'digilocker',
      issuer: 'UIDAI',
      verified: true,
      verifiedAt: new Date().toISOString(),
    });

    // Revoking by credential id (as the top synced credentials table does) must also clear digilocker_documents
    const res1 = await dbService.revokeDigiLockerEntry(citizenKey, credId);
    assert.equal(res1.removedCreds, 1);
    assert.equal(res1.removedDocs, 1);
    assert.equal((await dbService.getDigiLockerCredentials(citizenKey)).length, 0);
    assert.equal((await dbService.getDigiLockerDocuments(citizenKey)).length, 0);

    // Re-insert and verify revoking by canonical docId ('aadhaar') also clears both
    await dbService.upsertDigiLockerCredential({
      id: credId,
      citizenId: citizenKey,
      docId: 'aadhaar',
      docUri: credUri,
      docName: 'Aadhaar Card',
      docNumber: 'XXXX-XXXX-4411',
      issuer: 'UIDAI',
      verified: true,
      verifiedAt: new Date().toISOString(),
    });
    await dbService.upsertDigiLockerDocument({
      citizenKey,
      docId: 'aadhaar',
      docNumber: 'XXXX-XXXX-4411',
      source: 'digilocker',
      issuer: 'UIDAI',
      verified: true,
      verifiedAt: new Date().toISOString(),
    });

    const res2 = await dbService.revokeDigiLockerEntry(citizenKey, 'aadhaar');
    assert.equal(res2.removedCreds, 1);
    assert.equal(res2.removedDocs, 1);
    assert.equal((await dbService.getDigiLockerCredentials(citizenKey)).length, 0);
    assert.equal((await dbService.getDigiLockerDocuments(citizenKey)).length, 0);
  } finally {
    await dbService.revokeDigiLockerEntry(citizenKey, credId).catch(() => {});
    await dbService.revokeDigiLockerEntry(citizenKey, 'aadhaar').catch(() => {});
  }
});

