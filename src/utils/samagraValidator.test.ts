import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SAMAGRA_PORTAL_URL,
  validateIndianMobile,
  validateSamagraFamilyId,
  validateSamagraLookupId,
  validateSamagraMemberId,
} from './samagraValidator.js';

test('SAMAGRA_PORTAL_URL points to official samagra.gov.in', () => {
  assert.equal(SAMAGRA_PORTAL_URL, 'https://samagra.gov.in/');
});

test('validateSamagraFamilyId enforces strictly 8 numeric digits', () => {
  assert.deepEqual(validateSamagraFamilyId(' 45218932 '), {
    valid: true,
    cleaned: '45218932',
    kind: 'family',
  });

  const empty = validateSamagraFamilyId('');
  assert.equal(empty.valid, false);
  assert.match(empty.error || '', /required/i);

  const alpha = validateSamagraFamilyId('4521ABCD');
  assert.equal(alpha.valid, false);
  assert.match(alpha.error || '', /numeric digits only/i);

  const wrongLen = validateSamagraFamilyId('123456789');
  assert.equal(wrongLen.valid, false);
  assert.match(wrongLen.error || '', /8 digits/i);
});

test('validateSamagraMemberId enforces strictly 9 numeric digits', () => {
  assert.deepEqual(validateSamagraMemberId('123456789'), {
    valid: true,
    cleaned: '123456789',
    kind: 'member',
  });

  const shortId = validateSamagraMemberId('12345678');
  assert.equal(shortId.valid, false);
  assert.match(shortId.error || '', /9 digits/i);

  const symbols = validateSamagraMemberId('12345-6789');
  assert.equal(symbols.valid, false);
  assert.match(symbols.error || '', /numeric digits only/i);
});

test('validateSamagraLookupId accepts 8-digit family or 9-digit member IDs and rejects others', () => {
  assert.deepEqual(validateSamagraLookupId('87654321'), {
    valid: true,
    cleaned: '87654321',
    kind: 'family',
  });
  assert.deepEqual(validateSamagraLookupId('876543210'), {
    valid: true,
    cleaned: '876543210',
    kind: 'member',
  });

  const sevenDigits = validateSamagraLookupId('1234567');
  assert.equal(sevenDigits.valid, false);
  assert.match(sevenDigits.error || '', /8-digit Family ID or a 9-digit Member ID/i);

  const alpha = validateSamagraLookupId('abc12345');
  assert.equal(alpha.valid, false);
  assert.match(alpha.error || '', /numeric digits/i);
});

test('validateIndianMobile enforces +91 prefix and 10 digits starting with 6-9', () => {
  assert.deepEqual(validateIndianMobile('+91 9826012345'), {
    valid: true,
    cleaned: '9826012345',
    e164: '+919826012345',
  });
  assert.deepEqual(validateIndianMobile('9826012345'), {
    valid: true,
    cleaned: '9826012345',
    e164: '+919826012345',
  });
  assert.equal(validateIndianMobile('+91 5826012345').valid, false);
  assert.equal(validateIndianMobile('+91 0123456789').valid, false);
  assert.equal(validateIndianMobile('98260').valid, false);
  assert.equal(validateIndianMobile('').valid, false);
});
