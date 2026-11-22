import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'node:crypto';
import http from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dbService, isUniqueConstraintError } from './server/db.js';
import { requireAdmin } from './server/authMiddleware.js';
import {
  hashCitizenPassword,
  requireCitizenAuth,
  signCitizenSessionToken,
  verifyCitizenPassword,
} from './server/citizenAuth.js';
import { fetchLiveSamagraDetails } from './server/samagraService.js';
import {
  generateSecureOtp,
  hashOtp,
  isSmsGatewayConfigured,
  normalizeIndianMobileOrThrow,
  OTP_EXPIRY_MINUTES,
  OTP_EXPIRY_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_LIMIT_MAX_REQUESTS,
  OTP_RATE_LIMIT_WINDOW_MINUTES,
  OTP_RESEND_COOLDOWN_SECONDS,
  sendSmsOtpViaGateway,
  signMobileVerifiedToken,
  verifyMobileVerifiedToken,
  verifyOtpHash,
} from './server/mobileOtpService.js';
import {
  buildDigiLockerAuthorizeUrl,
  buildDigiLockerRedirectUri,
  exchangeDigiLockerCode,
  fetchDigiLockerIssuedDocs,
  generateOAuthState,
  generatePkcePair,
  getDigiLockerConfig,
  isDigiLockerOAuthConfigured,
  resolveAppBaseUrl,
} from './server/digilockerService.js';
import {
  SAMAGRA_PORTAL_URL,
  validateIndianMobile,
  validateSamagraFamilyId,
  validateSamagraMemberId,
} from './src/utils/samagraValidator.js';
import {
  ApplicationRecord,
  AreaType,
  Category,
  Gender,
  JanpadBlock,
  LiveNotification,
  MaritalStatus,
  OccupationType,
  PortalReachabilityStatus,
  Scheme,
} from './src/types/index.js';
import { resolveSchemePortalUrl } from './src/utils/liveDataEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.DEFAULT_APP_PORT) || 3000;

app.use(express.json({ limit: '1mb' }));
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.parse.failed') {
    return sendApiError(res, 400, 'Invalid JSON request body.');
  }
  next(err);
});

// Cached schemes hydrated during startup after dbService.init()
let cachedSchemes: Scheme[] = [];

async function refreshSchemesCache(): Promise<Scheme[]> {
  cachedSchemes = await dbService.getSchemes();
  return cachedSchemes;
}

// SSE Clients for genuine real-time events (zero fake timers)
const sseClients: Response[] = [];

function pushSsePayload(payload: Record<string, unknown>) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(data);
    } catch {
      // client disconnected
    }
  });
}

async function broadcastNotification(notification: LiveNotification, eventType?: string) {
  await dbService.insertNotification(notification);
  // Push non-PII live refresh signal over public SSE so no citizen PII leaks across sessions
  pushSsePayload({
    eventType: eventType || 'notification',
    type: notification.type,
    timestamp: notification.timestamp,
  });
}

function formatNowTime(): string {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function clampString(val: unknown, maxLen: number): string | undefined {
  if (typeof val !== 'string') return undefined;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
}

function clampInt(val: unknown, min: number, max: number, fallback?: number): number | undefined {
  const n = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sendApiError(
  res: Response,
  status: number,
  error: string,
  details?: string,
  extra?: Record<string, unknown>
) {
  return res.status(status).json({
    error,
    ...(details ? { details } : {}),
    ...(extra || {}),
  });
}

// Server-side live HTTP probe for official government portals
async function probePortalUrl(url: string): Promise<{
  status: PortalReachabilityStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const started = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'YojanaSetu-Indore-PortalCheck/1.0',
      },
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'YojanaSetu-Indore-PortalCheck/1.0',
        },
      });
    }

    const latencyMs = Date.now() - started;
    const isReachable = response.status >= 200 && response.status < 500;
    return {
      status: isReachable ? 'reachable' : 'unreachable',
      httpStatus: response.status,
      latencyMs,
      checkedAt,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - started;
    const isTimeout = err?.name === 'AbortError';
    return {
      status: isTimeout ? 'timeout' : 'unreachable',
      httpStatus: null,
      latencyMs,
      checkedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ================= API ROUTES =================

// SSE Endpoint for Live Feed
app.get('/api/stream/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(
    `data: ${JSON.stringify({ type: 'connected', message: 'YojanaSetu Live Stream Connected' })}\n\n`
  );

  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

function renderOAuthPopupHtml(payload: Record<string, unknown>, isSuccess: boolean): string {
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c');
  const title = isSuccess ? 'DigiLocker Connected' : 'DigiLocker Verification Error';
  const heading = isSuccess
    ? 'DigiLocker Credentials Synced'
    : 'DigiLocker Authorization Failed';
  const body = isSuccess
    ? 'Your verified government documents have been saved to YojanaSetu. You can close this window.'
    : String(payload.error || 'Could not complete DigiLocker login.');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
    .card { max-width: 440px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 24px; text-align: center; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { font-size: 13px; color: #cbd5e1; line-height: 1.5; margin: 0 0 16px; }
    button { background: #f59e0b; color: #0f172a; border: none; border-radius: 10px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    <p>${body.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))}</p>
    <button type="button" onclick="window.close()">Close Window</button>
  </div>
  <script>
    (function() {
      var data = ${safeJson};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(data, '*');
        }
      } catch (e) {}
      setTimeout(function() { window.close(); }, 600);
    })();
  </script>
</body>
</html>`;
}

function classifyCitizenUniqueConflict(uniq: { constraint?: string; detail?: string }): {
  error: string;
  details: string;
  code: string;
} {
  const haystack = `${uniq.constraint || ''} ${uniq.detail || ''}`.toLowerCase();
  if (haystack.includes('mobile')) {
    return {
      error: 'This mobile number is already registered.',
      details: 'Please sign in with the existing account linked to this mobile number or verify a different +91 number.',
      code: 'MOBILE_ALREADY_REGISTERED',
    };
  }
  if (haystack.includes('samagra')) {
    return {
      error: 'This Samagra ID is already linked to another citizen account.',
      details: 'Each Samagra ID can only be linked to a single citizen account.',
      code: 'SAMAGRA_ACCOUNT_EXISTS',
    };
  }
  if (haystack.includes('email')) {
    return {
      error: 'An account with this email address already exists.',
      details: 'Switch to Sign In to access your existing citizen account.',
      code: 'EMAIL_ALREADY_REGISTERED',
    };
  }
  return {
    error: 'This mobile number, email, or Samagra ID is already registered.',
    details: 'Please sign in with your existing account or use unique citizen credentials.',
    code: 'DUPLICATE_ACCOUNT',
  };
}

// ================= CITIZEN EMAIL/PASSWORD AUTH & PROFILE =================

app.post('/api/citizen/auth/register', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = clampString(body.displayName, 120) || '';

    if (!rawEmail || !isValidEmail(rawEmail)) {
      return sendApiError(res, 400, 'Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      return sendApiError(res, 400, 'Password must be at least 6 characters long.');
    }
    if (!displayName) {
      return sendApiError(res, 400, 'Please enter your full name as per Aadhaar / Samagra.');
    }

    const rawFamilyInput = clampString(body.samagraFamilyId, 20);
    const rawMemberInput = clampString(body.samagraMemberId, 20);

    if (rawFamilyInput) {
      const famVal = validateSamagraFamilyId(rawFamilyInput);
      if (!famVal.valid) {
        return sendApiError(res, 400, famVal.error || 'Invalid 8-digit Samagra Family ID.');
      }
    }
    if (rawMemberInput) {
      const memVal = validateSamagraMemberId(rawMemberInput);
      if (!memVal.valid) {
        return sendApiError(res, 400, memVal.error || 'Invalid 9-digit Samagra Member ID.');
      }
    }

    const rawMobileInput = clampString(body.mobileNumber ?? body.phone, 24);
    let normalizedMobileE164: string | undefined;
    let mobileVerified = false;
    if (rawMobileInput) {
      const mobileCheck = validateIndianMobile(rawMobileInput);
      if (!mobileCheck.valid) {
        return sendApiError(
          res,
          400,
          mobileCheck.error || 'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).'
        );
      }
      normalizedMobileE164 = mobileCheck.e164;

      const existingMobile = await dbService.getCitizenAccountByMobile(normalizedMobileE164);
      if (existingMobile) {
        return sendApiError(
          res,
          409,
          'This mobile number is already registered.',
          'Sign in with the account already linked to this +91 mobile number.',
          { code: 'MOBILE_ALREADY_REGISTERED' }
        );
      }

      if (typeof body.mobileVerificationToken === 'string' && body.mobileVerificationToken.trim()) {
        mobileVerified = verifyMobileVerifiedToken(
          body.mobileVerificationToken.trim(),
          normalizedMobileE164
        );
      }
    }

    const existing = await dbService.getCitizenAccountByEmail(rawEmail);
    if (existing) {
      return sendApiError(
        res,
        409,
        'An account with this email address already exists.',
        'Switch to Sign In to access your existing account.',
        { code: 'EMAIL_ALREADY_REGISTERED' }
      );
    }

    const passwordHash = await hashCitizenPassword(password);
    const uid = `cit_${crypto.randomUUID()}`;
    const areaType: AreaType = body.areaType === 'rural' ? 'rural' : 'urban';
    const safeWard = areaType === 'urban' ? clampInt(body.wardNumber, 1, 85, 72) : undefined;
    const validBlocks: JanpadBlock[] = ['Indore', 'Mhow', 'Sanwer', 'Depalpur'];
    const safeBlock: JanpadBlock | undefined =
      areaType === 'rural'
        ? validBlocks.includes(body.blockName)
          ? body.blockName
          : 'Indore'
        : undefined;
    const safeAge = clampInt(body.age, 0, 120, 30)!;
    const safeIncome = clampInt(body.annualIncome, 0, 100000000, 150000)!;
    const cleanFamilyId = rawFamilyInput || undefined;
    const cleanMemberId = rawMemberInput || undefined;
    const cleanSamagraId = cleanMemberId || cleanFamilyId || undefined;

    const validCategories: Category[] = ['GEN', 'OBC', 'SC', 'ST', 'EWS'];
    const safeCategory: Category = validCategories.includes(body.category) ? body.category : 'GEN';
    const validGenders: Gender[] = ['female', 'male', 'transgender', 'any'];
    const safeGender: Gender = validGenders.includes(body.gender) ? body.gender : 'female';
    const validMarital: MaritalStatus[] = ['Unmarried', 'Married', 'Widow', 'Divorced'];
    const safeMarital: MaritalStatus = validMarital.includes(body.maritalStatus)
      ? body.maritalStatus
      : 'Married';
    const safeOccupation: OccupationType =
      clampString(body.occupation, 60) ? (body.occupation as OccupationType) : 'Homemaker';

    const profile = await dbService.createCitizenAccount({
      id: uid,
      email: rawEmail,
      passwordHash,
      displayName,
      phone: normalizedMobileE164,
      mobileNumber: normalizedMobileE164,
      mobileVerified,
      samagraId: cleanSamagraId,
      samagraFamilyId: cleanFamilyId,
      samagraMemberId: cleanMemberId,
      areaType,
      wardNumber: safeWard,
      blockName: safeBlock,
      category: safeCategory,
      age: safeAge,
      gender: safeGender,
      annualIncome: safeIncome,
      occupation: safeOccupation,
      isBPL: Boolean(body.isBPL),
      hasDisability: Boolean(body.hasDisability),
      maritalStatus: safeMarital,
      isMpDomicile: body.isMpDomicile !== false,
      isIndoreResident: body.isIndoreResident !== false,
      ekycVerified: false,
    });

    const token = signCitizenSessionToken({
      uid: profile.uid,
      email: profile.email,
      displayName: profile.displayName,
    });

    res.status(201).json({
      success: true,
      token,
      profile,
    });
  } catch (err) {
    const uniq = isUniqueConstraintError(err);
    if (uniq.isUnique) {
      const classified = classifyCitizenUniqueConflict(uniq);
      return sendApiError(res, 409, classified.error, classified.details, {
        code: classified.code,
      });
    }
    console.error('[API POST /api/citizen/auth/register] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to create citizen account. Please try again.',
      err instanceof Error ? err.message : undefined
    );
  }
});

app.post('/api/citizen/auth/login', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!rawEmail || !password) {
      return sendApiError(res, 400, 'Please enter both email address and password.');
    }

    const account = await dbService.getCitizenAccountByEmail(rawEmail);
    if (!account) {
      return sendApiError(
        res,
        401,
        'Invalid email or password. Please verify your credentials.',
        undefined,
        { code: 'INVALID_CREDENTIALS' }
      );
    }

    const passwordValid = await verifyCitizenPassword(password, account.passwordHash);
    if (!passwordValid) {
      return sendApiError(
        res,
        401,
        'Invalid email or password. Please verify your credentials.',
        undefined,
        { code: 'INVALID_CREDENTIALS' }
      );
    }

    await dbService.updateCitizenLastLogin(account.uid);
    const freshProfile = (await dbService.getCitizenAccountById(account.uid))!;
    const token = signCitizenSessionToken({
      uid: freshProfile.uid,
      email: freshProfile.email,
      displayName: freshProfile.displayName,
    });

    res.json({
      success: true,
      token,
      profile: freshProfile,
    });
  } catch (err) {
    console.error('[API POST /api/citizen/auth/login] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to sign in to citizen account.',
      err instanceof Error ? err.message : undefined
    );
  }
});

app.get('/api/citizen/auth/me', requireCitizenAuth, async (req: Request, res: Response) => {
  try {
    const profile = await dbService.getCitizenAccountById(req.citizenPrincipal!.uid);
    if (!profile) {
      return sendApiError(res, 401, 'Citizen account no longer exists.');
    }
    res.json({
      authenticated: true,
      role: 'citizen',
      profile,
    });
  } catch (err) {
    console.error('[API GET /api/citizen/auth/me] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to restore citizen session.',
      err instanceof Error ? err.message : undefined
    );
  }
});

const handleUpdateCitizenProfile = async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const areaType: AreaType | undefined =
      body.areaType === 'rural' ? 'rural' : body.areaType === 'urban' ? 'urban' : undefined;

    const famStr =
      body.samagraFamilyId !== undefined ? clampString(body.samagraFamilyId, 20) || '' : undefined;
    const memStr =
      body.samagraMemberId !== undefined ? clampString(body.samagraMemberId, 20) || '' : undefined;

    if (famStr) {
      const v = validateSamagraFamilyId(famStr);
      if (!v.valid) return sendApiError(res, 400, v.error || 'Invalid Samagra Family ID.');
    }
    if (memStr) {
      const v = validateSamagraMemberId(memStr);
      if (!v.valid) return sendApiError(res, 400, v.error || 'Invalid Samagra Member ID.');
    }

    const existingAccount = await dbService.getCitizenAccountById(req.citizenPrincipal!.uid);
    if (!existingAccount) {
      return sendApiError(res, 404, 'Citizen account not found.');
    }

    let nextMobileNumber: string | undefined;
    let nextMobileVerified: boolean | undefined;
    const rawMobileField = body.mobileNumber !== undefined ? body.mobileNumber : body.phone;
    if (rawMobileField !== undefined) {
      const trimmedMobile = clampString(rawMobileField, 24) || '';
      if (!trimmedMobile) {
        nextMobileNumber = '';
        nextMobileVerified = false;
      } else {
        const mobileCheck = validateIndianMobile(trimmedMobile);
        if (!mobileCheck.valid) {
          return sendApiError(
            res,
            400,
            mobileCheck.error ||
              'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).'
          );
        }
        nextMobileNumber = mobileCheck.e164;
        const hasValidProof =
          typeof body.mobileVerificationToken === 'string' &&
          verifyMobileVerifiedToken(body.mobileVerificationToken.trim(), nextMobileNumber);
        if (hasValidProof) {
          nextMobileVerified = true;
        } else if (nextMobileNumber !== existingAccount.mobileNumber) {
          nextMobileVerified = false;
        }
      }
    }

    const updated = await dbService.updateCitizenAccountProfile(req.citizenPrincipal!.uid, {
      displayName: clampString(body.displayName, 120),
      phone: nextMobileNumber,
      mobileNumber: nextMobileNumber,
      mobileVerified: nextMobileVerified,
      samagraFamilyId: famStr,
      samagraMemberId: memStr,
      samagraId:
        body.samagraId !== undefined
          ? clampString(body.samagraId, 20) || ''
          : memStr || famStr || undefined,
      areaType,
      wardNumber:
        areaType === 'rural' ? undefined : clampInt(body.wardNumber, 1, 85),
      blockName: areaType === 'urban' ? undefined : body.blockName,
      category: body.category,
      age: clampInt(body.age, 0, 120),
      gender: body.gender,
      annualIncome: clampInt(body.annualIncome, 0, 100000000),
      occupation: body.occupation,
      isBPL: body.isBPL !== undefined ? Boolean(body.isBPL) : undefined,
      hasDisability: body.hasDisability !== undefined ? Boolean(body.hasDisability) : undefined,
      maritalStatus: body.maritalStatus,
      isMpDomicile: body.isMpDomicile !== undefined ? Boolean(body.isMpDomicile) : undefined,
      isIndoreResident:
        body.isIndoreResident !== undefined ? Boolean(body.isIndoreResident) : undefined,
      ekycVerified: body.ekycVerified !== undefined ? Boolean(body.ekycVerified) : undefined,
    });

    if (!updated) {
      return sendApiError(res, 404, 'Citizen account not found.');
    }
    res.json({ success: true, profile: updated });
  } catch (err) {
    const uniq = isUniqueConstraintError(err);
    if (uniq.isUnique) {
      const classified = classifyCitizenUniqueConflict(uniq);
      return sendApiError(res, 409, classified.error, classified.details, {
        code: classified.code,
      });
    }
    console.error('[API UPDATE /api/citizen/auth/profile] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to update citizen profile.',
      err instanceof Error ? err.message : undefined
    );
  }
};

app.patch('/api/citizen/auth/profile', requireCitizenAuth, handleUpdateCitizenProfile);
app.put('/api/citizen/auth/profile', requireCitizenAuth, handleUpdateCitizenProfile);

// ================= MOBILE NUMBER OTP VERIFICATION (+91) =================

app.post('/api/auth/mobile/send-otp', async (req: Request, res: Response) => {
  try {
    const rawMobile = typeof req.body?.mobileNumber === 'string' ? req.body.mobileNumber : '';
    const mobileCheck = normalizeIndianMobileOrThrow(rawMobile);
    if (!mobileCheck.valid) {
      return sendApiError(
        res,
        400,
        mobileCheck.error ||
          'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).',
        'Example format: +919826012345',
        { code: 'INVALID_MOBILE_FORMAT' }
      );
    }

    if (!isSmsGatewayConfigured()) {
      return sendApiError(
        res,
        503,
        'Live SMS OTP delivery requires SMS gateway credentials (SMS_API_URL, SMS_API_KEY).',
        'No mock or bypass OTP is generated when live SMS credentials are missing. Configure SMS_API_URL and SMS_API_KEY to enable live +91 OTP delivery.',
        { code: 'SMS_CREDENTIALS_NOT_CONFIGURED' }
      );
    }

    const latest = await dbService.getLatestOtpVerification(mobileCheck.e164);
    if (latest) {
      const elapsedSec = Math.floor((Date.now() - new Date(latest.createdAt).getTime()) / 1000);
      if (elapsedSec >= 0 && elapsedSec < OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter = OTP_RESEND_COOLDOWN_SECONDS - elapsedSec;
        return sendApiError(
          res,
          429,
          `Please wait ${retryAfter}s before requesting another OTP for ${mobileCheck.e164}.`,
          undefined,
          { code: 'OTP_COOLDOWN', retryAfterSeconds: retryAfter }
        );
      }
    }

    const sinceIso = new Date(
      Date.now() - OTP_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const recentCount = await dbService.countRecentOtpRequests(mobileCheck.e164, sinceIso);
    if (recentCount >= OTP_RATE_LIMIT_MAX_REQUESTS) {
      return sendApiError(
        res,
        429,
        `Too many OTP requests for ${mobileCheck.e164}. Try again after ${OTP_RATE_LIMIT_WINDOW_MINUTES} minutes.`,
        undefined,
        { code: 'OTP_RATE_LIMITED' }
      );
    }

    const otp = generateSecureOtp();
    const otpHash = hashOtp(mobileCheck.e164, otp);
    const otpId = `otp_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();

    await dbService.createOtpVerification({
      id: otpId,
      mobileNumber: mobileCheck.e164,
      otpHash,
      expiresAt,
    });

    const dispatch = await sendSmsOtpViaGateway({
      mobileE164: mobileCheck.e164,
      mobile10Digit: mobileCheck.cleaned,
      otp,
    });

    if (!dispatch.sent) {
      await dbService.deleteOtpVerificationsForMobile(mobileCheck.e164);
      return sendApiError(
        res,
        503,
        dispatch.error || 'Failed to dispatch SMS OTP via configured gateway.',
        'Verify SMS_API_URL and SMS_API_KEY configuration.',
        { code: 'SMS_DISPATCH_FAILED' }
      );
    }

    res.json({
      success: true,
      mobileNumber: mobileCheck.e164,
      expiresInSeconds: OTP_EXPIRY_MINUTES * 60,
      cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
      message: `A 6-digit OTP has been sent to ${mobileCheck.e164}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
    });
  } catch (err) {
    console.error('[API POST /api/auth/mobile/send-otp] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to process OTP send request.',
      err instanceof Error ? err.message : undefined
    );
  }
});

app.post('/api/auth/mobile/verify-otp', async (req: Request, res: Response) => {
  try {
    const rawMobile = typeof req.body?.mobileNumber === 'string' ? req.body.mobileNumber : '';
    const rawOtp = typeof req.body?.otp === 'string' || typeof req.body?.otp === 'number'
      ? String(req.body.otp).trim()
      : '';

    const mobileCheck = normalizeIndianMobileOrThrow(rawMobile);
    if (!mobileCheck.valid) {
      return sendApiError(
        res,
        400,
        mobileCheck.error ||
          'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).',
        undefined,
        { code: 'INVALID_MOBILE_FORMAT' }
      );
    }

    if (!/^\d{6}$/.test(rawOtp)) {
      return sendApiError(res, 400, 'Enter the 6-digit numeric OTP sent to your mobile number.', undefined, {
        code: 'INVALID_OTP_FORMAT',
      });
    }

    const latest = await dbService.getLatestOtpVerification(mobileCheck.e164);
    if (!latest) {
      return sendApiError(
        res,
        400,
        'No active OTP request found for this mobile number. Please request a new OTP.',
        undefined,
        { code: 'OTP_NOT_FOUND' }
      );
    }

    if (new Date(latest.expiresAt).getTime() <= Date.now()) {
      await dbService.deleteOtpVerificationsForMobile(mobileCheck.e164);
      return sendApiError(
        res,
        400,
        'This OTP has expired (5-minute limit). Please request a new OTP.',
        undefined,
        { code: 'OTP_EXPIRED' }
      );
    }

    if (latest.attempts >= OTP_MAX_ATTEMPTS) {
      await dbService.deleteOtpVerificationsForMobile(mobileCheck.e164);
      return sendApiError(
        res,
        429,
        'Maximum OTP verification attempts exceeded (5/5). Please request a new OTP.',
        undefined,
        { code: 'OTP_MAX_ATTEMPTS' }
      );
    }

    const valid = verifyOtpHash(mobileCheck.e164, rawOtp, latest.otpHash);
    if (!valid) {
      const updatedAttempts = await dbService.incrementOtpAttempts(latest.id);
      const remaining = Math.max(0, OTP_MAX_ATTEMPTS - updatedAttempts);
      if (remaining === 0) {
        await dbService.deleteOtpVerificationsForMobile(mobileCheck.e164);
        return sendApiError(
          res,
          429,
          'Incorrect OTP entered too many times. Please request a new OTP.',
          undefined,
          { code: 'OTP_MAX_ATTEMPTS' }
        );
      }
      return sendApiError(
        res,
        401,
        `Incorrect 6-digit OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        undefined,
        { code: 'INVALID_OTP', remainingAttempts: remaining }
      );
    }

    await dbService.deleteOtpVerificationsForMobile(mobileCheck.e164);

    // If an authenticated citizen UID was passed via token or mobile already exists, update DB
    let citizenUid: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const { verifyCitizenSessionToken } = await import('./server/citizenAuth.js');
        const payload = verifyCitizenSessionToken(authHeader.slice(7).trim());
        citizenUid = payload.sub;
      } catch {
        // ignore invalid optional token during signup OTP verification
      }
    }
    await dbService.markCitizenMobileVerified(mobileCheck.e164, citizenUid);

    const verificationToken = signMobileVerifiedToken(mobileCheck.e164);
    res.json({
      success: true,
      mobileNumber: mobileCheck.e164,
      mobileVerified: true,
      verificationToken,
      message: `Mobile number ${mobileCheck.e164} verified successfully.`,
    });
  } catch (err) {
    console.error('[API POST /api/auth/mobile/verify-otp] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to verify mobile OTP.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// ================= OFFICIAL GOVERNMENT DIGILOCKER OAUTH 2.0 + PKCE =================

app.get('/api/auth/digilocker/login', async (req: Request, res: Response) => {
  try {
    const mode = req.query.mode === 'json' ? 'json' : 'redirect';
    const appBaseUrl = resolveAppBaseUrl(req);
    const redirectUri = buildDigiLockerRedirectUri(appBaseUrl);
    const config = getDigiLockerConfig();

    if (!config) {
      const errMsg =
        'Official DigiLocker OAuth 2.0 credentials (DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET) are not configured on the server.';
      const details = `Register this exact Callback URL in the DigiLocker MeriPehchaan Developer Console: ${redirectUri}`;
      if (mode === 'json') {
        return sendApiError(res, 503, errMsg, details, {
          code: 'DIGILOCKER_CREDENTIALS_NOT_CONFIGURED',
          redirectUri,
        });
      }
      return res.status(503).send(
        renderOAuthPopupHtml(
          { type: 'DIGILOCKER_OAUTH_ERROR', error: errMsg, details, redirectUri },
          false
        )
      );
    }

    const citizenKey = clampString(String(req.query.citizenKey || ''), 128) || 'citizen_oauth';
    const state = generateOAuthState();
    const pkce = generatePkcePair();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await dbService.saveOAuthPkceState({
      state,
      codeVerifier: pkce.codeVerifier,
      citizenKey,
      redirectUri,
      expiresAt,
    });

    const authorizeUrl = buildDigiLockerAuthorizeUrl({
      config,
      redirectUri,
      state,
      codeChallenge: pkce.codeChallenge,
    });

    if (mode === 'json') {
      return res.json({
        success: true,
        url: authorizeUrl,
        redirectUri,
        state,
      });
    }

    return res.redirect(authorizeUrl);
  } catch (err) {
    console.error('[API GET /api/auth/digilocker/login] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to initiate DigiLocker OAuth 2.0 + PKCE login.',
      err instanceof Error ? err.message : undefined
    );
  }
});

app.get(
  ['/api/auth/digilocker/callback', '/api/auth/digilocker/callback/'],
  async (req: Request, res: Response) => {
    try {
      const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
      const oauthErrorDesc =
        typeof req.query.error_description === 'string' ? req.query.error_description : '';
      if (oauthError) {
        const msg = oauthErrorDesc || `DigiLocker authorization failed (${oauthError}).`;
        return res
          .status(400)
          .send(renderOAuthPopupHtml({ type: 'DIGILOCKER_OAUTH_ERROR', error: msg }, false));
      }

      const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
      const state = typeof req.query.state === 'string' ? req.query.state.trim() : '';
      if (!code || !state) {
        return res.status(400).send(
          renderOAuthPopupHtml(
            {
              type: 'DIGILOCKER_OAUTH_ERROR',
              error: 'Missing authorization code or state parameter from DigiLocker callback.',
            },
            false
          )
        );
      }

      const pkceState = await dbService.consumeOAuthPkceState(state);
      if (!pkceState) {
        return res.status(400).send(
          renderOAuthPopupHtml(
            {
              type: 'DIGILOCKER_OAUTH_ERROR',
              error: 'Invalid or expired DigiLocker OAuth state. Please restart DigiLocker Sign-In.',
            },
            false
          )
        );
      }

      if (new Date(pkceState.expiresAt).getTime() <= Date.now()) {
        return res.status(400).send(
          renderOAuthPopupHtml(
            {
              type: 'DIGILOCKER_OAUTH_ERROR',
              error: 'DigiLocker login session expired (10-minute timeout). Please try again.',
            },
            false
          )
        );
      }

      const config = getDigiLockerConfig();
      if (!config) {
        return res.status(503).send(
          renderOAuthPopupHtml(
            {
              type: 'DIGILOCKER_OAUTH_ERROR',
              error:
                'DigiLocker OAuth credentials (DIGILOCKER_CLIENT_ID, DIGILOCKER_CLIENT_SECRET) are not configured on the server.',
            },
            false
          )
        );
      }

      const tokenResult = await exchangeDigiLockerCode({
        config,
        code,
        redirectUri: pkceState.redirectUri,
        codeVerifier: pkceState.codeVerifier,
      });

      const credentials = await fetchDigiLockerIssuedDocs({
        config,
        accessToken: tokenResult.accessToken,
        citizenId: pkceState.citizenKey,
      });

      for (const cred of credentials) {
        await dbService.upsertDigiLockerCredential(cred);
        if (cred.docId) {
          await dbService.upsertDigiLockerDocument({
            citizenKey: cred.citizenId,
            docId: cred.docId,
            docNumber: cred.docNumber || cred.docUri,
            source: 'digilocker',
            issuer: cred.issuer,
            verified: true,
            verifiedAt: cred.verifiedAt,
          });
        }
      }

      await broadcastNotification(
        {
          id: `notif-${Date.now()}`,
          timestamp: formatNowTime(),
          type: 'digilocker_verified',
          message: `Official DigiLocker OAuth synced ${credentials.length} issued document${credentials.length === 1 ? '' : 's'} for Citizen ID ${pkceState.citizenKey}.`,
          messageHindi: `आधिकारिक डिजिलॉकर OAuth से नागरिक आईडी ${pkceState.citizenKey} के ${credentials.length} दस्तावेज़ सत्यापित हुए।`,
          wardOrBlock: 'DigiLocker OAuth 2.0 Gateway',
        },
        'digilocker_updated'
      );

      return res.send(
        renderOAuthPopupHtml(
          {
            type: 'DIGILOCKER_OAUTH_SUCCESS',
            citizenKey: pkceState.citizenKey,
            count: credentials.length,
            credentials,
          },
          true
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unexpected error exchanging DigiLocker OAuth code.';
      console.error('[API GET /api/auth/digilocker/callback] Error:', err);
      return res
        .status(500)
        .send(renderOAuthPopupHtml({ type: 'DIGILOCKER_OAUTH_ERROR', error: msg }, false));
    }
  }
);

// Citizen Saved Schemes persistence (for Email/Password DB accounts)
app.get('/api/citizen/saved-schemes', requireCitizenAuth, async (req: Request, res: Response) => {
  try {
    const items = await dbService.getCitizenSavedSchemes(req.citizenPrincipal!.uid);
    res.json({ items });
  } catch (err) {
    console.error('[API GET /api/citizen/saved-schemes] Error:', err);
    return sendApiError(res, 500, 'Failed to load saved schemes.', err instanceof Error ? err.message : undefined);
  }
});

app.post('/api/citizen/saved-schemes', requireCitizenAuth, async (req: Request, res: Response) => {
  try {
    const { schemeId, schemeTitle } = req.body || {};
    if (!schemeId || !String(schemeId).trim()) {
      return sendApiError(res, 400, 'schemeId is required.');
    }
    await dbService.saveCitizenScheme(
      req.citizenPrincipal!.uid,
      String(schemeId).trim(),
      String(schemeTitle || schemeId).trim()
    );
    const items = await dbService.getCitizenSavedSchemes(req.citizenPrincipal!.uid);
    res.status(201).json({ success: true, items });
  } catch (err) {
    console.error('[API POST /api/citizen/saved-schemes] Error:', err);
    return sendApiError(res, 500, 'Failed to save scheme.', err instanceof Error ? err.message : undefined);
  }
});

app.delete(
  '/api/citizen/saved-schemes/:schemeId',
  requireCitizenAuth,
  async (req: Request, res: Response) => {
    try {
      await dbService.removeCitizenSavedScheme(req.citizenPrincipal!.uid, req.params.schemeId);
      const items = await dbService.getCitizenSavedSchemes(req.citizenPrincipal!.uid);
      res.json({ success: true, items });
    } catch (err) {
      console.error('[API DELETE /api/citizen/saved-schemes/:schemeId] Error:', err);
      return sendApiError(res, 500, 'Failed to remove saved scheme.', err instanceof Error ? err.message : undefined);
    }
  }
);

// ================= ADMIN RBAC SESSION & PROTECTED ENDPOINTS =================

// Verify authenticated Administrator session & role claim
app.get('/api/admin/session', requireAdmin, (req: Request, res: Response) => {
  const principal = req.authPrincipal!;
  res.json({
    authenticated: true,
    role: 'admin',
    uid: principal.uid,
    email: principal.email,
    displayName: principal.displayName,
    adminSource: principal.adminSource,
  });
});

// Admin-only full Applications listing
app.get('/api/admin/applications', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { arn, samagraId, status } = req.query;
    const records = await dbService.getApplications({
      arn: arn ? String(arn) : undefined,
      samagraId: samagraId ? String(samagraId) : undefined,
      status: status ? String(status) : undefined,
    });
    res.json({ records, count: records.length });
  } catch (err) {
    console.error('[API GET /api/admin/applications] Error:', err);
    return sendApiError(res, 500, 'Failed to load district applications.', err instanceof Error ? err.message : undefined);
  }
});

// Admin-only full Samagra households listing
app.get('/api/admin/samagra', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const families = await dbService.getAllSamagraFamilies();
    res.json({ families, count: families.length });
  } catch (err) {
    console.error('[API GET /api/admin/samagra] Error:', err);
    return sendApiError(res, 500, 'Failed to list Samagra households.', err instanceof Error ? err.message : undefined);
  }
});

// Admin-only District Macro Stats
app.get('/api/admin/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await dbService.getDistrictStats();
    res.json({ stats });
  } catch (err) {
    console.error('[API /api/admin/stats] Error:', err);
    return sendApiError(res, 500, 'Failed to load district statistics.', err instanceof Error ? err.message : undefined);
  }
});

// Admin-only Ward & Janpad Live Stats
app.get('/api/admin/stats/wards', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const live = await dbService.getWardAndBlockLiveStats();
    res.json(live);
  } catch (err) {
    console.error('[API /api/admin/stats/wards] Error:', err);
    return sendApiError(res, 500, 'Failed to load live ward metrics.', err instanceof Error ? err.message : undefined);
  }
});

// Admin-only Full Administrative Activity Stream
app.get('/api/admin/notifications', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsedLimit = req.query.limit ? Number(req.query.limit) : 50;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, Math.floor(parsedLimit)) : 50;
    const notifications = await dbService.getNotifications(limit);
    res.json({ notifications });
  } catch (err) {
    console.error('[API /api/admin/notifications] Error:', err);
    return sendApiError(res, 500, 'Failed to load administrative notifications.', err instanceof Error ? err.message : undefined);
  }
});

// District Macro Stats (Admin-protected)
app.get('/api/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await dbService.getDistrictStats();
    res.json({ stats });
  } catch (err) {
    console.error('[API /api/stats] Error:', err);
    return sendApiError(res, 500, 'Failed to load district statistics.', err instanceof Error ? err.message : undefined);
  }
});

// Ward & Janpad Live Stats (Admin-protected)
app.get('/api/stats/wards', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const live = await dbService.getWardAndBlockLiveStats();
    res.json(live);
  } catch (err) {
    console.error('[API /api/stats/wards] Error:', err);
    return sendApiError(res, 500, 'Failed to load live ward metrics.', err instanceof Error ? err.message : undefined);
  }
});

// Notifications List (Admin-protected for full operational feed)
app.get('/api/notifications', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsedLimit = req.query.limit ? Number(req.query.limit) : 30;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(200, Math.floor(parsedLimit)) : 30;
    const notifications = await dbService.getNotifications(limit);
    res.json({ notifications });
  } catch (err) {
    console.error('[API /api/notifications] Error:', err);
    return sendApiError(res, 500, 'Failed to load notifications.', err instanceof Error ? err.message : undefined);
  }
});

// Post Notification (Admin Broadcast - strictly Admin-protected)
app.post('/api/notifications', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { type, message, messageHindi, wardOrBlock, amount, arn } = req.body || {};
    if (!message || !String(message).trim()) {
      return sendApiError(res, 400, 'Broadcast message is required.');
    }
    const parsedAmount = amount !== undefined ? Number(amount) : undefined;
    const newNotif: LiveNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatNowTime(),
      type: type || 'ward_verification',
      message: String(message).trim(),
      messageHindi: String(messageHindi || message).trim(),
      wardOrBlock: String(wardOrBlock || 'Indore District').trim(),
      amount:
        parsedAmount !== undefined && Number.isFinite(parsedAmount) ? parsedAmount : undefined,
      arn: arn || undefined,
    };
    await broadcastNotification(newNotif);
    res.status(201).json({ success: true, notification: newNotif });
  } catch (err) {
    console.error('[API POST /api/notifications] Error:', err);
    return sendApiError(res, 500, 'Failed to broadcast notification.', err instanceof Error ? err.message : undefined);
  }
});

// ================= SCHEMES CRUD & REAL-TIME CHECK =================

// Get Schemes Real-Time Audit Status
app.get('/api/schemes/realtime-status', async (_req: Request, res: Response) => {
  try {
    const report = await dbService.getSchemesRealtimeStatus();
    res.json({ report });
  } catch (err) {
    console.error('[API GET /api/schemes/realtime-status] Error:', err);
    return sendApiError(res, 500, 'Failed to compute real-time schemes status.', err instanceof Error ? err.message : undefined);
  }
});

// Trigger Live Server-Side Verification of Official Scheme Portals
app.post('/api/schemes/verify-realtime', async (_req: Request, res: Response) => {
  try {
    const schemes = await dbService.getSchemes();
    const uniqueUrls = Array.from(new Set(schemes.map(s => resolveSchemePortalUrl(s))));
    const urlResults = new Map<
      string,
      {
        status: PortalReachabilityStatus;
        httpStatus: number | null;
        latencyMs: number | null;
        checkedAt: string;
      }
    >();

    // Probe in small parallel batches to stay responsive
    const batchSize = 6;
    for (let i = 0; i < uniqueUrls.length; i += batchSize) {
      const batch = uniqueUrls.slice(i, i + batchSize);
      const settled = await Promise.all(
        batch.map(async url => ({ url, result: await probePortalUrl(url) }))
      );
      for (const item of settled) {
        urlResults.set(item.url, item.result);
      }
    }

    const report = await dbService.updateSchemesPortalCheckByUrl(urlResults);
    await refreshSchemesCache();

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'schemes_synced',
        message: `Schemes real-time portal check completed: ${report.reachableSchemesCount}/${report.totalSchemes} schemes verified against official portals.`,
        messageHindi: `योजना पोर्टल रीयल-टाइम जांच पूर्ण: ${report.reachableSchemesCount}/${report.totalSchemes} योजनाएं सत्यापित।`,
        wardOrBlock: 'Indore Collectorate Catalog',
      },
      'schemes_updated'
    );

    res.json({ success: true, report, schemes: cachedSchemes });
  } catch (err) {
    console.error('[API POST /api/schemes/verify-realtime] Error:', err);
    return sendApiError(res, 500, 'Failed to execute live portal verification.', err instanceof Error ? err.message : undefined);
  }
});

// Get Schemes (with optional level and search queries)
app.get('/api/schemes', async (req: Request, res: Response) => {
  try {
    const level = req.query.level ? String(req.query.level) : undefined;
    const search = req.query.q ? String(req.query.q) : undefined;
    const schemes = await dbService.getSchemes({ level, search });
    res.json({ schemes, count: schemes.length });
  } catch (err) {
    console.error('[API GET /api/schemes] Error:', err);
    return sendApiError(res, 500, 'Failed to load schemes.', err instanceof Error ? err.message : undefined);
  }
});

// Get Scheme by ID
app.get('/api/schemes/:id', async (req: Request, res: Response) => {
  try {
    const scheme = await dbService.getSchemeById(req.params.id);
    if (!scheme) {
      return sendApiError(res, 404, 'Scheme not found.');
    }
    res.json({ scheme });
  } catch (err) {
    console.error('[API GET /api/schemes/:id] Error:', err);
    return sendApiError(res, 500, 'Failed to load scheme.', err instanceof Error ? err.message : undefined);
  }
});

// Create/Insert Scheme (Live Admin Broadcast - strictly Admin-protected)
app.post('/api/schemes', requireAdmin, async (req: Request, res: Response) => {
  try {
    const scheme = (req.body || {}) as Scheme;
    if (!scheme.id || !scheme.title) {
      return sendApiError(res, 400, 'Invalid scheme payload. id and title are required.');
    }
    const saved = await dbService.insertScheme(scheme, 'admin_live');
    await refreshSchemesCache();

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'schemes_synced',
        message: `Live scheme published by Indore Admin: ${saved.title} (${saved.code}).`,
        messageHindi: `प्रशासन द्वारा नई योजना प्रकाशित: ${saved.titleHindi} (${saved.code})।`,
        wardOrBlock: 'Indore District',
      },
      'schemes_updated'
    );

    res.status(201).json({ success: true, scheme: saved });
  } catch (err) {
    console.error('[API POST /api/schemes] Error:', err);
    return sendApiError(res, 500, 'Failed to save scheme.', err instanceof Error ? err.message : undefined);
  }
});

// Update Scheme (strictly Admin-protected)
app.put('/api/schemes/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const scheme = (req.body || {}) as Scheme;
    if (!scheme.title) {
      return sendApiError(res, 400, 'Invalid scheme payload. title is required.');
    }
    scheme.id = req.params.id;
    const saved = await dbService.insertScheme(scheme, 'admin_live');
    await refreshSchemesCache();
    pushSsePayload({ eventType: 'schemes_updated' });
    res.json({ success: true, scheme: saved });
  } catch (err) {
    console.error('[API PUT /api/schemes/:id] Error:', err);
    return sendApiError(res, 500, 'Failed to update scheme.', err instanceof Error ? err.message : undefined);
  }
});

// Delete Scheme (strictly Admin-protected)
app.delete('/api/schemes/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const deleted = await dbService.deleteScheme(req.params.id);
    if (!deleted) {
      return sendApiError(res, 404, 'Scheme not found or could not be deleted.');
    }
    await refreshSchemesCache();
    pushSsePayload({ eventType: 'schemes_updated' });
    res.json({ success: true });
  } catch (err) {
    console.error('[API DELETE /api/schemes/:id] Error:', err);
    return sendApiError(res, 500, 'Failed to delete scheme.', err instanceof Error ? err.message : undefined);
  }
});

// ================= APPLICATIONS CRUD =================

// Get Applications:
// - Filtered by specific `arn` or `samagraId`: Citizen-scoped lookup allowed
// - Unfiltered district-wide list: strictly requires Admin authentication
app.get('/api/applications', (req: Request, res: Response, next: NextFunction) => {
  const { arn, samagraId, status } = req.query;
  const hasScopedFilter = Boolean(
    (arn && String(arn).trim()) || (samagraId && String(samagraId).trim())
  );

  const handleQuery = async () => {
    try {
      const records = await dbService.getApplications({
        arn: arn ? String(arn).trim() : undefined,
        samagraId: samagraId ? String(samagraId).trim() : undefined,
        status: status ? String(status).trim() : undefined,
      });

      if (arn && records.length === 0) {
        return sendApiError(res, 404, 'Application Reference Number (ARN) not found.');
      }
      if (arn) {
        return res.json({ record: records[0] });
      }

      res.json({ records, count: records.length });
    } catch (err) {
      console.error('[API GET /api/applications] Error:', err);
      return sendApiError(res, 500, 'Failed to load applications.', err instanceof Error ? err.message : undefined);
    }
  };

  if (!hasScopedFilter) {
    return requireAdmin(req, res, () => {
      void handleQuery().catch(next);
    });
  }
  void handleQuery().catch(next);
});

// Get Application by ARN
app.get('/api/applications/:arn', async (req: Request, res: Response) => {
  try {
    const record = await dbService.getApplicationByArn(req.params.arn);
    if (!record) {
      return sendApiError(res, 404, 'Application Reference Number (ARN) not found.');
    }
    res.json({ record });
  } catch (err) {
    console.error('[API GET /api/applications/:arn] Error:', err);
    return sendApiError(res, 500, 'Failed to load application.', err instanceof Error ? err.message : undefined);
  }
});

// Submit Application
app.post('/api/applications', async (req: Request, res: Response) => {
  try {
    const {
      schemeId,
      applicantName,
      citizenId,
      samagraMemberId,
      samagraFamilyId,
      phone,
      wardOrBlock,
      areaType,
    } = req.body || {};

    if (!schemeId || !applicantName || !String(applicantName).trim()) {
      return sendApiError(res, 400, 'Scheme selection and applicant full name are required.');
    }

    const famCheck = validateSamagraFamilyId(String(samagraFamilyId ?? ''));
    if (!famCheck.valid) {
      return sendApiError(res, 400, famCheck.error || 'Valid 8-digit Samagra Family ID is required.');
    }
    const memCheck = validateSamagraMemberId(String(samagraMemberId ?? ''));
    if (!memCheck.valid) {
      return sendApiError(res, 400, memCheck.error || 'Valid 9-digit Samagra Member ID is required.');
    }
    const phoneCheck = validateIndianMobile(String(phone ?? ''));
    if (!phoneCheck.valid) {
      return sendApiError(res, 400, phoneCheck.error || 'Valid 10-digit mobile number is required.');
    }

    const cleanSchemeId = String(schemeId).trim();
    const cleanApplicantName = String(applicantName).trim();
    const cleanCitizenId =
      typeof citizenId === 'string' && citizenId.trim() ? citizenId.trim() : memCheck.cleaned;

    const scheme =
      (await dbService.getSchemeById(cleanSchemeId)) ||
      cachedSchemes.find(s => s.id === cleanSchemeId);
    if (!scheme) {
      return sendApiError(res, 404, 'Selected scheme does not exist in catalog.');
    }

    let arn = `YS-IND-2026-${Math.floor(10000 + Math.random() * 90000)}`;
    let attempts = 0;
    while ((await dbService.getApplicationByArn(arn)) && attempts < 10) {
      arn = `YS-IND-2026-${Math.floor(10000 + Math.random() * 90000)}`;
      attempts += 1;
    }

    const today = new Date().toISOString().split('T')[0];
    const nowTime = formatNowTime();

    const newApp: ApplicationRecord = {
      arn,
      schemeId: cleanSchemeId,
      schemeTitle: scheme.title,
      schemeTitleHindi: scheme.titleHindi,
      applicantName: cleanApplicantName,
      citizenId: cleanCitizenId,
      samagraMemberId: memCheck.cleaned,
      samagraFamilyId: famCheck.cleaned,
      phone: phoneCheck.cleaned,
      wardOrBlock: wardOrBlock ? String(wardOrBlock).trim() : 'Indore District',
      areaType: areaType === 'rural' ? 'rural' : 'urban',
      appliedDate: today,
      currentStatus: 'submitted',
      officerInCharge: 'Nodal Verification Officer, Indore Collectorate',
      sanctionAmount: scheme.financialEntitlement?.amount || 0,
      remarks: 'Application registered live via YojanaSetu Citizen Portal.',
      timeline: [
        {
          title: 'Application Intake Submitted',
          titleHindi: 'आवेदन सफलतापूर्वक दर्ज',
          date: `${today} ${nowTime}`,
          location: 'YojanaSetu Direct Portal',
          status: 'completed',
          remarks: 'Digital acknowledgment generated. Forwarded for ward/panchayat verification.',
        },
        {
          title: 'Ward / Panchayat Field Verification',
          titleHindi: 'वार्ड / पंचायत भौतिक सत्यापन',
          date: 'In Progress',
          location: wardOrBlock || 'Indore Ward Office',
          status: 'in_progress',
          remarks: 'Queued for Nodal Ward / Janpad Officer review.',
        },
        {
          title: 'Collectorate Scrutiny & Approval',
          titleHindi: 'कलेक्ट्रेट स्क्रूटनी व अनुमोदन',
          date: 'Pending',
          location: 'Collectorate Campus, Moti Tabela Indore',
          status: 'pending',
        },
        {
          title: 'Sanction Order Release',
          titleHindi: 'स्वीकृति आदेश जारी',
          date: 'Pending',
          location: 'Departmental Directorate Indore',
          status: 'pending',
        },
        {
          title: 'Direct Benefit Transfer (DBT)',
          titleHindi: 'डीबीटी बैंक अंतरण',
          date: 'Pending',
          location: 'Aadhaar-linked Bank Account',
          status: 'pending',
        },
      ],
    };

    await dbService.insertApplication(newApp);

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: nowTime,
        type: 'application_filed',
        message: `Application ${arn} filed for ${scheme.title} by ${cleanApplicantName} (${newApp.wardOrBlock}).`,
        messageHindi: `नवीन आवेदन ${arn}: ${cleanApplicantName} द्वारा ${scheme.titleHindi} हेतु दर्ज (${newApp.wardOrBlock})।`,
        wardOrBlock: newApp.wardOrBlock,
        arn,
      },
      'application_updated'
    );

    res.status(201).json({ success: true, record: newApp });
  } catch (err) {
    const uniq = isUniqueConstraintError(err);
    if (uniq.isUnique) {
      return sendApiError(
        res,
        409,
        'You have already applied for this scheme.',
        'Duplicate applications for the same citizen and scheme are not allowed. Use Application Tracker to check your existing ARN.',
        { code: 'DUPLICATE_APPLICATION' }
      );
    }
    console.error('[API POST /api/applications] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to submit application.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// Update Application Status (Admin live approval / disbursement - strictly Admin-protected)
app.patch('/api/applications/:arn', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, remarks } = req.body || {};
    const allowedStatuses: ApplicationRecord['currentStatus'][] = [
      'submitted',
      'ward_verification',
      'collectorate_scrutiny',
      'sanction_issued',
      'dbt_disbursed',
      'rejected',
    ];
    if (!status || !allowedStatuses.includes(status)) {
      return sendApiError(res, 400, 'Valid application status is required.');
    }

    const updated = await dbService.updateApplicationStatus(req.params.arn, status, remarks);
    if (!updated) {
      return sendApiError(res, 404, 'Application not found.');
    }

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type:
          status === 'dbt_disbursed'
            ? 'dbt_disbursed'
            : status === 'ward_verification'
            ? 'ward_verification'
            : 'sanction_order',
        message: `ARN ${updated.arn}: Status updated to ${status.replace('_', ' ').toUpperCase()} for ${updated.applicantName}.`,
        messageHindi: `आवेदन ${updated.arn}: स्थिति अद्यतित - ${status} (${updated.applicantName})।`,
        wardOrBlock: updated.wardOrBlock,
        amount:
          status === 'dbt_disbursed' || status === 'sanction_issued'
            ? updated.sanctionAmount
            : undefined,
        arn: updated.arn,
      },
      'application_updated'
    );

    res.json({ success: true, record: updated });
  } catch (err) {
    console.error('[API PATCH /api/applications/:arn] Error:', err);
    return sendApiError(res, 500, 'Failed to update application status.', err instanceof Error ? err.message : undefined);
  }
});

// ================= SAMAGRA LIVE INTEGRATION =================

// List all live registered Samagra households (strictly Admin-protected)
app.get('/api/samagra', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const families = await dbService.getAllSamagraFamilies();
    res.json({ families, count: families.length });
  } catch (err) {
    console.error('[API GET /api/samagra] Error:', err);
    return sendApiError(res, 500, 'Failed to list Samagra households.', err instanceof Error ? err.message : undefined);
  }
});

// Get Samagra Family Profile by Family ID (8-digit) or Member ID (9-digit)
app.get('/api/samagra/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id?.trim() || '';
    const outcome = await fetchLiveSamagraDetails(id);

    if (outcome.family) {
      return res.status(outcome.httpStatus).json({
        family: outcome.family,
        source: outcome.source,
        liveConfigured: outcome.liveConfigured,
        portalUrl: outcome.portalUrl,
        ...(outcome.notice ? { notice: outcome.notice } : {}),
      });
    }

    return sendApiError(
      res,
      outcome.httpStatus,
      outcome.error || 'Samagra Family or Member ID lookup failed.',
      outcome.details,
      {
        code: outcome.code,
        liveConfigured: outcome.liveConfigured,
        portalUrl: outcome.portalUrl || SAMAGRA_PORTAL_URL,
        allowManualEntry: Boolean(outcome.allowManualEntry),
      }
    );
  } catch (err) {
    console.error('[API GET /api/samagra/:id] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to lookup Samagra family record.',
      err instanceof Error ? err.message : undefined,
      { portalUrl: SAMAGRA_PORTAL_URL }
    );
  }
});

// Register a live Citizen Samagra Family record (rejects duplicates with 409 Conflict)
app.post('/api/samagra/register', async (req: Request, res: Response) => {
  try {
    const { familyId, headName, areaType, wardOrBlock, address, rationCardType, members } =
      req.body || {};
    const cleanFamilyId =
      typeof familyId === 'string' || typeof familyId === 'number' ? String(familyId).trim() : '';
    const cleanHeadName = typeof headName === 'string' ? headName.trim() : '';

    const famValidation = validateSamagraFamilyId(cleanFamilyId);
    if (!famValidation.valid) {
      return sendApiError(res, 400, famValidation.error || 'Invalid 8-digit Samagra Family ID.');
    }

    if (!cleanHeadName || !Array.isArray(members) || members.length === 0) {
      return sendApiError(
        res,
        400,
        'Head of family name and at least one household member are required.'
      );
    }

    const seenMemberIds = new Set<string>();
    for (const m of members) {
      if (!m || typeof m !== 'object' || !String(m.name || '').trim()) {
        return sendApiError(res, 400, 'Each Samagra member must include a non-empty full name.');
      }
      const memValidation = validateSamagraMemberId(String(m.memberId || ''));
      if (!memValidation.valid) {
        return sendApiError(
          res,
          400,
          memValidation.error || 'Each member must have a valid 9-digit Samagra Member ID.',
          `Invalid Member ID for "${String(m.name).trim()}".`
        );
      }
      if (seenMemberIds.has(memValidation.cleaned)) {
        return sendApiError(
          res,
          409,
          `Duplicate Samagra Member ID (${memValidation.cleaned}) inside the same household form.`,
          'Every household member must have a distinct 9-digit Samagra Member ID.',
          { code: 'DUPLICATE_MEMBER_IN_PAYLOAD' }
        );
      }
      seenMemberIds.add(memValidation.cleaned);
    }

    const saved = await dbService.registerSamagraFamily({
      familyId: famValidation.cleaned,
      headName: cleanHeadName.slice(0, 120),
      areaType: areaType === 'rural' ? 'rural' : 'urban',
      wardOrBlock: String(wardOrBlock || 'Ward 1 (Sirpur / Chandan Nagar)').slice(0, 100),
      address: String(address || 'Indore District, Madhya Pradesh').slice(0, 300),
      rationCardType:
        rationCardType === 'BPL' || rationCardType === 'Antyodaya' ? rationCardType : 'APL',
      members: members.map((m: any) => ({
        ...m,
        ekycStatus: Boolean(m.ekycStatus),
        dbtActive: Boolean(m.dbtActive),
      })),
    });

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'samagra_synced',
        message: `Live Samagra Family ${saved.familyId} (${saved.headName}, ${saved.members.length} member${saved.members.length > 1 ? 's' : ''}) registered in ${saved.wardOrBlock}.`,
        messageHindi: `समग्र परिवार ${saved.familyId} (${saved.headName}) ${saved.wardOrBlock} में पंजीकृत हुआ।`,
        wardOrBlock: saved.wardOrBlock,
      },
      'samagra_updated'
    );

    res.status(201).json({ success: true, family: saved });
  } catch (err) {
    const uniq = isUniqueConstraintError(err);
    if (uniq.isUnique) {
      return sendApiError(
        res,
        409,
        'This Samagra Family ID or Member ID is already registered in the portal.',
        'Duplicate Samagra households and member IDs are blocked. Search your existing ID above instead.',
        { code: 'SAMAGRA_DUPLICATE', portalUrl: SAMAGRA_PORTAL_URL }
      );
    }
    console.error('[API POST /api/samagra/register] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to register Samagra family record.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// Update Aadhaar eKYC or NPCI DBT status for a Samagra member (no synthetic DigiLocker fabrication)
app.patch('/api/samagra/:familyId/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { familyId, memberId } = req.params;
    const { ekycStatus, dbtActive } = req.body || {};

    const updated = await dbService.updateSamagraMemberStatus(familyId, memberId, {
      ekycStatus: ekycStatus !== undefined ? Boolean(ekycStatus) : undefined,
      dbtActive: dbtActive !== undefined ? Boolean(dbtActive) : undefined,
    });

    if (!updated) {
      return sendApiError(res, 404, 'Samagra family or member not found.');
    }

    await broadcastNotification(
      {
        id: `notif-${Date.now()}`,
        timestamp: formatNowTime(),
        type: 'samagra_synced',
        message: `Samagra Member ${memberId} updated (${ekycStatus !== undefined ? `eKYC: ${ekycStatus ? 'Verified' : 'Pending'}` : ''}${ekycStatus !== undefined && dbtActive !== undefined ? ', ' : ''}${dbtActive !== undefined ? `DBT: ${dbtActive ? 'Active' : 'Inactive'}` : ''}).`,
        messageHindi: `समग्र सदस्य ${memberId} की ई-केवाईसी / डीबीटी स्थिति अद्यतित हुई।`,
        wardOrBlock: updated.wardOrBlock,
      },
      'samagra_updated'
    );

    res.json({ success: true, family: updated });
  } catch (err) {
    console.error('[API PATCH /api/samagra/:familyId/members/:memberId] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to update Samagra member status.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// ================= DIGILOCKER LIVE WALLET (STRICT OAUTH 2.0) =================

// Fetch real DigiLocker credentials & mapped verified documents for a Citizen
app.get('/api/digilocker/:citizenKey', async (req: Request, res: Response) => {
  try {
    const citizenKey = req.params.citizenKey?.trim();
    if (!citizenKey) {
      return sendApiError(
        res,
        400,
        'Citizen identifier (Samagra Member ID or UID) is required.'
      );
    }
    const [documents, credentials] = await Promise.all([
      dbService.getDigiLockerDocuments(citizenKey),
      dbService.getDigiLockerCredentials(citizenKey),
    ]);
    res.json({
      citizenKey,
      documents,
      credentials,
      oauthConfigured: isDigiLockerOAuthConfigured(),
      redirectUri: buildDigiLockerRedirectUri(resolveAppBaseUrl(req)),
    });
  } catch (err) {
    console.error('[API GET /api/digilocker/:citizenKey] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to load DigiLocker documents.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// Synthetic document verification endpoints disabled: enforce Official DigiLocker OAuth 2.0 + PKCE
app.post('/api/digilocker/verify', async (req: Request, res: Response) => {
  const redirectUri = buildDigiLockerRedirectUri(resolveAppBaseUrl(req));
  return sendApiError(
    res,
    503,
    'Official DigiLocker OAuth 2.0 login is required to fetch and verify government documents.',
    `Synthetic/offline document fabrication is disabled. Click "Connect Official DigiLocker" (requires DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET, Callback URL: ${redirectUri}).`,
    { code: 'DIGILOCKER_OAUTH_REQUIRED', redirectUri }
  );
});

app.post('/api/digilocker/sync-all', async (req: Request, res: Response) => {
  const redirectUri = buildDigiLockerRedirectUri(resolveAppBaseUrl(req));
  return sendApiError(
    res,
    503,
    'Official DigiLocker OAuth 2.0 login is required to sync government documents.',
    `Synthetic bulk document syncing is disabled. Connect your DigiLocker MeriPehchaan account via OAuth 2.0 + PKCE (Callback URL: ${redirectUri}).`,
    { code: 'DIGILOCKER_OAUTH_REQUIRED', redirectUri }
  );
});

// Revoke / remove a stored DigiLocker credential or mapped document
app.delete('/api/digilocker/:citizenKey/:docId', async (req: Request, res: Response) => {
  try {
    const { citizenKey, docId } = req.params;
    await Promise.all([
      dbService.deleteDigiLockerDocument(citizenKey, docId),
      dbService.deleteDigiLockerCredential(citizenKey, docId),
    ]);
    const [documents, credentials] = await Promise.all([
      dbService.getDigiLockerDocuments(citizenKey),
      dbService.getDigiLockerCredentials(citizenKey),
    ]);
    pushSsePayload({ eventType: 'digilocker_updated', citizenKey });
    res.json({ success: true, documents, credentials });
  } catch (err) {
    console.error('[API DELETE /api/digilocker/:citizenKey/:docId] Error:', err);
    return sendApiError(
      res,
      500,
      'Failed to revoke DigiLocker document.',
      err instanceof Error ? err.message : undefined
    );
  }
});

// Unknown /api/* routes return clean JSON 404 instead of SPA HTML
app.use('/api', (_req: Request, res: Response) => {
  return sendApiError(res, 404, 'API endpoint not found.');
});

// Fallback Express error middleware
app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  const uniq = isUniqueConstraintError(err);
  if (uniq.isUnique) {
    return sendApiError(
      res,
      409,
      'A duplicate record conflict occurred.',
      'Please verify your inputs and avoid submitting duplicate records.'
    );
  }
  console.error('[API Unhandled Error]:', err);
  return sendApiError(
    res,
    500,
    'An unexpected server error occurred.',
    err instanceof Error ? err.message : undefined
  );
});

// Vite Development Server or Production Static Serving
async function startServer() {
  await dbService.init();
  await refreshSchemesCache();

  const isProduction = process.env.NODE_ENV === 'production';
  const isHmrDisabled = process.env.DISABLE_HMR === 'true';
  const httpServer = http.createServer(app);
  let viteServer: Awaited<ReturnType<typeof createViteServer>> | null = null;

  if (!isProduction) {
    viteServer = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        ws: isHmrDisabled ? (false as const) : undefined,
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(viteServer.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.on('error', err => {
    console.error('[YojanaSetu Indore] HTTP Server error:', err);
    process.exit(1);
  });

  const engineLabel =
    dbService.getStorageEngine() === 'postgresql'
      ? 'Supabase PostgreSQL'
      : 'SQLite fallback DB';

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[YojanaSetu Indore] Live Server listening on http://0.0.0.0:${PORT} with ${engineLabel}`
    );
  });

  const shutdown = async () => {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.length = 0;
    if (viteServer) {
      await viteServer.close().catch(() => {});
    }
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch(err => {
  console.error('[YojanaSetu Indore] Fatal server startup error:', err);
  process.exit(1);
});
