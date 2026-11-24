import crypto from 'node:crypto';
import {
  AreaType,
  Category,
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
  SamagraFamily,
} from '../src/types/index.js';
import { normalizeIndianMobileOrThrow, signMobileVerifiedToken } from './mobileOtpService.js';

export interface MockSamagraCitizenRecord {
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
  tierTag: string;
  expectedSchemesSummary: string;
}

export interface MockDigiLockerIssuedDoc {
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

interface MockOtpStoreEntry {
  mobileE164: string;
  mobile10Digit: string;
  otp: string;
  templateId: string;
  entityId: string;
  senderId: string;
  messageId: string;
  expiresAt: number;
  createdAt: number;
  attempts: number;
}

interface MockDigiLockerTokenEntry {
  accessToken: string;
  citizenKey: string;
  memberId?: string;
  scopes: string[];
  consentId: string;
  issuedAt: number;
  expiresAt: number;
}

// In-memory stores for the self-contained sandbox
const mockOtpStore = new Map<string, MockOtpStoreEntry>();
const mockDigiLockerTokenStore = new Map<string, MockDigiLockerTokenEntry>();

export const MOCK_OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
export const MOCK_OTP_MAX_ATTEMPTS = 5;
export const MOCK_DLT_ENTITY_ID = '1101582940000048192';
export const MOCK_DLT_TEMPLATE_ID = '1107168942510847291';
export const MOCK_DLT_SENDER_ID = 'MPGOVT';

/**
 * Simulates realistic Indian e-Gov API network latency (400-800ms)
 */
export async function simulateGovLatency(minMs = 400, maxMs = 800): Promise<number> {
  const safeMin = Math.max(0, Math.floor(minMs));
  const safeMax = Math.max(safeMin + 1, Math.floor(maxMs));
  const delayMs = crypto.randomInt(safeMin, safeMax + 1);
  await new Promise(resolve => setTimeout(resolve, delayMs));
  return delayMs;
}

// ================= PRE-SEEDED INDORE 6-TIER ALIGNED CITIZEN PROFILES =================

export const MOCK_SAMAGRA_CITIZENS: MockSamagraCitizenRecord[] = [
  {
    memberId: '123456789',
    familyId: '48291034',
    name: 'Sunita Sharma',
    nameHindi: 'सुनीता शर्मा',
    dob: '1992-06-15',
    age: 34,
    gender: 'female',
    category: 'GEN',
    maritalStatus: 'Married',
    district: 'Indore',
    districtCode: '439',
    areaType: 'urban',
    localBody: 'Indore Municipal Corporation (IMC) - Ward 72 (Vijay Nagar)',
    wardNumber: 72,
    wardOrBlock: 'Ward 72 (Vijay Nagar / Scheme 54)',
    address: '42, Scheme 54, Vijay Nagar, Ward 72, Indore, MP 452010',
    ekycStatus: 'VERIFIED',
    ekycVerified: true,
    dbtActive: true,
    annualIncome: 150000,
    occupation: 'Homemaker',
    landHoldingHectares: 0,
    rationCardType: 'APL',
    isBPL: false,
    hasDisability: false,
    mobileNumber: '9826012345',
    mobileE164: '+919826012345',
    tierTag: 'Tier 3 MP State & Tier 5 IMC Urban',
    expectedSchemesSummary: 'Ladli Behna Yojana & IMC Urban Ward 72 Schemes',
  },
  {
    memberId: '234567890',
    familyId: '59302145',
    name: 'Ramesh Patel',
    nameHindi: 'रमेश पटेल',
    dob: '1984-03-22',
    age: 42,
    gender: 'male',
    category: 'OBC',
    maritalStatus: 'Married',
    district: 'Indore',
    districtCode: '439',
    areaType: 'rural',
    localBody: 'Sanwer Janpad Panchayat (Gram Panchayat Ajnod)',
    blockName: 'Sanwer',
    gramPanchayat: 'Ajnod',
    wardOrBlock: 'Sanwer Janpad Panchayat',
    address: 'Gram Ajnod, Tehsil Sanwer, Indore District, MP 453551',
    ekycStatus: 'VERIFIED',
    ekycVerified: true,
    dbtActive: true,
    annualIncome: 180000,
    occupation: 'Farmer',
    landHoldingHectares: 1.5,
    rationCardType: 'BPL',
    isBPL: true,
    hasDisability: false,
    mobileNumber: '9826023456',
    mobileE164: '+919826023456',
    tierTag: 'Tier 2 National & Tier 6 Rural Janpad',
    expectedSchemesSummary: 'PM-KISAN, MP Kisan Kalyan & Sanwer Janpad Rural Schemes',
  },
  {
    memberId: '345678901',
    familyId: '60413256',
    name: 'Aarav Verma',
    nameHindi: 'आरव वर्मा',
    dob: '2005-08-10',
    age: 21,
    gender: 'male',
    category: 'OBC',
    maritalStatus: 'Unmarried',
    district: 'Indore',
    districtCode: '439',
    areaType: 'urban',
    localBody: 'Indore Municipal Corporation (IMC) - Ward 39 (Bhavarkua)',
    wardNumber: 39,
    wardOrBlock: 'Ward 39 (Bhavarkua University Campus)',
    address: '18, Vishnupuri Annex, Near DAVV Campus, Bhavarkua, Ward 39, Indore, MP 452001',
    ekycStatus: 'VERIFIED',
    ekycVerified: true,
    dbtActive: true,
    annualIncome: 240000,
    occupation: 'Student',
    landHoldingHectares: 0,
    rationCardType: 'APL',
    isBPL: false,
    hasDisability: false,
    mobileNumber: '9826034567',
    mobileE164: '+919826034567',
    tierTag: 'Tier 3 MP Youth/Education & Tier 5 IMC Urban',
    expectedSchemesSummary: 'MMVY 100% Tuition Fee & Seekho Kamao Yojana',
  },
];

function citizenToSamagraFamily(citizen: MockSamagraCitizenRecord): SamagraFamily {
  return {
    familyId: citizen.familyId,
    headName: citizen.name,
    areaType: citizen.areaType,
    wardOrBlock: citizen.wardOrBlock,
    address: citizen.address,
    rationCardType: citizen.rationCardType,
    source: 'mp_samagra_mock_api',
    createdAt: '2025-04-01T10:00:00.000Z',
    members: [
      {
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
      },
    ],
  };
}

// ================= 1. MP SAMAGRA PORTAL MOCK VERIFICATION =================

export function lookupMockSamagra(rawId: string):
  | {
      ok: true;
      httpStatus: 200;
      payload: {
        status: 'VERIFIED';
        source: 'MP_SAMAGRA_MOCK_GATEWAY';
        requestId: string;
        timestamp: string;
        citizen: MockSamagraCitizenRecord;
        family: SamagraFamily;
      };
    }
  | {
      ok: false;
      httpStatus: 400 | 404;
      payload: {
        status: 'INVALID_REQUEST' | 'NOT_FOUND';
        code: string;
        error: string;
        details: string;
        portal: string;
        requestId: string;
        timestamp: string;
      };
    } {
  const cleaned = String(rawId || '').replace(/\s+/g, '').trim();
  const requestId = `SPR-IND-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const timestamp = new Date().toISOString();

  if (!/^\d{8,9}$/.test(cleaned)) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'INVALID_REQUEST',
        code: 'INVALID_SAMAGRA_FORMAT',
        error: 'Invalid Samagra ID format. Enter a 9-digit Member ID (or 8-digit Family ID).',
        details: 'Try demo Member IDs: 123456789 (Urban Female), 234567890 (Rural Farmer), or 345678901 (Urban Student).',
        portal: 'https://samagra.gov.in/',
        requestId,
        timestamp,
      },
    };
  }

  const matched = MOCK_SAMAGRA_CITIZENS.find(
    c => c.memberId === cleaned || c.familyId === cleaned
  );

  if (!matched) {
    return {
      ok: false,
      httpStatus: 404,
      payload: {
        status: 'NOT_FOUND',
        code: 'SAMAGRA_MEMBER_NOT_FOUND',
        error: `No citizen record found in MP Samagra SPR for ID "${cleaned}".`,
        details:
          'Verify the 9-digit Member ID or use one of the Indore demo test IDs: 123456789, 234567890, or 345678901.',
        portal: 'https://samagra.gov.in/',
        requestId,
        timestamp,
      },
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    payload: {
      status: 'VERIFIED',
      source: 'MP_SAMAGRA_MOCK_GATEWAY',
      requestId,
      timestamp,
      citizen: matched,
      family: citizenToSamagraFamily(matched),
    },
  };
}

// ================= 2. INDIAN DLT-COMPLIANT SMS OTP GATEWAY =================

function pruneExpiredOtps() {
  const now = Date.now();
  for (const [key, entry] of mockOtpStore.entries()) {
    if (entry.expiresAt <= now) {
      mockOtpStore.delete(key);
    }
  }
}

export function sendMockDltOtp(rawMobile: string):
  | {
      ok: true;
      httpStatus: 200;
      payload: {
        status: 'SENT';
        provider: string;
        templateId: string;
        entityId: string;
        senderId: string;
        messageId: string;
        route: 'TRANSACTIONAL_OTP';
        mobile: string;
        mobileNumber: string;
        expiresInSeconds: number;
        cooldownSeconds: number;
        demoOtp: string;
        dltMessage: string;
        message: string;
        timestamp: string;
      };
    }
  | {
      ok: false;
      httpStatus: 400;
      payload: {
        status: 'FAILED';
        code: string;
        error: string;
        details: string;
      };
    } {
  pruneExpiredOtps();
  const mobileCheck = normalizeIndianMobileOrThrow(rawMobile);
  if (!mobileCheck.valid) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'FAILED',
        code: 'INVALID_MOBILE_FORMAT',
        error:
          mobileCheck.error ||
          'Enter a valid 10-digit Indian mobile number (+91 followed by 10 digits starting with 6-9).',
        details: 'Example: +919826012345 or 9826012345',
      },
    };
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const now = Date.now();
  const messageId = `DLT-MP-${now.toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  mockOtpStore.set(mobileCheck.e164, {
    mobileE164: mobileCheck.e164,
    mobile10Digit: mobileCheck.cleaned,
    otp,
    templateId: MOCK_DLT_TEMPLATE_ID,
    entityId: MOCK_DLT_ENTITY_ID,
    senderId: MOCK_DLT_SENDER_ID,
    messageId,
    expiresAt: now + MOCK_OTP_EXPIRY_MS,
    createdAt: now,
    attempts: 0,
  });

  return {
    ok: true,
    httpStatus: 200,
    payload: {
      status: 'SENT',
      provider: 'TRAI-DLT-MPGOVT-SANDBOX',
      templateId: MOCK_DLT_TEMPLATE_ID,
      entityId: MOCK_DLT_ENTITY_ID,
      senderId: MOCK_DLT_SENDER_ID,
      messageId,
      route: 'TRANSACTIONAL_OTP',
      mobile: mobileCheck.e164,
      mobileNumber: mobileCheck.e164,
      expiresInSeconds: Math.floor(MOCK_OTP_EXPIRY_MS / 1000),
      cooldownSeconds: 15,
      demoOtp: otp,
      dltMessage: `Your YojanaSetu Indore verification OTP is ${otp}. Valid for 5 minutes. Do not share with anyone. - Govt of MP (${MOCK_DLT_SENDER_ID})`,
      message: `6-digit DLT OTP sent to ${mobileCheck.e164}. Valid for 5 minutes.`,
      timestamp: new Date(now).toISOString(),
    },
  };
}

export function verifyMockDltOtp(
  rawMobile: string,
  rawOtp: string
):
  | {
      ok: true;
      httpStatus: 200;
      payload: {
        status: 'VERIFIED';
        verified: true;
        mobile: string;
        mobileNumber: string;
        mobileVerified: true;
        verificationToken: string;
        messageId: string;
        verifiedAt: string;
        message: string;
      };
    }
  | {
      ok: false;
      httpStatus: 400 | 401 | 429;
      payload: {
        status: 'FAILED';
        verified: false;
        code: string;
        error: string;
        remainingAttempts?: number;
      };
    } {
  pruneExpiredOtps();
  const mobileCheck = normalizeIndianMobileOrThrow(rawMobile);
  if (!mobileCheck.valid) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'INVALID_MOBILE_FORMAT',
        error:
          mobileCheck.error ||
          'Enter a valid Indian mobile number (+91 followed by 10 digits starting with 6-9).',
      },
    };
  }

  const cleanOtp = String(rawOtp || '').trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'INVALID_OTP_FORMAT',
        error: 'Enter the 6-digit numeric OTP.',
      },
    };
  }

  const entry = mockOtpStore.get(mobileCheck.e164);
  if (!entry) {
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'OTP_NOT_FOUND',
        error: 'No active OTP found for this mobile number. Please request a new OTP.',
      },
    };
  }

  if (entry.expiresAt <= Date.now()) {
    mockOtpStore.delete(mobileCheck.e164);
    return {
      ok: false,
      httpStatus: 400,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'OTP_EXPIRED',
        error: 'This OTP has expired (5-minute validity). Please request a new OTP.',
      },
    };
  }

  if (entry.attempts >= MOCK_OTP_MAX_ATTEMPTS) {
    mockOtpStore.delete(mobileCheck.e164);
    return {
      ok: false,
      httpStatus: 429,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'OTP_MAX_ATTEMPTS',
        error: 'Maximum OTP verification attempts exceeded (5/5). Please request a new OTP.',
      },
    };
  }

  const isMatch = crypto.timingSafeEqual(Buffer.from(cleanOtp), Buffer.from(entry.otp));
  if (!isMatch) {
    entry.attempts += 1;
    const remaining = Math.max(0, MOCK_OTP_MAX_ATTEMPTS - entry.attempts);
    if (remaining === 0) {
      mockOtpStore.delete(mobileCheck.e164);
      return {
        ok: false,
        httpStatus: 429,
        payload: {
          status: 'FAILED',
          verified: false,
          code: 'OTP_MAX_ATTEMPTS',
          error: 'Incorrect OTP entered too many times. Please request a new OTP.',
          remainingAttempts: 0,
        },
      };
    }
    return {
      ok: false,
      httpStatus: 401,
      payload: {
        status: 'FAILED',
        verified: false,
        code: 'INVALID_OTP',
        error: `Incorrect 6-digit OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        remainingAttempts: remaining,
      },
    };
  }

  mockOtpStore.delete(mobileCheck.e164);
  const verificationToken = signMobileVerifiedToken(mobileCheck.e164);
  const verifiedAt = new Date().toISOString();

  return {
    ok: true,
    httpStatus: 200,
    payload: {
      status: 'VERIFIED',
      verified: true,
      mobile: mobileCheck.e164,
      mobileNumber: mobileCheck.e164,
      mobileVerified: true,
      verificationToken,
      messageId: entry.messageId,
      verifiedAt,
      message: `Mobile number ${mobileCheck.e164} verified via DLT SMS OTP.`,
    },
  };
}

// ================= 3. DIGILOCKER REQUESTER API (OAUTH 2.0 CONSENT & ISSUED DOCS) =================

function pruneExpiredDigiLockerTokens() {
  const now = Date.now();
  for (const [token, entry] of mockDigiLockerTokenStore.entries()) {
    if (entry.expiresAt <= now) {
      mockDigiLockerTokenStore.delete(token);
    }
  }
}

export function issueMockDigiLockerToken(params: {
  citizenKey: string;
  memberId?: string;
  scopes?: string[];
}) {
  pruneExpiredDigiLockerTokens();
  const cleanKey = (params.citizenKey || params.memberId || 'citizen_oauth').trim().slice(0, 128);
  const cleanMemberId = params.memberId?.trim() || (/^\d{9}$/.test(cleanKey) ? cleanKey : undefined);
  const scopes =
    Array.isArray(params.scopes) && params.scopes.length > 0
      ? params.scopes.filter(s => typeof s === 'string' && s.trim().length > 0)
      : ['openid', 'profile', 'documents.read'];

  const accessToken = `dl_mock_${crypto.randomBytes(24).toString('base64url')}`;
  const consentId = `DL-CONSENT-IND-${Date.now().toString(36).toUpperCase()}`;
  const issuedAt = Date.now();
  const expiresIn = 3600;

  mockDigiLockerTokenStore.set(accessToken, {
    accessToken,
    citizenKey: cleanKey,
    memberId: cleanMemberId,
    scopes,
    consentId,
    issuedAt,
    expiresAt: issuedAt + expiresIn * 1000,
  });

  return {
    access_token: accessToken,
    token_type: 'Bearer' as const,
    expires_in: expiresIn,
    scope: scopes.join(' '),
    consentId,
    citizenKey: cleanKey,
    issuer: 'https://digilocker.meripehchaan.gov.in (Mock Sandbox)',
    issuedAt: new Date(issuedAt).toISOString(),
  };
}

function buildIssuedDocsForCitizen(citizenKey: string, memberId?: string): MockDigiLockerIssuedDoc[] {
  const matched = MOCK_SAMAGRA_CITIZENS.find(
    c => c.memberId === memberId || c.memberId === citizenKey || c.familyId === citizenKey
  );

  // 1. Urban Female (Sunita Sharma - 123456789)
  if (matched?.memberId === '123456789') {
    return [
      {
        uri: 'in.gov.uidai-ADHAR-894210345678',
        docId: 'aadhaar',
        docType: 'ADHAR',
        name: 'Aadhaar Card (e-Aadhaar)',
        docNumber: 'XXXX-XXXX-5678',
        issuer: 'Unique Identification Authority of India (UIDAI)',
        issuerId: 'in.gov.uidai',
        mimeType: 'application/pdf',
        issuedDate: '2022-05-14',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-DOM-IND2024918273',
        docId: 'mp_domicile',
        docType: 'DOM',
        name: 'Madhya Pradesh Domicile Certificate',
        docNumber: 'RS/439/0102/2024/918273',
        issuer: 'MP e-District / SDM Indore Urban',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2024-02-19',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SMID-123456789',
        docId: 'samagra_member',
        docType: 'SMID',
        name: 'Samagra Member e-KYC Certificate (9-Digit)',
        docNumber: '123456789',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-11',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SFID-48291034',
        docId: 'samagra_family',
        docType: 'SFID',
        name: 'Samagra Family ID Household Record (8-Digit)',
        docNumber: '48291034',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-11',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.npci-DBT-SBIN000482910',
        docId: 'bank_dbt',
        docType: 'DBT',
        name: 'Aadhaar-Seeded NPCI Bank DBT Mandate',
        docNumber: 'SBIN0004829-XXXX4219',
        issuer: 'NPCI Aadhaar Payment Bridge / SBI Vijay Nagar',
        issuerId: 'in.gov.npci',
        mimeType: 'application/pdf',
        issuedDate: '2024-09-05',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-INC-IND2025482910',
        docId: 'income_cert',
        docType: 'INC',
        name: 'Digital Annual Income Certificate (₹1,50,000)',
        docNumber: 'RS/439/INC/2025/482910',
        issuer: 'MP Lok Seva Kendra (RSK Indore)',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2025-03-08',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.imcindore-VEND-W72004829',
        docId: 'vendor_id',
        docType: 'VEND',
        name: 'IMC Ward 72 Women Micro-Enterprise / Vending ID',
        docNumber: 'IMC-W72-2025-4829',
        issuer: 'Indore Municipal Corporation (Town Vending Committee)',
        issuerId: 'in.gov.imcindore',
        mimeType: 'application/pdf',
        issuedDate: '2025-04-20',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
    ];
  }

  // 2. Rural Farmer (Ramesh Patel - 234567890)
  if (matched?.memberId === '234567890') {
    return [
      {
        uri: 'in.gov.uidai-ADHAR-761029384756',
        docId: 'aadhaar',
        docType: 'ADHAR',
        name: 'Aadhaar Card (e-Aadhaar)',
        docNumber: 'XXXX-XXXX-4756',
        issuer: 'Unique Identification Authority of India (UIDAI)',
        issuerId: 'in.gov.uidai',
        mimeType: 'application/pdf',
        issuedDate: '2021-11-04',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpbhulekh-KHASRA-SNW452019',
        docId: 'khasra_b1',
        docType: 'KHASRA',
        name: 'Khasra / Khatauni B-1 Land Record (1.5 Ha, Ajnod)',
        docNumber: 'BHULEKH/IND/SNW/2025/1504',
        issuer: 'MP Bhulekh Revenue Department (Tehsil Sanwer)',
        issuerId: 'in.gov.mpbhulekh',
        mimeType: 'application/pdf',
        issuedDate: '2025-02-12',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-DOM-IND2023617283',
        docId: 'mp_domicile',
        docType: 'DOM',
        name: 'Madhya Pradesh Domicile Certificate',
        docNumber: 'RS/439/SNW/2023/617283',
        issuer: 'MP e-District / SDM Sanwer',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2023-07-22',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SMID-234567890',
        docId: 'samagra_member',
        docType: 'SMID',
        name: 'Samagra Member e-KYC Certificate (9-Digit)',
        docNumber: '234567890',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-19',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SFID-59302145',
        docId: 'samagra_family',
        docType: 'SFID',
        name: 'Samagra Family ID Household Record (8-Digit)',
        docNumber: '59302145',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-19',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.npci-DBT-BKID000881201',
        docId: 'bank_dbt',
        docType: 'DBT',
        name: 'Aadhaar-Seeded NPCI Bank DBT Mandate',
        docNumber: 'BKID0008812-XXXX7812',
        issuer: 'NPCI Aadhaar Payment Bridge / Bank of India Sanwer',
        issuerId: 'in.gov.npci',
        mimeType: 'application/pdf',
        issuedDate: '2024-08-14',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpfood-BPL-IND59302145',
        docId: 'bpl_ration',
        docType: 'BPL',
        name: 'MP BPL / NFSA Eligibility Ration Card',
        docNumber: 'MP-IND-SNW-BPL-593021',
        issuer: 'Food, Civil Supplies & Consumer Protection Dept MP',
        issuerId: 'in.gov.mpfood',
        mimeType: 'application/pdf',
        issuedDate: '2024-04-02',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-CASTE-OBC2022910',
        docId: 'caste_cert',
        docType: 'CASTE',
        name: 'Digital OBC Caste Certificate',
        docNumber: 'RS/439/OBC/2022/91044',
        issuer: 'Revenue Department, Govt of Madhya Pradesh',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2022-09-18',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
    ];
  }

  // 3. Urban Student / Youth (Aarav Verma - 345678901)
  if (matched?.memberId === '345678901') {
    return [
      {
        uri: 'in.gov.uidai-ADHAR-652019283746',
        docId: 'aadhaar',
        docType: 'ADHAR',
        name: 'Aadhaar Card (e-Aadhaar)',
        docNumber: 'XXXX-XXXX-3746',
        issuer: 'Unique Identification Authority of India (UIDAI)',
        issuerId: 'in.gov.uidai',
        mimeType: 'application/pdf',
        issuedDate: '2023-01-20',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpbse-HSC-20231048291',
        docId: 'hsc_marksheet',
        docType: 'HSC',
        name: 'Class XII Higher Secondary Marksheet (84.6% Merit)',
        docNumber: 'MPBSE-2023-1048291',
        issuer: 'Madhya Pradesh Board of Secondary Education (MPBSE)',
        issuerId: 'in.gov.mpbse',
        mimeType: 'application/pdf',
        issuedDate: '2023-05-25',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-DOM-IND2024516273',
        docId: 'mp_domicile',
        docType: 'DOM',
        name: 'Madhya Pradesh Domicile Certificate',
        docNumber: 'RS/439/0102/2024/516273',
        issuer: 'MP e-District / SDM Indore Urban',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2024-06-11',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-INC-IND2025604132',
        docId: 'income_cert',
        docType: 'INC',
        name: 'Digital Family Income Certificate (₹2,40,000)',
        docNumber: 'RS/439/INC/2025/604132',
        issuer: 'MP Lok Seva Kendra (RSK Bhavarkua)',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2025-05-03',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SMID-345678901',
        docId: 'samagra_member',
        docType: 'SMID',
        name: 'Samagra Member e-KYC Certificate (9-Digit)',
        docNumber: '345678901',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-28',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpsamagra-SFID-60413256',
        docId: 'samagra_family',
        docType: 'SFID',
        name: 'Samagra Family ID Household Record (8-Digit)',
        docNumber: '60413256',
        issuer: 'MP Samagra Social Security Mission (SPR)',
        issuerId: 'in.gov.mpsamagra',
        mimeType: 'application/pdf',
        issuedDate: '2025-01-28',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.npci-DBT-HDFC000129450',
        docId: 'bank_dbt',
        docType: 'DBT',
        name: 'Aadhaar-Seeded NPCI Bank DBT Mandate',
        docNumber: 'HDFC0001294-XXXX9012',
        issuer: 'NPCI Aadhaar Payment Bridge / HDFC Bank Bhavarkua',
        issuerId: 'in.gov.npci',
        mimeType: 'application/pdf',
        issuedDate: '2024-11-18',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
      {
        uri: 'in.gov.mpedistrict-CASTE-OBC2023718',
        docId: 'caste_cert',
        docType: 'CASTE',
        name: 'Digital OBC Caste Certificate',
        docNumber: 'RS/439/OBC/2023/71822',
        issuer: 'Revenue Department, Govt of Madhya Pradesh',
        issuerId: 'in.gov.mpedistrict',
        mimeType: 'application/pdf',
        issuedDate: '2023-07-10',
        verificationStatus: 'VERIFIED',
        verified: true,
      },
    ];
  }

  // Default issued bundle for any custom citizen account
  const suffix = crypto
    .createHash('sha256')
    .update(citizenKey)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  return [
    {
      uri: `in.gov.uidai-ADHAR-${suffix}9102`,
      docId: 'aadhaar',
      docType: 'ADHAR',
      name: 'Aadhaar Card (e-Aadhaar)',
      docNumber: `XXXX-XXXX-${suffix.slice(0, 4)}`,
      issuer: 'Unique Identification Authority of India (UIDAI)',
      issuerId: 'in.gov.uidai',
      mimeType: 'application/pdf',
      issuedDate: '2023-04-12',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.mpedistrict-DOM-IND${suffix}`,
      docId: 'mp_domicile',
      docType: 'DOM',
      name: 'Madhya Pradesh Domicile Certificate',
      docNumber: `RS/439/DOM/${suffix}`,
      issuer: 'MP e-District / SDM Indore',
      issuerId: 'in.gov.mpedistrict',
      mimeType: 'application/pdf',
      issuedDate: '2024-03-15',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.mpedistrict-INC-IND${suffix}`,
      docId: 'income_cert',
      docType: 'INC',
      name: 'Digital Annual Income Certificate',
      docNumber: `RS/439/INC/${suffix}`,
      issuer: 'MP Lok Seva Kendra (RSK Indore)',
      issuerId: 'in.gov.mpedistrict',
      mimeType: 'application/pdf',
      issuedDate: '2025-01-20',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.mpbse-HSC-2023${suffix.slice(0, 6)}`,
      docId: 'hsc_marksheet',
      docType: 'HSC',
      name: 'Class XII Higher Secondary Marksheet',
      docNumber: `MPBSE-${suffix.slice(0, 6)}`,
      issuer: 'Madhya Pradesh Board of Secondary Education (MPBSE)',
      issuerId: 'in.gov.mpbse',
      mimeType: 'application/pdf',
      issuedDate: '2023-05-25',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.mpsamagra-SMID-${memberId || suffix}`,
      docId: 'samagra_member',
      docType: 'SMID',
      name: 'Samagra Member e-KYC Certificate',
      docNumber: memberId || suffix,
      issuer: 'MP Samagra Social Security Mission (SPR)',
      issuerId: 'in.gov.mpsamagra',
      mimeType: 'application/pdf',
      issuedDate: '2025-02-01',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.mpsamagra-SFID-${suffix}`,
      docId: 'samagra_family',
      docType: 'SFID',
      name: 'Samagra Family ID Household Record',
      docNumber: suffix,
      issuer: 'MP Samagra Social Security Mission (SPR)',
      issuerId: 'in.gov.mpsamagra',
      mimeType: 'application/pdf',
      issuedDate: '2025-02-01',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
    {
      uri: `in.gov.npci-DBT-SBIN${suffix}`,
      docId: 'bank_dbt',
      docType: 'DBT',
      name: 'Aadhaar-Seeded NPCI Bank DBT Mandate',
      docNumber: `SBIN-XXXX-${suffix.slice(0, 4)}`,
      issuer: 'NPCI Aadhaar Payment Bridge',
      issuerId: 'in.gov.npci',
      mimeType: 'application/pdf',
      issuedDate: '2024-10-08',
      verificationStatus: 'VERIFIED',
      verified: true,
    },
  ];
}

export function fetchMockDigiLockerIssuedDocs(bearerToken: string):
  | {
      ok: true;
      httpStatus: 200;
      citizenKey: string;
      consentId: string;
      scopes: string[];
      issuedDocs: MockDigiLockerIssuedDoc[];
      credentials: DigiLockerCredentialRecord[];
      documents: DigiLockerDocumentRecord[];
    }
  | {
      ok: false;
      httpStatus: 401;
      error: string;
      code: string;
    } {
  pruneExpiredDigiLockerTokens();
  const cleanToken = bearerToken.trim();
  if (!cleanToken) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'DIGILOCKER_TOKEN_MISSING',
      error: 'Missing DigiLocker OAuth Bearer access_token.',
    };
  }

  const session = mockDigiLockerTokenStore.get(cleanToken);
  if (!session || session.expiresAt <= Date.now()) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'DIGILOCKER_TOKEN_INVALID',
      error: 'DigiLocker Bearer access_token is invalid or expired. Please re-authorize via the Consent modal.',
    };
  }

  const nowIso = new Date().toISOString();
  const issuedDocs = buildIssuedDocsForCitizen(session.citizenKey, session.memberId);

  const credentials: DigiLockerCredentialRecord[] = issuedDocs.map(doc => ({
    id: `dl_${crypto.createHash('sha256').update(`${session.citizenKey}:${doc.uri}`).digest('hex').slice(0, 16)}`,
    citizenId: session.citizenKey,
    docId: doc.docId,
    docType: doc.docType,
    docUri: doc.uri,
    docName: doc.name,
    docNumber: doc.docNumber,
    issuer: doc.issuer,
    mimeType: doc.mimeType,
    verified: true,
    issuedAt: doc.issuedDate,
    verifiedAt: nowIso,
  }));

  const documents: DigiLockerDocumentRecord[] = issuedDocs.map(doc => ({
    citizenKey: session.citizenKey,
    docId: doc.docId,
    docNumber: doc.docNumber,
    source: 'digilocker',
    issuer: doc.issuer,
    verified: true,
    verifiedAt: nowIso,
  }));

  return {
    ok: true,
    httpStatus: 200,
    citizenKey: session.citizenKey,
    consentId: session.consentId,
    scopes: session.scopes,
    issuedDocs,
    credentials,
    documents,
  };
}
