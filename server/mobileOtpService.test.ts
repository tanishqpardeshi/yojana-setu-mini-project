import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecureOtp,
  hashOtp,
  isSmsGatewayConfigured,
  normalizeIndianMobileOrThrow,
  signMobileVerifiedToken,
  verifyMobileVerifiedToken,
  verifyOtpHash,
} from './mobileOtpService.js';

test('normalizeIndianMobileOrThrow accepts valid +91/10-digit Indian numbers and rejects invalid ones', () => {
  const res = normalizeIndianMobileOrThrow('+91 98260-12345');
  assert.equal(res.valid, true);
  assert.equal(res.cleaned, '9826012345');
  assert.equal(res.e164, '+919826012345');

  assert.equal(normalizeIndianMobileOrThrow('+91 4826012345').valid, false);
  assert.equal(normalizeIndianMobileOrThrow('12345').valid, false);
});

test('generateSecureOtp generates random 6-digit numeric strings', () => {
  const samples = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const otp = generateSecureOtp();
    assert.match(otp, /^\d{6}$/);
    samples.add(otp);
  }
  assert.ok(samples.size > 1);
});

test('hashOtp and verifyOtpHash validate matching OTPs and reject wrong or bound-mismatched OTPs', () => {
  const mobile = '+919826012345';
  const otp = '482910';
  const stored = hashOtp(mobile, otp);

  assert.match(stored, /^[a-f0-9]{64}$/);
  assert.equal(verifyOtpHash(mobile, otp, stored), true);
  assert.equal(verifyOtpHash(mobile, '000000', stored), false);
  assert.equal(verifyOtpHash(mobile, '48291', stored), false);
  assert.equal(verifyOtpHash('+919826099999', otp, stored), false);
});

test('signMobileVerifiedToken and verifyMobileVerifiedToken bind proof to mobile number', () => {
  const mobile = '+919826012345';
  const token = signMobileVerifiedToken(mobile, { ttlSeconds: 60 });

  assert.equal(verifyMobileVerifiedToken(token, mobile), true);
  assert.equal(verifyMobileVerifiedToken(token, '+919826012346'), false);
  assert.equal(verifyMobileVerifiedToken(`${token}x`, mobile), false);
  assert.equal(verifyMobileVerifiedToken('malformed', mobile), false);

  const expiredToken = signMobileVerifiedToken(mobile, { ttlSeconds: -5 });
  assert.equal(verifyMobileVerifiedToken(expiredToken, mobile), false);
});

test('isSmsGatewayConfigured returns false when SMS_API_URL or SMS_API_KEY are unset', () => {
  const prevUrl = process.env.SMS_API_URL;
  const prevKey = process.env.SMS_API_KEY;
  delete process.env.SMS_API_URL;
  delete process.env.SMS_API_KEY;
  assert.equal(isSmsGatewayConfigured(), false);

  process.env.SMS_API_URL = 'https://sms.example.test/send';
  process.env.SMS_API_KEY = 'secret-key';
  assert.equal(isSmsGatewayConfigured(), true);

  if (prevUrl !== undefined) process.env.SMS_API_URL = prevUrl;
  else delete process.env.SMS_API_URL;
  if (prevKey !== undefined) process.env.SMS_API_KEY = prevKey;
  else delete process.env.SMS_API_KEY;
});
