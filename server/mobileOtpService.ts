import crypto from 'node:crypto';
import { getCitizenAuthSecret } from './citizenAuth.js';
import { validateIndianMobile } from '../src/utils/samagraValidator.js';

export const OTP_EXPIRY_MINUTES = 5;
export const OTP_EXPIRY_MS = OTP_EXPIRY_MINUTES * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const OTP_RATE_LIMIT_WINDOW_MINUTES = 15;
export const OTP_RATE_LIMIT_MAX_REQUESTS = 5;

export interface SmsGatewayConfig {
  apiUrl: string;
  apiKey: string;
  senderId?: string;
}

export interface SmsDispatchResult {
  sent: boolean;
  providerStatus?: number;
  error?: string;
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP (never hardcoded).
 */
export function generateSecureOtp(): string {
  const num = crypto.randomInt(100000, 1000000);
  return String(num);
}

/**
 * Computes a salted SHA-256 digest of the OTP bound to the normalized E.164 mobile number.
 */
export function hashOtp(mobileE164: string, otp: string, pepper?: string): string {
  const secret = pepper ?? getCitizenAuthSecret();
  return crypto
    .createHash('sha256')
    .update(`${secret}:${mobileE164.trim()}:${otp.trim()}`)
    .digest('hex');
}

/**
 * Constant-time verification of a user-submitted 6-digit OTP against a stored SHA-256 hash.
 */
export function verifyOtpHash(
  mobileE164: string,
  otp: string,
  storedHash: string,
  pepper?: string
): boolean {
  if (!/^\d{6}$/.test(otp.trim()) || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const candidate = hashOtp(mobileE164, otp, pepper);
  const candidateBuf = Buffer.from(candidate, 'hex');
  const storedBuf = Buffer.from(storedHash.trim(), 'hex');
  if (candidateBuf.length === 0 || candidateBuf.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}

export interface MobileVerificationTokenPayload {
  typ: 'mobile_verified';
  mobile: string;
  iat: number;
  exp: number;
}

function bufferToBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

/**
 * Signs a short-lived HMAC proof that `mobileE164` completed OTP verification.
 */
export function signMobileVerifiedToken(
  mobileE164: string,
  options: { secret?: string; ttlSeconds?: number; nowSec?: number } = {}
): string {
  const secret = options.secret || getCitizenAuthSecret();
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? 1800; // 30 minutes to complete signup/profile save
  const payload: MobileVerificationTokenPayload = {
    typ: 'mobile_verified',
    mobile: mobileE164,
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const payloadB64 = bufferToBase64Url(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const sigB64 = bufferToBase64Url(
    crypto.createHmac('sha256', secret).update(payloadB64).digest()
  );
  return `${payloadB64}.${sigB64}`;
}

/**
 * Verifies that a mobile verification token is valid, unexpired, and matches `expectedMobileE164`.
 */
export function verifyMobileVerifiedToken(
  token: string,
  expectedMobileE164: string,
  options: { secret?: string; nowSec?: number } = {}
): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const secret = options.secret || getCitizenAuthSecret();

  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
    const providedSig = base64UrlToBuffer(sigB64);
    if (
      providedSig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(providedSig, expectedSig)
    ) {
      return false;
    }

    const payload = JSON.parse(
      base64UrlToBuffer(payloadB64).toString('utf-8')
    ) as MobileVerificationTokenPayload;
    const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
    if (payload.typ !== 'mobile_verified') return false;
    if (payload.mobile !== expectedMobileE164) return false;
    if (typeof payload.exp !== 'number' || payload.exp <= nowSec) return false;
    return true;
  } catch {
    return false;
  }
}

export function getSmsGatewayConfig(): SmsGatewayConfig | null {
  const apiUrl = process.env.SMS_API_URL?.trim();
  const apiKey = process.env.SMS_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  const senderId = process.env.SMS_SENDER_ID?.trim() || 'YOJSET';
  return { apiUrl, apiKey, senderId };
}

export function isSmsGatewayConfigured(): boolean {
  return getSmsGatewayConfig() !== null;
}

export function normalizeIndianMobileOrThrow(raw: string): {
  valid: boolean;
  e164: string;
  cleaned: string;
  error?: string;
} {
  const res = validateIndianMobile(raw);
  return {
    valid: res.valid,
    e164: res.e164,
    cleaned: res.cleaned,
    error: res.error,
  };
}

/**
 * Dispatches an OTP via the configured external SMS gateway (MSG91 / Fast2SMS / Twilio-compatible webhook).
 * Never returns a dummy OTP or fakes delivery when unconfigured or unreachable.
 */
export async function sendSmsOtpViaGateway(params: {
  mobileE164: string;
  mobile10Digit: string;
  otp: string;
}): Promise<SmsDispatchResult> {
  const config = getSmsGatewayConfig();
  if (!config) {
    return {
      sent: false,
      error:
        'Live SMS OTP delivery requires SMS gateway credentials (SMS_API_URL, SMS_API_KEY).',
    };
  }

  const message = `Your YojanaSetu Indore verification OTP is ${params.otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share with anyone.`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'X-API-Key': config.apiKey,
        authkey: config.apiKey,
      },
      body: JSON.stringify({
        to: params.mobileE164,
        mobile: params.mobile10Digit,
        numbers: params.mobile10Digit,
        sender_id: config.senderId,
        otp: params.otp,
        message,
        expiryMinutes: OTP_EXPIRY_MINUTES,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return {
        sent: false,
        providerStatus: response.status,
        error: `SMS gateway rejected delivery request with HTTP ${response.status}${
          text ? `: ${text.slice(0, 180)}` : ''
        }`,
      };
    }

    return { sent: true, providerStatus: response.status };
  } catch (err) {
    return {
      sent: false,
      error:
        err instanceof Error
          ? `Failed to reach SMS gateway: ${err.message}`
          : 'Failed to reach SMS gateway.',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
