import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextFunction, Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface CitizenTokenPayload {
  typ: 'citizen_session';
  sub: string;
  email: string;
  displayName: string;
  role: 'citizen';
  iat: number;
  exp: number;
}

export interface CitizenPrincipal {
  uid: string;
  email: string;
  displayName: string;
  role: 'citizen';
  rawToken: string;
}

declare global {
  namespace Express {
    interface Request {
      citizenPrincipal?: CitizenPrincipal;
    }
  }
}

let cachedDevSecret: string | null = null;

/**
 * Resolves the HMAC secret used to sign Citizen Email/Password session tokens.
 * Prefers CITIZEN_AUTH_SECRET / SESSION_SECRET env vars; falls back to an auto-generated
 * local file-persisted secret in data/.citizen-auth-secret for preview restarts.
 */
export function getCitizenAuthSecret(): string {
  const envSecret =
    process.env.CITIZEN_AUTH_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (envSecret && envSecret.length >= 16) {
    return envSecret;
  }

  if (cachedDevSecret) {
    return cachedDevSecret;
  }

  try {
    const dataDir = path.resolve(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const secretFile = path.join(dataDir, '.citizen-auth-secret');
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf-8').trim();
      if (existing.length >= 32) {
        cachedDevSecret = existing;
        return cachedDevSecret;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    cachedDevSecret = generated;
    return cachedDevSecret;
  } catch {
    cachedDevSecret = crypto.randomBytes(32).toString('hex');
    return cachedDevSecret;
  }
}

function bufferToBase64Url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

/**
 * Hashes a citizen password using crypto.scrypt with a 16-byte cryptographic salt.
 */
export async function hashCitizenPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string' || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      KEY_LEN,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
  return `scrypt$${SCRYPT_N}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export async function verifyCitizenPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') {
    return false;
  }

  const costN = Number(parts[1]);
  const salt = parts[2];
  const expectedHex = parts[3];
  if (!Number.isFinite(costN) || costN <= 0 || !salt || !expectedHex) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (expectedBuf.length === 0) return false;

    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        expectedBuf.length,
        { N: costN, r: SCRYPT_R, p: SCRYPT_P },
        (err, key) => {
          if (err) reject(err);
          else resolve(key);
        }
      );
    });

    if (derivedKey.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(derivedKey, expectedBuf);
  } catch {
    return false;
  }
}

export interface CitizenTokenSignOptions {
  secret?: string;
  ttlSeconds?: number;
  nowSec?: number;
}

/**
 * Signs an isolated Citizen-only HMAC-SHA256 session token (never grants Admin claims).
 */
export function signCitizenSessionToken(
  subject: { uid: string; email: string; displayName: string },
  options: CitizenTokenSignOptions = {}
): string {
  const secret = options.secret || getCitizenAuthSecret();
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: CitizenTokenPayload = {
    typ: 'citizen_session',
    sub: subject.uid,
    email: subject.email.trim().toLowerCase(),
    displayName: subject.displayName.trim() || 'Citizen of Indore',
    role: 'citizen',
    iat: nowSec,
    exp: nowSec + ttl,
  };

  const headerB64 = bufferToBase64Url(Buffer.from(JSON.stringify(header), 'utf-8'));
  const payloadB64 = bufferToBase64Url(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const sigB64 = bufferToBase64Url(signature);
  return `${signingInput}.${sigB64}`;
}

export interface CitizenTokenVerifyOptions {
  secret?: string;
  nowSec?: number;
}

/**
 * Verifies a Citizen session token signature, type, role, and expiry.
 */
export function verifyCitizenSessionToken(
  token: string,
  options: CitizenTokenVerifyOptions = {}
): CitizenTokenPayload {
  const secret = options.secret || getCitizenAuthSecret();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed citizen session token');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; typ?: string };
  let payload: CitizenTokenPayload;

  try {
    header = JSON.parse(base64UrlToBuffer(headerB64).toString('utf-8'));
    payload = JSON.parse(base64UrlToBuffer(payloadB64).toString('utf-8'));
  } catch {
    throw new Error('Invalid token encoding');
  }

  if (header.alg !== 'HS256') {
    throw new Error('Unsupported citizen token algorithm');
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const providedSig = base64UrlToBuffer(sigB64);

  if (
    providedSig.length !== expectedSig.length ||
    !crypto.timingSafeEqual(providedSig, expectedSig)
  ) {
    throw new Error('Invalid citizen session signature');
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);

  if (payload.typ !== 'citizen_session' || payload.role !== 'citizen') {
    throw new Error('Invalid citizen token claims');
  }
  if (typeof payload.sub !== 'string' || payload.sub.trim().length === 0) {
    throw new Error('Invalid citizen subject');
  }
  if (typeof payload.email !== 'string' || payload.email.trim().length === 0) {
    throw new Error('Invalid citizen email claim');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Citizen session token expired');
  }

  return payload;
}

export function extractCitizenBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export function requireCitizenAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractCitizenBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Citizen session token is required.',
      code: 'CITIZEN_AUTH_REQUIRED',
    });
  }

  try {
    const payload = verifyCitizenSessionToken(token);
    req.citizenPrincipal = {
      uid: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      role: 'citizen',
      rawToken: token,
    };
    return next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid session';
    return res.status(401).json({
      error: `Unauthorized: Invalid or expired citizen session (${msg}).`,
      code: 'CITIZEN_INVALID_TOKEN',
    });
  }
}
