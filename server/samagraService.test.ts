import test from 'node:test';
import assert from 'node:assert/strict';
import { isUniqueConstraintError } from './db.js';
import { fetchLiveSamagraDetails, mapExternalSamagraPayload } from './samagraService.js';

test('mapExternalSamagraPayload maps nested portal payload into SamagraFamily', () => {
  const mapped = mapExternalSamagraPayload(
    {
      family: {
        family_id: '45218932',
        head_name: 'Ramesh Verma',
        area_type: 'urban',
        ward_or_block: 'Ward 12 (Vijay Nagar)',
        address: 'Scheme 54, Indore',
        ration_card_type: 'BPL',
        members: [
          {
            member_id: '123456789',
            name: 'Ramesh Verma',
            age: 42,
            gender: 'm',
            category: 'obc',
            occupation: 'Street Vendor',
            ekycVerified: true,
            dbtEnabled: true,
            annual_income: 120000,
          },
        ],
      },
    },
    '45218932'
  );

  assert.ok(mapped);
  assert.equal(mapped.familyId, '45218932');
  assert.equal(mapped.headName, 'Ramesh Verma');
  assert.equal(mapped.rationCardType, 'BPL');
  assert.equal(mapped.source, 'samagra_gov_in');
  assert.equal(mapped.members.length, 1);
  assert.equal(mapped.members[0].memberId, '123456789');
  assert.equal(mapped.members[0].gender, 'male');
  assert.equal(mapped.members[0].category, 'OBC');
  assert.equal(mapped.members[0].dbtActive, true);
});

test('mapExternalSamagraPayload rejects invalid family or empty member payloads', () => {
  assert.equal(mapExternalSamagraPayload(null, '45218932'), null);
  assert.equal(mapExternalSamagraPayload({ familyId: '123', members: [] }, '123'), null);
  assert.equal(
    mapExternalSamagraPayload({ familyId: '45218932', members: [{ memberId: '123', name: 'Bad' }] }, '45218932'),
    null
  );
});

test('fetchLiveSamagraDetails rejects malformed IDs with HTTP 400 before DB or upstream calls', async () => {
  const outcome = await fetchLiveSamagraDetails('12AB');
  assert.equal(outcome.status, 'invalid_format');
  assert.equal(outcome.httpStatus, 400);
  assert.equal(outcome.code, 'INVALID_SAMAGRA_FORMAT');
  assert.equal(outcome.portalUrl, 'https://samagra.gov.in/');
});

test('fetchLiveSamagraDetails explains missing official credentials and offers samagra.gov.in + manual entry', async () => {
  const prevUrl = process.env.SAMAGRA_API_URL;
  const prevKey = process.env.SAMAGRA_API_KEY;
  delete process.env.SAMAGRA_API_URL;
  delete process.env.SAMAGRA_API_KEY;

  try {
    const outcome = await fetchLiveSamagraDetails('99998888');
    assert.equal(outcome.status, 'credentials_not_configured');
    assert.equal(outcome.httpStatus, 404);
    assert.equal(outcome.liveConfigured, false);
    assert.equal(outcome.code, 'SAMAGRA_CREDENTIALS_NOT_CONFIGURED');
    assert.equal(outcome.portalUrl, 'https://samagra.gov.in/');
    assert.equal(outcome.allowManualEntry, true);
    assert.match(outcome.error || '', /SAMAGRA_API_URL/i);
  } finally {
    if (prevUrl !== undefined) process.env.SAMAGRA_API_URL = prevUrl;
    if (prevKey !== undefined) process.env.SAMAGRA_API_KEY = prevKey;
  }
});

test('isUniqueConstraintError recognizes PostgreSQL 23505 and SQLite constraint errors', () => {
  assert.equal(isUniqueConstraintError({ code: '23505', constraint: 'citizen_accounts_email_key' }).isUnique, true);
  assert.equal(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE', message: 'UNIQUE constraint failed: applications.citizen_id' }).isUnique, true);
  assert.equal(isUniqueConstraintError({ code: 'SQLITE_CONSTRAINT', message: 'UNIQUE constraint failed: samagra_members.member_id' }).isUnique, true);
  assert.equal(isUniqueConstraintError({ code: 'ECONNREFUSED', message: 'Connection refused' }).isUnique, false);
});
