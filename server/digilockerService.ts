import crypto from 'node:crypto';
import type { Request } from 'express';
import { DigiLockerCredentialRecord } from '../src/types/index.js';

export const DIGILOCKER_CALLBACK_PATH = '/api/auth/digilocker/callback';
export const DEFAULT_DIGILOCKER_AUTH_URL =
  'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize';
export const DEFAULT_DIGILOCKER_TOKEN_URL =
  'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token';
export const DEFAULT_DIGILOCKER_ISSUED_DOCS_URL =
  'https://digilocker.meripehchaan.gov.in/public/oauth2/2/files/issued';

export interface DigiLockerOAuthConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  issuedDocsUrl: string;
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
}

function bufferToBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getDigiLockerConfig(): DigiLockerOAuthConfig | null {
  const clientId = process.env.DIGILOCKER_CLIENT_ID?.trim();
  const clientSecret = process.env.DIGILOCKER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return null;
  }
  return {
    clientId,
    clientSecret,
    authUrl: process.env.DIGILOCKER_AUTH_URL?.trim() || DEFAULT_DIGILOCKER_AUTH_URL,
    tokenUrl: process.env.DIGILOCKER_TOKEN_URL?.trim() || DEFAULT_DIGILOCKER_TOKEN_URL,
    issuedDocsUrl:
      process.env.DIGILOCKER_ISSUED_DOCS_URL?.trim() || DEFAULT_DIGILOCKER_ISSUED_DOCS_URL,
  };
}

export function isDigiLockerOAuthConfigured(): boolean {
  return getDigiLockerConfig() !== null;
}

export function generateOAuthState(): string {
  return bufferToBase64Url(crypto.randomBytes(24));
}

export function computePkceChallenge(codeVerifier: string): string {
  return bufferToBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
}

export function generatePkcePair(): PkcePair {
  const codeVerifier = bufferToBase64Url(crypto.randomBytes(32));
  return {
    codeVerifier,
    codeChallenge: computePkceChallenge(codeVerifier),
    method: 'S256',
  };
}

/**
 * Resolves the authoritative application origin for OAuth redirect_uri construction.
 * Always prefers process.env.APP_URL (stripped of trailing slash) per iframe OAuth rules.
 */
export function resolveAppBaseUrl(req?: Pick<Request, 'headers' | 'protocol'>): string {
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl) {
    return envAppUrl.replace(/\/+$/, '');
  }
  if (req) {
    const xfProto = req.headers['x-forwarded-proto'];
    const proto = (typeof xfProto === 'string' ? xfProto.split(',')[0].trim() : req.protocol) || 'http';
    const host =
      (typeof req.headers['x-forwarded-host'] === 'string'
        ? req.headers['x-forwarded-host'].split(',')[0].trim()
        : req.headers.host) || 'localhost:3000';
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function buildDigiLockerRedirectUri(appBaseUrl: string): string {
  return `${appBaseUrl.replace(/\/+$/, '')}${DIGILOCKER_CALLBACK_PATH}`;
}

export function buildDigiLockerAuthorizeUrl(params: {
  config: DigiLockerOAuthConfig;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(params.config.authUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.config.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('state', params.state);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export function inferCanonicalDocId(raw: {
  uri?: string;
  doctype?: string;
  name?: string;
  issuer?: string;
}): string | undefined {
  const haystack = `${raw.doctype || ''} ${raw.uri || ''} ${raw.name || ''} ${raw.issuer || ''}`.toLowerCase();
  if (haystack.includes('adhaar') || haystack.includes('aadhaar') || haystack.includes('uidai')) {
    return 'aadhaar';
  }
  if (haystack.includes('samagra') && haystack.includes('family')) return 'samagra_family';
  if (haystack.includes('samagra')) return 'samagra_member';
  if (haystack.includes('domicile') || haystack.includes('niwas')) return 'mp_domicile';
  if (haystack.includes('income') || haystack.includes('aay')) return 'income_cert';
  if (haystack.includes('khasra') || haystack.includes('bhulekh')) return 'khasra_b1';
  if (haystack.includes('caste') || haystack.includes('jati')) return 'caste_cert';
  if (haystack.includes('ration') || haystack.includes('bpl')) return 'bpl_ration';
  if (haystack.includes('udid') || haystack.includes('disability')) return 'udid_card';
  if (haystack.includes('birth')) return 'birth_cert';
  if (haystack.includes('bank') || haystack.includes('dbt') || haystack.includes('npci')) return 'bank_dbt';
  return undefined;
}

/**
 * Normalizes official DigiLocker /files/issued JSON items into `DigiLockerCredentialRecord[]`.
 */
export function mapDigiLockerIssuedDocsPayload(
  payload: any,
  citizenId: string,
  verifiedAtIso: string = new Date().toISOString()
): DigiLockerCredentialRecord[] {
  const rawItems: any[] = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.documents)
    ? payload.documents
    : Array.isArray(payload)
    ? payload
    : [];

  const deduped = new Map<string, DigiLockerCredentialRecord>();

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const docUri = String(item.uri ?? item.doc_uri ?? item.docUri ?? '').trim();
    const docName = String(item.name ?? item.description ?? item.doctype ?? '').trim();
    const issuer = String(item.issuer ?? item.issuerid ?? 'DigiLocker Issuer').trim();
    if (!docUri || !docName) continue;

    const docId = inferCanonicalDocId({
      uri: docUri,
      doctype: item.doctype,
      name: docName,
      issuer,
    });
    const docNumber = String(item.docNumber ?? item.id ?? item.uri ?? '').trim() || undefined;
    const mimeType = String(item.mime ?? item.mimeType ?? 'application/pdf').trim();
    const issuedAt = String(item.date ?? item.issuedAt ?? '').trim() || undefined;

    deduped.set(docUri, {
      id: `${citizenId}:${Buffer.from(docUri).toString('base64url').slice(0, 32)}`,
      citizenId,
      docId,
      docUri,
      docName,
      docNumber,
      issuer,
      mimeType,
      verified: true,
      issuedAt,
      verifiedAt: verifiedAtIso,
    });
  }

  return Array.from(deduped.values());
}

export async function exchangeDigiLockerCode(params: {
  config: DigiLockerOAuthConfig;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ accessToken: string; tokenType: string; expiresIn?: number; scope?: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.config.clientId,
    client_secret: params.config.clientSecret,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(params.config.tokenUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok || !json?.access_token) {
      const msg =
        json?.error_description ||
        json?.error ||
        `DigiLocker token exchange failed with HTTP ${response.status}`;
      throw new Error(String(msg));
    }

    return {
      accessToken: String(json.access_token),
      tokenType: String(json.token_type || 'Bearer'),
      expiresIn: typeof json.expires_in === 'number' ? json.expires_in : undefined,
      scope: typeof json.scope === 'string' ? json.scope : undefined,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchDigiLockerIssuedDocs(params: {
  config: DigiLockerOAuthConfig;
  accessToken: string;
  citizenId: string;
}): Promise<DigiLockerCredentialRecord[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(params.config.issuedDocsUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      const msg =
        json?.error_description ||
        json?.error ||
        `DigiLocker Issued Documents API responded with HTTP ${response.status}`;
      throw new Error(String(msg));
    }

    return mapDigiLockerIssuedDocsPayload(json, params.citizenId);
  } finally {
    clearTimeout(timeoutId);
  }
}
