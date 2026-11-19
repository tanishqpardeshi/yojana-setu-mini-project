import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NextFunction, Request, Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  try {
    const cfgPath = path.resolve(__dirname, '../firebase-applet-config.json');
    const raw = fs.readFileSync(cfgPath, 'utf-8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return { projectId: process.env.FIREBASE_PROJECT_ID || '' };
  }
}

const firebaseConfig = loadFirebaseConfig();
const FIREBASE_PROJECT_ID = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID || '';
const FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';

// Bootstrapped admin email allowlist (verified email required) + optional env override
const DEFAULT_ADMIN_EMAILS = ['tanishqpardeshi9the12102@gmail.com'];
const ENV_ADMIN_EMAILS = (process.env.ADMIN_ALLOWLIST_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export const TRUSTED_ADMIN_EMAILS = Array.from(
  new Set([...DEFAULT_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS])
);

export interface VerifiedFirebaseTokenPayload {
  iss: string;
  aud: string;
  auth_time: number;
  user_id?: string;
  sub: string;
  iat: number;
  exp: number;
  email?: string;
  email_verified?: boolean;
  name?: string;
  role?: string;
  admin?: boolean;
  [key: string]: unknown;
}

export interface AuthenticatedPrincipal {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  role: 'citizen' | 'admin';
  adminSource?: 'custom_claim' | 'firestore_admins' | 'verified_owner_email';
  rawToken: string;
}

declare global {
  namespace Express {
    interface Request {
      authPrincipal?: AuthenticatedPrincipal;
    }
  }
}

// Cache Google SecureToken public X.509 certificates
let cachedCerts: Record<string, string> | null = null;
let certsExpiresAtMs = 0;

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cachedCerts && now < certsExpiresAtMs) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google SecureToken certs (HTTP ${res.status})`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = certs;
  certsExpiresAtMs = now + Math.max(60, maxAgeSec) * 1000;
  return certs;
}

function base64UrlToBuffer(segment: string): Buffer {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLen), 'base64');
}

function parseJsonSegment<T>(segment: string): T {
  const raw = base64UrlToBuffer(segment).toString('utf-8');
  return JSON.parse(raw) as T;
}

export interface TokenVerifyOptions {
  projectId?: string;
  nowSec?: number;
  getCerts?: () => Promise<Record<string, string>>;
}

/**
 * Cryptographically verifies a Firebase Auth RS256 ID token against Google's official X.509 certs.
 * Zero IAM required — validates signature, alg, aud, iss, sub, exp, iat, and auth_time.
 */
export async function verifyFirebaseIdToken(
  token: string,
  options: TokenVerifyOptions = {}
): Promise<VerifiedFirebaseTokenPayload> {
  const projectId = options.projectId ?? FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Firebase projectId is not configured on server');
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT token');
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { alg?: string; kid?: string; typ?: string };
  let payload: VerifiedFirebaseTokenPayload;

  try {
    header = parseJsonSegment(headerB64);
    payload = parseJsonSegment(payloadB64);
  } catch {
    throw new Error('Invalid JWT encoding');
  }

  if (header.alg !== 'RS256' || !header.kid || typeof header.kid !== 'string') {
    throw new Error('Unsupported JWT algorithm or missing key ID');
  }

  const certs = await (options.getCerts ? options.getCerts() : fetchGooglePublicCerts());
  const publicKeyOrCert = certs[header.kid];
  if (!publicKeyOrCert) {
    throw new Error('Unknown JWT signing key ID');
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureBuf = base64UrlToBuffer(sigB64);

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(signingInput);
  verifier.end();

  const isSignatureValid = verifier.verify(publicKeyOrCert, signatureBuf);
  if (!isSignatureValid) {
    throw new Error('Invalid JWT cryptographic signature');
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) {
    throw new Error('JWT audience mismatch');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('JWT issuer mismatch');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0 || payload.sub.length > 128) {
    throw new Error('JWT subject (uid) is invalid');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('JWT token has expired');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('JWT issued-at time is in the future');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
    throw new Error('JWT auth_time is in the future');
  }

  return payload;
}

/**
 * Checks whether /admins/{uid} exists in Firestore using the caller's own verified Firebase ID token.
 * Enforces Firestore Security Rules directly with zero server-side IAM requirement.
 */
async function checkFirestoreAdminRegistry(uid: string, rawIdToken: string): Promise<boolean> {
  if (!FIREBASE_PROJECT_ID || !uid || !rawIdToken) return false;
  const dbId = encodeURIComponent(FIRESTORE_DATABASE_ID);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIREBASE_PROJECT_ID
  )}/databases/${dbId}/documents/admins/${encodeURIComponent(uid)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${rawIdToken}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const doc = (await res.json()) as { fields?: { role?: { stringValue?: string }; active?: { booleanValue?: boolean } } };
    const activeVal = doc?.fields?.active?.booleanValue;
    if (activeVal === false) return false;
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export interface AdminAuthCheckOptions {
  allowlistEmails?: string[];
  checkFirestoreAdmin?: (uid: string, rawToken: string) => Promise<boolean>;
}

/**
 * Evaluates whether a cryptographically verified Firebase token payload holds Admin privileges.
 * Rejects unverified emails and enforces explicit claim / registry / allowlist verification.
 */
export async function evaluateAdminAuthorization(
  payload: VerifiedFirebaseTokenPayload,
  rawToken: string,
  options: AdminAuthCheckOptions = {}
): Promise<AuthenticatedPrincipal> {
  const uid = payload.sub;
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const emailVerified = payload.email_verified === true;
  const displayName =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : email || 'District Officer';

  // 1. Custom Firebase Auth JWT role claims (requires verified email if email present)
  if ((payload.role === 'admin' || payload.admin === true) && (emailVerified || !email)) {
    return {
      uid,
      email,
      emailVerified,
      displayName,
      role: 'admin',
      adminSource: 'custom_claim',
      rawToken,
    };
  }

  // 2. Bootstrapped verified owner/admin email allowlist (strictly requires email_verified === true)
  const allowlist = (options.allowlistEmails ?? TRUSTED_ADMIN_EMAILS).map(e => e.toLowerCase());
  if (email && emailVerified && allowlist.includes(email)) {
    return {
      uid,
      email,
      emailVerified,
      displayName,
      role: 'admin',
      adminSource: 'verified_owner_email',
      rawToken,
    };
  }

  // 3. Trusted Firestore admins/{uid} document lookup (enforced by firestore.rules)
  if (emailVerified) {
    const checker = options.checkFirestoreAdmin ?? checkFirestoreAdminRegistry;
    const inAdminsCollection = await checker(uid, rawToken);
    if (inAdminsCollection) {
      return {
        uid,
        email,
        emailVerified,
        displayName,
        role: 'admin',
        adminSource: 'firestore_admins',
        rawToken,
      };
    }
  }

  return {
    uid,
    email,
    emailVerified,
    displayName,
    role: 'citizen',
    rawToken,
  };
}

export function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Express middleware enforcing authenticated Admin RBAC on all admin endpoints.
 * - Missing/invalid/expired token -> 401 Unauthorized
 * - Valid token without Admin role claim/registry -> 403 Forbidden
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: Missing Administrator Bearer token.',
        code: 'AUTH_REQUIRED',
      });
    }

    const payload = await verifyFirebaseIdToken(token);
    const principal = await evaluateAdminAuthorization(payload, token);

    if (principal.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden: Verified Administrator role claim is required for this operation.',
        code: 'ADMIN_ROLE_REQUIRED',
      });
    }

    req.authPrincipal = principal;
    return next();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Token verification failed';
    return res.status(401).json({
      error: `Unauthorized: Invalid or expired authentication token (${msg}).`,
      code: 'INVALID_TOKEN',
    });
  }
}

/**
 * Non-blocking helper to check if a request carries a valid Admin token (returns principal or null).
 */
export async function resolveAdminPrincipalIfPresent(
  req: Request
): Promise<AuthenticatedPrincipal | null> {
  const token = extractBearerToken(req);
  if (!token) return null;
  try {
    const payload = await verifyFirebaseIdToken(token);
    const principal = await evaluateAdminAuthorization(payload, token);
    return principal.role === 'admin' ? principal : null;
  } catch {
    return null;
  }
}
