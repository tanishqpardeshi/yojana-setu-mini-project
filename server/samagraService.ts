import { dbService } from './db.js';
import {
  SAMAGRA_PORTAL_URL,
  validateSamagraLookupId,
} from '../src/utils/samagraValidator.js';
import {
  AreaType,
  Category,
  FamilyMember,
  Gender,
  MaritalStatus,
  OccupationType,
  SamagraFamily,
} from '../src/types/index.js';

export type SamagraLookupStatus =
  | 'invalid_format'
  | 'found_live'
  | 'found_cache'
  | 'not_found_live'
  | 'credentials_not_configured'
  | 'upstream_error';

export interface SamagraLookupOutcome {
  status: SamagraLookupStatus;
  httpStatus: number;
  liveConfigured: boolean;
  portalUrl: string;
  source?: 'samagra_gov_in' | 'local_db_cache';
  family?: SamagraFamily;
  notice?: string;
  error?: string;
  details?: string;
  code?: string;
  allowManualEntry?: boolean;
}

function getSamagraConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.SAMAGRA_API_URL?.trim();
  const apiKey = process.env.SAMAGRA_API_KEY?.trim();
  if (!apiUrl || !apiKey) return null;
  return { apiUrl, apiKey };
}

function normalizeGender(val: unknown): Gender {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'm' || s === 'male') return 'male';
  if (s === 't' || s === 'other' || s === 'transgender') return 'transgender';
  return 'female';
}

function normalizeCategory(val: unknown): Category {
  const s = String(val ?? '').trim().toUpperCase();
  if (s === 'SC' || s === 'ST' || s === 'OBC' || s === 'EWS') return s;
  return 'GEN';
}

function normalizeAreaType(val: unknown): AreaType {
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'rural' ? 'rural' : 'urban';
}

function normalizeMarital(val: unknown): MaritalStatus {
  const s = String(val ?? '').trim().toLowerCase();
  if (s === 'unmarried' || s === 'single') return 'Unmarried';
  if (s === 'widow' || s === 'widowed') return 'Widow';
  if (s === 'divorced') return 'Divorced';
  return 'Married';
}

export function mapExternalSamagraPayload(
  payload: any,
  requestedId: string
): SamagraFamily | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload.family && typeof payload.family === 'object' ? payload.family : payload;

  const familyIdRaw =
    root.familyId ?? root.family_id ?? root.samagraFamilyId ?? root.parivarId ?? requestedId;
  const familyId = String(familyIdRaw || '').trim();
  if (!/^\d{8}$/.test(familyId)) {
    return null;
  }

  const rawMembers: any[] = Array.isArray(root.members)
    ? root.members
    : Array.isArray(root.memberList)
    ? root.memberList
    : [];

  if (rawMembers.length === 0) return null;

  const members: FamilyMember[] = rawMembers
    .map((m, idx): FamilyMember | null => {
      if (!m || typeof m !== 'object') return null;
      const memberId = String(
        m.memberId ?? m.member_id ?? m.samagraId ?? m.samagra_id ?? ''
      ).trim();
      const name = String(m.name ?? m.memberName ?? m.fullName ?? '').trim();
      if (!/^\d{9}$/.test(memberId) || !name) return null;

      return {
        memberId,
        name,
        nameHindi: String(m.nameHindi ?? m.name_hindi ?? name).trim(),
        relation: String(m.relation ?? (idx === 0 ? 'Self / Head' : 'Member')).trim(),
        relationHindi: String(
          m.relationHindi ?? m.relation_hindi ?? (idx === 0 ? 'मुखिया' : 'सदस्य')
        ).trim(),
        age: Number.isFinite(Number(m.age)) ? Math.max(0, Math.min(120, Number(m.age))) : 30,
        gender: normalizeGender(m.gender),
        category: normalizeCategory(m.category),
        occupation: (String(m.occupation || 'Other').trim() || 'Other') as OccupationType,
        ekycStatus: Boolean(m.ekycStatus ?? m.ekyc_status ?? m.ekycVerified ?? false),
        dbtActive: Boolean(m.dbtActive ?? m.dbt_active ?? m.dbtEnabled ?? false),
        annualIncome: Number.isFinite(Number(m.annualIncome ?? m.annual_income))
          ? Number(m.annualIncome ?? m.annual_income)
          : 150000,
        landHoldingHectares: Number.isFinite(Number(m.landHoldingHectares ?? m.land_holding_hectares))
          ? Number(m.landHoldingHectares ?? m.land_holding_hectares)
          : 0,
        hasDisability: Boolean(m.hasDisability ?? m.has_disability),
        maritalStatus: normalizeMarital(m.maritalStatus ?? m.marital_status),
      };
    })
    .filter((m): m is FamilyMember => m !== null);

  if (members.length === 0) return null;

  const rationRaw = String(root.rationCardType ?? root.ration_card_type ?? 'APL')
    .trim()
    .toUpperCase();
  const rationCardType: SamagraFamily['rationCardType'] =
    rationRaw === 'BPL' ? 'BPL' : rationRaw === 'AAY' || rationRaw === 'ANTYODAYA' ? 'Antyodaya' : 'APL';

  return {
    familyId,
    headName: String(root.headName ?? root.head_name ?? members[0].name).trim(),
    areaType: normalizeAreaType(root.areaType ?? root.area_type),
    wardOrBlock: String(
      root.wardOrBlock ?? root.ward_or_block ?? 'Ward 1 (Indore IMC)'
    ).trim(),
    address: String(root.address ?? 'Indore District, Madhya Pradesh').trim(),
    rationCardType,
    members,
    source: 'samagra_gov_in',
  };
}

export async function fetchLiveSamagraDetails(rawId: string): Promise<SamagraLookupOutcome> {
  const validation = validateSamagraLookupId(rawId);
  if (!validation.valid) {
    return {
      status: 'invalid_format',
      httpStatus: 400,
      liveConfigured: Boolean(getSamagraConfig()),
      portalUrl: SAMAGRA_PORTAL_URL,
      code: 'INVALID_SAMAGRA_FORMAT',
      error: validation.error || 'Invalid Samagra ID format.',
      details:
        'Samagra Family IDs must be strictly 8 numeric digits and Samagra Member IDs must be strictly 9 numeric digits.',
    };
  }

  const cleanedId = validation.cleaned;
  const config = getSamagraConfig();

  if (config) {
    const targetUrl = config.apiUrl.includes('{id}')
      ? config.apiUrl.replace('{id}', encodeURIComponent(cleanedId))
      : `${config.apiUrl}${config.apiUrl.includes('?') ? '&' : '?'}samagraId=${encodeURIComponent(cleanedId)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
          'X-API-Key': config.apiKey,
          'User-Agent': 'YojanaSetu-Indore-SamagraGateway/1.0',
        },
      });

      if (response.status === 404) {
        return {
          status: 'not_found_live',
          httpStatus: 404,
          liveConfigured: true,
          portalUrl: SAMAGRA_PORTAL_URL,
          code: 'SAMAGRA_NOT_FOUND_LIVE',
          allowManualEntry: true,
          error: `No household record was returned by MP Samagra Portal for ID "${cleanedId}".`,
          details: `Verify your Family/Member ID on ${SAMAGRA_PORTAL_URL} or register your verified details manually below.`,
        };
      }

      if (!response.ok) {
        throw new Error(`Upstream Samagra Portal responded with HTTP ${response.status}`);
      }

      const rawPayload = await response.json();
      const mapped = mapExternalSamagraPayload(rawPayload, cleanedId);
      if (!mapped) {
        throw new Error('Upstream Samagra Portal returned an unexpected or incomplete household payload.');
      }

      const cached = await dbService.upsertSamagraFamilyFromPortal(mapped, 'samagra_gov_in');

      return {
        status: 'found_live',
        httpStatus: 200,
        liveConfigured: true,
        portalUrl: SAMAGRA_PORTAL_URL,
        source: 'samagra_gov_in',
        family: cached,
        notice: 'Verified live from MP Samagra Portal API and cached in YojanaSetu PostgreSQL.',
      };
    } catch (err) {
      const cachedFallback = await dbService.getSamagraFamily(cleanedId);
      if (cachedFallback) {
        return {
          status: 'found_cache',
          httpStatus: 200,
          liveConfigured: true,
          portalUrl: SAMAGRA_PORTAL_URL,
          source: 'local_db_cache',
          family: cachedFallback,
          notice: `Live Samagra Portal endpoint could not be reached (${
            err instanceof Error ? err.message : 'network error'
          }); loaded previously verified record from database cache.`,
        };
      }

      return {
        status: 'upstream_error',
        httpStatus: 502,
        liveConfigured: true,
        portalUrl: SAMAGRA_PORTAL_URL,
        code: 'SAMAGRA_UPSTREAM_ERROR',
        allowManualEntry: true,
        error: 'Unable to fetch live details from the configured MP Samagra Portal API.',
        details: `${
          err instanceof Error ? err.message : 'Upstream timeout or error.'
        } Verify your ID at ${SAMAGRA_PORTAL_URL} or register manually below.`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Official government API credentials are NOT configured
  const cachedRecord = await dbService.getSamagraFamily(cleanedId);
  if (cachedRecord) {
    return {
      status: 'found_cache',
      httpStatus: 200,
      liveConfigured: false,
      portalUrl: SAMAGRA_PORTAL_URL,
      source: 'local_db_cache',
      family: cachedRecord,
      notice:
        'Loaded from verified citizen database. Live automatic MP Samagra Portal (samagra.gov.in) sync requires official MPSEDC/NIC API credentials.',
    };
  }

  return {
    status: 'credentials_not_configured',
    httpStatus: 404,
    liveConfigured: false,
    portalUrl: SAMAGRA_PORTAL_URL,
    code: 'SAMAGRA_CREDENTIALS_NOT_CONFIGURED',
    allowManualEntry: true,
    error: `Live MP Samagra Portal (samagra.gov.in) lookup for ID "${cleanedId}" requires official MPSEDC/NIC API credentials (SAMAGRA_API_URL & SAMAGRA_API_KEY).`,
    details: `Official government API credentials are not configured on this server. Please verify your 8-digit Family / 9-digit Member details directly at ${SAMAGRA_PORTAL_URL} and enter/register your household manually below without creating duplicates.`,
  };
}
