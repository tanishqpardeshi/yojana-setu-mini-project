import {
  AreaType,
  Category,
  CitizenProfile,
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  FamilyMember,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
  SamagraFamily,
} from '../types';
import { parseApiResponse } from '../utils/apiClient';
import { SAMAGRA_PORTAL_URL } from '../utils/samagraValidator';

/**
 * Toggle between self-contained e-Governance mock APIs (/api/gov/*)
 * and live production endpoints (/api/samagra/*, /api/auth/mobile/*, /api/auth/digilocker/*).
 * Set VITE_USE_MOCK_API=false in environment to switch seamlessly to production APIs.
 */
export const USE_MOCK_API: boolean =
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_USE_MOCK_API !==
  'false';

export interface GovSamagraCitizen {
  memberId: string;
  familyId: string;
  name: string;
  nameHindi: string;
  dob: string;
  age: number;
  gender: Gender;
  category: Category;
  maritalStatus: MaritalStatus;
  district: string;
  districtCode: string;
  areaType: AreaType;
  localBody: string;
  wardNumber?: number;
  blockName?: JanpadBlock;
  gramPanchayat?: string;
  wardOrBlock: string;
  address: string;
  ekycStatus: 'VERIFIED' | 'PENDING';
  ekycVerified: boolean;
  dbtActive: boolean;
  annualIncome: number;
  occupation: OccupationType;
  landHoldingHectares: number;
  rationCardType: 'APL' | 'BPL' | 'Antyodaya';
  isBPL: boolean;
  hasDisability: boolean;
  mobileNumber: string;
  mobileE164: string;
  tierTag?: string;
  expectedSchemesSummary?: string;
}

export interface DemoCitizenCredential {
  memberId: string;
  familyId: string;
  name: string;
  nameHindi: string;
  roleLabel: string;
  locationLabel: string;
  incomeLabel: string;
  highlights: string;
  mobileNumber: string;
  accent: 'amber' | 'emerald' | 'blue';
}

export const DEMO_CITIZEN_CREDENTIALS: DemoCitizenCredential[] = [
  {
    memberId: '123456789',
    familyId: '48291034',
    name: 'Sunita Sharma',
    nameHindi: 'सुनीता शर्मा',
    roleLabel: 'Urban Female · Married · Age 34',
    locationLabel: 'Indore · IMC Ward 72 (Vijay Nagar)',
    incomeLabel: '₹1,50,000 / yr',
    highlights: 'Triggers Ladli Behna & IMC Urban Schemes',
    mobileNumber: '+91 9826012345',
    accent: 'amber',
  },
  {
    memberId: '234567890',
    familyId: '59302145',
    name: 'Ramesh Patel',
    nameHindi: 'रमेश पटेल',
    roleLabel: 'Rural Farmer · 1.5 Ha Land · BPL',
    locationLabel: 'Indore · Sanwer Janpad Panchayat',
    incomeLabel: '₹1,80,000 / yr',
    highlights: 'Triggers PM-KISAN & Level 6 Rural Janpad Schemes',
    mobileNumber: '+91 9826023456',
    accent: 'emerald',
  },
  {
    memberId: '345678901',
    familyId: '60413256',
    name: 'Aarav Verma',
    nameHindi: 'आरव वर्मा',
    roleLabel: 'Urban Student / Youth · Age 21',
    locationLabel: 'Indore · IMC Ward 39 (Bhavarkua)',
    incomeLabel: '₹2,40,000 / yr',
    highlights: 'Triggers MMVY & Seekho Kamao Schemes',
    mobileNumber: '+91 9826034567',
    accent: 'blue',
  },
];

export interface SamagraVerifyResponse {
  ok: boolean;
  status: number;
  citizen?: GovSamagraCitizen;
  family?: SamagraFamily;
  source?: string;
  requestId?: string;
  notice?: string;
  liveConfigured?: boolean;
  error?: string;
  details?: string;
  code?: string;
  portalUrl?: string;
  allowManualEntry?: boolean;
}

export interface SendOtpResponse {
  ok: boolean;
  status: number;
  mobileNumber?: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  message?: string;
  retryAfterSeconds?: number;
  // TRAI DLT metadata & sandbox demo OTP
  dltStatus?: string;
  templateId?: string;
  entityId?: string;
  senderId?: string;
  messageId?: string;
  demoOtp?: string;
  error?: string;
  details?: string;
  code?: string;
}

export interface VerifyOtpResponse {
  ok: boolean;
  status: number;
  mobileNumber?: string;
  mobileVerified?: boolean;
  verificationToken?: string;
  message?: string;
  remainingAttempts?: number;
  error?: string;
  details?: string;
  code?: string;
}

export interface DigiLockerTokenResponse {
  ok: boolean;
  status: number;
  access_token?: string;
  token_type?: 'Bearer';
  expires_in?: number;
  scope?: string;
  consentId?: string;
  citizenKey?: string;
  error?: string;
  details?: string;
}

export interface DigiLockerIssuedDocItem {
  uri: string;
  docId: string;
  docType: string;
  name: string;
  docNumber: string;
  issuer: string;
  issuerId: string;
  mimeType: string;
  issuedDate: string;
  verificationStatus: 'VERIFIED';
  verified: boolean;
}

export interface FetchDigiLockerDocsResponse {
  ok: boolean;
  status: number;
  citizenKey?: string;
  consentId?: string;
  scopes?: string[];
  issuedDocs?: DigiLockerIssuedDocItem[];
  credentials?: DigiLockerCredentialRecord[];
  documents?: DigiLockerDocumentRecord[];
  error?: string;
  details?: string;
}

/**
 * Convert a verified Samagra Citizen payload into a CitizenProfile
 * (leaves DigiLocker documents unverified until DigiLocker consent fetch runs
 * so schemes transition cleanly from Likely 85% -> Eligible 100%).
 */
export function mapGovCitizenToProfile(citizen: GovSamagraCitizen): CitizenProfile {
  return {
    fullName: citizen.name,
    age: citizen.age,
    gender: citizen.gender,
    category: citizen.category,
    areaType: citizen.areaType,
    wardNumber: citizen.areaType === 'urban' ? citizen.wardNumber || 72 : undefined,
    blockName: citizen.areaType === 'rural' ? citizen.blockName || 'Sanwer' : undefined,
    gramPanchayat: citizen.gramPanchayat,
    annualIncome: citizen.annualIncome,
    occupation: citizen.occupation,
    landHoldingHectares: citizen.landHoldingHectares,
    isBPL: citizen.isBPL,
    hasDisability: citizen.hasDisability,
    disabilityPercent: citizen.hasDisability ? 45 : 0,
    maritalStatus: citizen.maritalStatus,
    isMpDomicile: true,
    isIndoreResident: true,
    samagraFamilyId: citizen.familyId,
    samagraMemberId: citizen.memberId,
    phone: citizen.mobileE164 || citizen.mobileNumber,
    verifiedDocuments: {},
  };
}

export function mapGovCitizenToFamilyMember(citizen: GovSamagraCitizen): FamilyMember {
  return {
    memberId: citizen.memberId,
    name: citizen.name,
    nameHindi: citizen.nameHindi,
    relation: 'Self / Head',
    relationHindi: 'स्वयं / मुखिया',
    age: citizen.age,
    gender: citizen.gender,
    category: citizen.category,
    occupation: citizen.occupation,
    ekycStatus: citizen.ekycVerified,
    dbtActive: citizen.dbtActive,
    annualIncome: citizen.annualIncome,
    landHoldingHectares: citizen.landHoldingHectares,
    hasDisability: citizen.hasDisability,
    maritalStatus: citizen.maritalStatus,
  };
}

// ================= 1. SAMAGRA VERIFICATION ADAPTER =================

export async function verifySamagraId(memberId: string): Promise<SamagraVerifyResponse> {
  const cleaned = memberId.replace(/\s+/g, '').trim();

  if (USE_MOCK_API) {
    const res = await fetch(
      `/api/gov/samagra/verify?memberId=${encodeURIComponent(cleaned)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    const parsed = await parseApiResponse<{
      status?: string;
      source?: string;
      requestId?: string;
      citizen?: GovSamagraCitizen;
      family?: SamagraFamily;
      portal?: string;
      code?: string;
      error?: string;
      details?: string;
    }>(res);

    if (parsed.ok && parsed.data?.family) {
      return {
        ok: true,
        status: parsed.status,
        citizen: parsed.data.citizen,
        family: parsed.data.family,
        source: parsed.data.source || 'MP_SAMAGRA_MOCK_GATEWAY',
        requestId: parsed.data.requestId,
        liveConfigured: true,
        notice: parsed.data.requestId
          ? `Verified via MP Samagra Mock API (${parsed.data.requestId})`
          : 'Verified via MP Samagra Mock API',
      };
    }

    // If not in pre-seeded 3-profile mock DB, also check locally registered user families in /api/samagra/:id
    if (parsed.status === 404) {
      try {
        const localRes = await fetch(`/api/samagra/${encodeURIComponent(cleaned)}`);
        const localParsed = await parseApiResponse<{
          family?: SamagraFamily;
          source?: string;
          liveConfigured?: boolean;
          notice?: string;
        }>(localRes);
        if (localParsed.ok && localParsed.data?.family) {
          return {
            ok: true,
            status: localParsed.status,
            family: localParsed.data.family,
            source: localParsed.data.source || 'local_registered',
            liveConfigured: localParsed.data.liveConfigured,
            notice: localParsed.data.notice,
          };
        }
      } catch {
        // fall through to structured 404 from /api/gov/samagra/verify
      }
    }

    return {
      ok: false,
      status: parsed.status,
      error:
        parsed.errorInfo?.error ||
        `No citizen record found in MP Samagra for ID "${cleaned}".`,
      details: parsed.errorInfo?.details,
      code: parsed.errorInfo?.code,
      portalUrl: parsed.errorInfo?.portalUrl || SAMAGRA_PORTAL_URL,
      allowManualEntry: true,
    };
  }

  // Production path: real /api/samagra/:id endpoint
  const res = await fetch(`/api/samagra/${encodeURIComponent(cleaned)}`);
  const parsed = await parseApiResponse<{
    family?: SamagraFamily;
    source?: string;
    liveConfigured?: boolean;
    notice?: string;
  }>(res);

  if (parsed.ok && parsed.data?.family) {
    return {
      ok: true,
      status: parsed.status,
      family: parsed.data.family,
      source: parsed.data.source,
      liveConfigured: parsed.data.liveConfigured,
      notice: parsed.data.notice,
    };
  }

  return {
    ok: false,
    status: parsed.status,
    error:
      parsed.errorInfo?.error ||
      `No verified Samagra record found for "${cleaned}".`,
    details: parsed.errorInfo?.details,
    code: parsed.errorInfo?.code,
    portalUrl: parsed.errorInfo?.portalUrl || SAMAGRA_PORTAL_URL,
    allowManualEntry: parsed.errorInfo?.allowManualEntry ?? true,
  };
}

// ================= 2. DLT SMS OTP ADAPTER =================

export async function sendOtp(mobile: string): Promise<SendOtpResponse> {
  const endpoint = USE_MOCK_API ? '/api/gov/otp/send' : '/api/auth/mobile/send-otp';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, mobileNumber: mobile }),
  });

  const parsed = await parseApiResponse<{
    status?: string;
    templateId?: string;
    entityId?: string;
    senderId?: string;
    messageId?: string;
    mobile?: string;
    mobileNumber?: string;
    expiresInSeconds?: number;
    cooldownSeconds?: number;
    retryAfterSeconds?: number;
    demoOtp?: string;
    message?: string;
  }>(res);

  if (!parsed.ok) {
    return {
      ok: false,
      status: parsed.status,
      error: parsed.errorInfo?.error || 'Could not send mobile verification OTP.',
      details: parsed.errorInfo?.details,
      code: parsed.errorInfo?.code,
      retryAfterSeconds: parsed.data?.retryAfterSeconds,
    };
  }

  return {
    ok: true,
    status: parsed.status,
    mobileNumber: parsed.data?.mobileNumber || parsed.data?.mobile || mobile,
    cooldownSeconds: parsed.data?.cooldownSeconds ?? (USE_MOCK_API ? 15 : 60),
    expiresInSeconds: parsed.data?.expiresInSeconds ?? 300,
    message: parsed.data?.message,
    dltStatus: parsed.data?.status,
    templateId: parsed.data?.templateId,
    entityId: parsed.data?.entityId,
    senderId: parsed.data?.senderId,
    messageId: parsed.data?.messageId,
    demoOtp: parsed.data?.demoOtp,
  };
}

export async function verifyOtp(
  mobile: string,
  otp: string,
  authToken?: string | null
): Promise<VerifyOtpResponse> {
  const endpoint = USE_MOCK_API ? '/api/gov/otp/verify' : '/api/auth/mobile/verify-otp';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ mobile, mobileNumber: mobile, otp }),
  });

  const parsed = await parseApiResponse<{
    status?: string;
    verified?: boolean;
    mobile?: string;
    mobileNumber?: string;
    mobileVerified?: boolean;
    verificationToken?: string;
    message?: string;
    remainingAttempts?: number;
  }>(res);

  if (!parsed.ok || (!parsed.data?.mobileVerified && !parsed.data?.verified)) {
    return {
      ok: false,
      status: parsed.status,
      error: parsed.errorInfo?.error || 'Could not verify OTP. Please try again.',
      details: parsed.errorInfo?.details,
      code: parsed.errorInfo?.code,
      remainingAttempts: parsed.data?.remainingAttempts,
    };
  }

  return {
    ok: true,
    status: parsed.status,
    mobileNumber: parsed.data?.mobileNumber || parsed.data?.mobile || mobile,
    mobileVerified: true,
    verificationToken: parsed.data?.verificationToken,
    message: parsed.data?.message,
  };
}

// ================= 3. DIGILOCKER OAUTH 2.0 & ISSUED DOCS ADAPTER =================

export async function requestDigiLockerConsentToken(params: {
  citizenKey: string;
  memberId?: string;
  scopes?: string[];
}): Promise<DigiLockerTokenResponse> {
  const res = await fetch('/api/gov/digilocker/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      citizenKey: params.citizenKey,
      memberId: params.memberId,
      scopes: params.scopes || ['openid', 'profile', 'documents.read'],
    }),
  });

  const parsed = await parseApiResponse<{
    access_token?: string;
    token_type?: 'Bearer';
    expires_in?: number;
    scope?: string;
    consentId?: string;
    citizenKey?: string;
  }>(res);

  if (!parsed.ok || !parsed.data?.access_token) {
    return {
      ok: false,
      status: parsed.status,
      error: parsed.errorInfo?.error || 'Failed to obtain DigiLocker OAuth Bearer token.',
      details: parsed.errorInfo?.details,
    };
  }

  return {
    ok: true,
    status: parsed.status,
    access_token: parsed.data.access_token,
    token_type: parsed.data.token_type || 'Bearer',
    expires_in: parsed.data.expires_in,
    scope: parsed.data.scope,
    consentId: parsed.data.consentId,
    citizenKey: parsed.data.citizenKey,
  };
}

export async function fetchDigiLockerDocs(token: string): Promise<FetchDigiLockerDocsResponse> {
  const res = await fetch('/api/gov/digilocker/docs', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const parsed = await parseApiResponse<{
    citizenKey?: string;
    consentId?: string;
    scopes?: string[];
    issuedDocs?: DigiLockerIssuedDocItem[];
    credentials?: DigiLockerCredentialRecord[];
    documents?: DigiLockerDocumentRecord[];
  }>(res);

  if (!parsed.ok || !Array.isArray(parsed.data?.issuedDocs)) {
    return {
      ok: false,
      status: parsed.status,
      error: parsed.errorInfo?.error || 'Failed to fetch issued documents from DigiLocker.',
      details: parsed.errorInfo?.details,
    };
  }

  return {
    ok: true,
    status: parsed.status,
    citizenKey: parsed.data.citizenKey,
    consentId: parsed.data.consentId,
    scopes: parsed.data.scopes,
    issuedDocs: parsed.data.issuedDocs,
    credentials: parsed.data.credentials || [],
    documents: parsed.data.documents || [],
  };
}
