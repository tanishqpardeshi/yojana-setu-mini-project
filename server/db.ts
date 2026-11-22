import Database from 'better-sqlite3';
import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Scheme,
  ApplicationRecord,
  LiveNotification,
  SamagraFamily,
  DistrictStats,
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  PortalReachabilityStatus,
  SchemesRealtimeReport,
  CitizenAccountProfile,
  AreaType,
  Category,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
} from '../src/types/index.js';
import { SCHEMES_DATABASE } from '../src/data/schemesData.js';
import { IMC_WARDS, JANPAD_BLOCKS } from '../src/data/indoreGovernance.js';
import {
  aggregateJanpadLiveMetrics,
  aggregateWardLiveMetrics,
  evaluateSchemesRealtimeStatus,
  resolveSchemePortalUrl,
} from '../src/utils/liveDataEngine.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CreateCitizenAccountInput {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  phone?: string;
  mobileNumber?: string;
  mobileVerified?: boolean;
  samagraFamilyId?: string;
  samagraMemberId?: string;
  samagraId?: string;
  areaType: AreaType;
  wardNumber?: number;
  blockName?: JanpadBlock;
  category: Category;
  age: number;
  gender: Gender;
  annualIncome: number;
  occupation: OccupationType;
  isBPL: boolean;
  hasDisability: boolean;
  maritalStatus: MaritalStatus;
  isMpDomicile: boolean;
  isIndoreResident: boolean;
  ekycVerified: boolean;
}

export interface OtpVerificationRecord {
  id: string;
  mobileNumber: string;
  otpHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

export interface OAuthPkceStateRecord {
  state: string;
  codeVerifier: string;
  citizenKey: string;
  redirectUri: string;
  expiresAt: string;
  createdAt: string;
}

export type CitizenAccountWithSecret = CitizenAccountProfile & {
  passwordHash: string;
};

export function isUniqueConstraintError(err: unknown): {
  isUnique: boolean;
  constraint?: string;
  detail: string;
} {
  const e = err as { code?: string; constraint?: string; detail?: string; message?: string } | null;
  const code = e?.code || '';
  const message = e?.message || String(err || '');
  const isUnique =
    code === '23505' ||
    code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    (code === 'SQLITE_CONSTRAINT' && message.toLowerCase().includes('unique')) ||
    message.toLowerCase().includes('duplicate key value violates unique constraint') ||
    message.toLowerCase().includes('unique constraint failed');
  return {
    isUnique,
    constraint: e?.constraint,
    detail: e?.detail || message,
  };
}

let pgPool: Pool | null = null;
let sqliteDb: Database.Database | null = null;
let storageEngine: 'postgresql' | 'sqlite' = 'sqlite';
let initPromise: Promise<void> | null = null;

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toIsoString(val: unknown): string | undefined {
  if (val === null || val === undefined) return undefined;
  if (val instanceof Date) return val.toISOString();
  const s = String(val).trim();
  return s || undefined;
}

function rowToScheme(row: any): Scheme {
  const baseScheme: Scheme = {
    id: row.id,
    code: row.code,
    title: row.title,
    titleHindi: row.title_hindi,
    titleMalwi: row.title_malwi,
    governanceLevel: row.governance_level,
    department: row.department,
    nodalOfficeIndore: row.nodal_office_indore,
    helpline: row.helpline,
    targetBeneficiary: row.target_beneficiary,
    description: row.description,
    descriptionHindi: row.description_hindi,
    benefits: row.benefits,
    benefitsHindi: row.benefits_hindi,
    financialEntitlement: {
      amount: Number(row.financial_amount) || 0,
      frequency: row.financial_frequency || 'One-Time',
      description: row.financial_desc || '',
    },
    eligibilityRules: safeJsonParse(row.eligibility_rules_json, {}),
    requiredDocuments: safeJsonParse(row.required_documents_json, []),
    tags: safeJsonParse(row.tags_json, []),
    malwiSynonyms: safeJsonParse(row.malwi_synonyms_json, []),
    applyUrl: row.apply_url || undefined,
    cscAvailable: Boolean(Number(row.csc_available)),
    activeBudgetCr:
      row.active_budget_cr !== null && row.active_budget_cr !== undefined
        ? Number(row.active_budget_cr)
        : undefined,
    updatedAt: toIsoString(row.updated_at),
    dataOrigin: row.data_origin === 'admin_live' ? 'admin_live' : 'baseline_catalog',
    portalStatus: (row.portal_status as PortalReachabilityStatus) || 'unchecked',
    portalHttpStatus:
      row.portal_http_status !== null && row.portal_http_status !== undefined
        ? Number(row.portal_http_status)
        : null,
    portalCheckedAt: toIsoString(row.portal_checked_at) ?? null,
    portalLatencyMs:
      row.portal_latency_ms !== null && row.portal_latency_ms !== undefined
        ? Number(row.portal_latency_ms)
        : null,
  };
  baseScheme.applyUrl = resolveSchemePortalUrl(baseScheme);
  return baseScheme;
}

function rowToApplication(row: any): ApplicationRecord {
  return {
    arn: row.arn,
    schemeId: row.scheme_id,
    schemeTitle: row.scheme_title,
    schemeTitleHindi: row.scheme_title_hindi,
    applicantName: row.applicant_name,
    citizenId: row.citizen_id || row.samagra_member_id,
    samagraMemberId: row.samagra_member_id,
    samagraFamilyId: row.samagra_family_id,
    phone: row.phone,
    wardOrBlock: row.ward_or_block,
    areaType: row.area_type,
    appliedDate: row.applied_date,
    currentStatus: row.current_status,
    officerInCharge: row.officer_in_charge,
    sanctionAmount: row.sanction_amount ? Number(row.sanction_amount) : 0,
    remarks: row.remarks || '',
    timeline: safeJsonParse(row.timeline_json, []),
  };
}

function rowToSamagraFamily(row: any): SamagraFamily {
  return {
    familyId: row.family_id,
    headName: row.head_name,
    areaType: row.area_type,
    wardOrBlock: row.ward_or_block,
    address: row.address,
    rationCardType: row.ration_card_type,
    members: safeJsonParse<SamagraFamily['members']>(row.members_json, []),
    source: row.source || undefined,
    createdAt: toIsoString(row.created_at),
  };
}

function rowToDigiLockerDoc(row: any): DigiLockerDocumentRecord {
  return {
    citizenKey: row.citizen_key,
    docId: row.doc_id,
    docNumber: row.doc_number,
    source: row.source,
    issuer: row.issuer,
    verified: Boolean(Number(row.verified)),
    verifiedAt: toIsoString(row.verified_at) || new Date().toISOString(),
  };
}

function rowToDigiLockerCredential(row: any): DigiLockerCredentialRecord {
  return {
    id: row.id,
    citizenId: row.citizen_id,
    docId: row.doc_id || undefined,
    docUri: row.doc_uri,
    docName: row.doc_name,
    docNumber: row.doc_number || undefined,
    issuer: row.issuer,
    mimeType: row.mime_type || undefined,
    verified: Boolean(Number(row.verified)),
    issuedAt: row.issued_at || undefined,
    verifiedAt: toIsoString(row.verified_at) || new Date().toISOString(),
  };
}

function rowToCitizenAccount(row: any): CitizenAccountWithSecret {
  const areaType: AreaType = row.area_type === 'rural' ? 'rural' : 'urban';
  return {
    uid: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    phone: row.phone || row.mobile_number || undefined,
    mobileNumber: row.mobile_number || undefined,
    mobileVerified: Boolean(Number(row.mobile_verified)),
    role: 'citizen',
    authMethod: 'email',
    samagraFamilyId: row.samagra_family_id || undefined,
    samagraMemberId: row.samagra_member_id || undefined,
    samagraId: row.samagra_id || row.samagra_member_id || row.samagra_family_id || undefined,
    areaType,
    wardNumber:
      areaType === 'urban' && row.ward_number !== null && row.ward_number !== undefined
        ? Number(row.ward_number)
        : undefined,
    blockName:
      areaType === 'rural' && row.block_name
        ? (row.block_name as JanpadBlock)
        : undefined,
    category: (row.category as Category) || 'GEN',
    age: row.age !== null && row.age !== undefined ? Number(row.age) : 30,
    gender: (row.gender as Gender) || 'female',
    annualIncome:
      row.annual_income !== null && row.annual_income !== undefined
        ? Number(row.annual_income)
        : 150000,
    occupation: (row.occupation as OccupationType) || 'Other',
    isBPL: Boolean(Number(row.is_bpl)),
    hasDisability: Boolean(Number(row.has_disability)),
    maritalStatus: (row.marital_status as MaritalStatus) || 'Married',
    isMpDomicile: row.is_mp_domicile === undefined ? true : Boolean(Number(row.is_mp_domicile)),
    isIndoreResident:
      row.is_indore_resident === undefined ? true : Boolean(Number(row.is_indore_resident)),
    ekycVerified: Boolean(Number(row.ekyc_verified)),
    createdAt: toIsoString(row.created_at) || new Date().toISOString(),
    updatedAt: toIsoString(row.updated_at),
    lastLoginAt: toIsoString(row.last_login_at),
  };
}

function sanitizeCitizenAccount(acc: CitizenAccountWithSecret): CitizenAccountProfile {
  const { passwordHash: _removed, ...safeProfile } = acc;
  return safeProfile;
}

const DEMO_FAMILY_IDS = ['48921840', '71203945', '39510482', '84019283'];
const DEMO_ARNS = ['YS-IND-2026-94812', 'YS-IND-2026-88319', 'YS-IND-2026-73190'];
const DEMO_NOTIF_IDS = ['notif-1', 'notif-2', 'notif-3', 'notif-4', 'notif-5'];

// ================= POSTGRESQL INITIALIZATION (SUPABASE) =================

async function initPostgres(databaseUrl: string): Promise<void> {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
  });

  const client: PoolClient = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schemes (
        seq_id BIGSERIAL,
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        title TEXT NOT NULL,
        title_hindi TEXT NOT NULL,
        title_malwi TEXT NOT NULL,
        governance_level TEXT NOT NULL,
        department TEXT NOT NULL,
        nodal_office_indore TEXT NOT NULL,
        helpline TEXT NOT NULL,
        target_beneficiary TEXT NOT NULL,
        description TEXT NOT NULL,
        description_hindi TEXT NOT NULL,
        benefits TEXT NOT NULL,
        benefits_hindi TEXT NOT NULL,
        financial_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
        financial_frequency TEXT NOT NULL,
        financial_desc TEXT NOT NULL,
        eligibility_rules_json TEXT NOT NULL,
        required_documents_json TEXT NOT NULL,
        tags_json TEXT NOT NULL,
        malwi_synonyms_json TEXT NOT NULL,
        apply_url TEXT,
        csc_available INTEGER NOT NULL DEFAULT 1,
        active_budget_cr DOUBLE PRECISION,
        data_origin TEXT NOT NULL DEFAULT 'baseline_catalog',
        portal_status TEXT NOT NULL DEFAULT 'unchecked',
        portal_http_status INTEGER,
        portal_checked_at TEXT,
        portal_latency_ms INTEGER,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS applications (
        seq_id BIGSERIAL,
        arn TEXT PRIMARY KEY,
        citizen_id TEXT NOT NULL DEFAULT '',
        scheme_id TEXT NOT NULL REFERENCES schemes(id),
        scheme_title TEXT NOT NULL,
        scheme_title_hindi TEXT NOT NULL,
        applicant_name TEXT NOT NULL,
        samagra_member_id TEXT NOT NULL,
        samagra_family_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        ward_or_block TEXT NOT NULL,
        area_type TEXT NOT NULL,
        applied_date TEXT NOT NULL,
        current_status TEXT NOT NULL,
        officer_in_charge TEXT NOT NULL,
        sanction_amount DOUBLE PRECISION DEFAULT 0,
        kiosk_operator_code TEXT,
        remarks TEXT,
        timeline_json TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS samagra_families (
        family_id TEXT PRIMARY KEY,
        head_name TEXT NOT NULL,
        area_type TEXT NOT NULL,
        ward_or_block TEXT NOT NULL,
        address TEXT NOT NULL,
        ration_card_type TEXT NOT NULL,
        members_json TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS samagra_households (
        family_id TEXT PRIMARY KEY,
        head_name TEXT NOT NULL,
        area_type TEXT NOT NULL,
        ward_or_block TEXT NOT NULL,
        address TEXT NOT NULL,
        ration_card_type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (family_id)
      );

      CREATE TABLE IF NOT EXISTS samagra_members (
        member_id TEXT PRIMARY KEY,
        family_id TEXT NOT NULL REFERENCES samagra_households(family_id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        name_hindi TEXT NOT NULL,
        relation TEXT NOT NULL,
        relation_hindi TEXT NOT NULL,
        age INTEGER NOT NULL DEFAULT 30,
        gender TEXT NOT NULL DEFAULT 'female',
        category TEXT DEFAULT 'GEN',
        occupation TEXT NOT NULL DEFAULT 'Other',
        ekyc_status INTEGER NOT NULL DEFAULT 0,
        dbt_active INTEGER NOT NULL DEFAULT 0,
        annual_income DOUBLE PRECISION DEFAULT 0,
        land_holding_hectares DOUBLE PRECISION DEFAULT 0,
        has_disability INTEGER NOT NULL DEFAULT 0,
        marital_status TEXT DEFAULT 'Married',
        UNIQUE (member_id)
      );

      CREATE TABLE IF NOT EXISTS digilocker_documents (
        citizen_key TEXT NOT NULL,
        doc_id TEXT NOT NULL,
        doc_number TEXT NOT NULL,
        source TEXT NOT NULL,
        issuer TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 1,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (citizen_key, doc_id)
      );

      CREATE TABLE IF NOT EXISTS digilocker_credentials (
        id TEXT PRIMARY KEY,
        citizen_id TEXT NOT NULL,
        doc_id TEXT,
        doc_uri TEXT NOT NULL,
        doc_name TEXT NOT NULL,
        doc_number TEXT,
        issuer TEXT NOT NULL,
        mime_type TEXT,
        verified INTEGER NOT NULL DEFAULT 1,
        issued_at TEXT,
        verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (citizen_id, doc_uri)
      );

      CREATE TABLE IF NOT EXISTS otp_verifications (
        id TEXT PRIMARY KEY,
        mobile_number TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS oauth_pkce_states (
        state TEXT PRIMARY KEY,
        code_verifier TEXT NOT NULL,
        citizen_key TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS admin_broadcasts (
        seq_id BIGSERIAL,
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        message_hindi TEXT NOT NULL,
        ward_or_block TEXT NOT NULL,
        amount DOUBLE PRECISION,
        arn TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS citizen_accounts (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        phone TEXT,
        mobile_number TEXT UNIQUE,
        mobile_verified INTEGER NOT NULL DEFAULT 0,
        role TEXT NOT NULL DEFAULT 'citizen',
        samagra_id TEXT UNIQUE,
        samagra_family_id TEXT,
        samagra_member_id TEXT,
        area_type TEXT NOT NULL DEFAULT 'urban',
        ward_number INTEGER,
        block_name TEXT,
        category TEXT NOT NULL DEFAULT 'GEN',
        age INTEGER NOT NULL DEFAULT 30,
        gender TEXT NOT NULL DEFAULT 'female',
        annual_income DOUBLE PRECISION NOT NULL DEFAULT 150000,
        occupation TEXT NOT NULL DEFAULT 'Other',
        is_bpl INTEGER NOT NULL DEFAULT 0,
        has_disability INTEGER NOT NULL DEFAULT 0,
        marital_status TEXT NOT NULL DEFAULT 'Married',
        is_mp_domicile INTEGER NOT NULL DEFAULT 1,
        is_indore_resident INTEGER NOT NULL DEFAULT 1,
        ekyc_verified INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS citizen_saved_schemes (
        citizen_id TEXT NOT NULL,
        scheme_id TEXT NOT NULL,
        scheme_title TEXT NOT NULL,
        saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (citizen_id, scheme_id)
      );

      ALTER TABLE applications ADD COLUMN IF NOT EXISTS citizen_id TEXT NOT NULL DEFAULT '';
      UPDATE applications
      SET citizen_id = COALESCE(NULLIF(trim(samagra_member_id), ''), arn)
      WHERE trim(citizen_id) = '';
      DELETE FROM applications a
      USING applications b
      WHERE a.ctid > b.ctid AND a.citizen_id = b.citizen_id AND a.scheme_id = b.scheme_id;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_citizen_scheme_unique
        ON applications (citizen_id, scheme_id);

      ALTER TABLE citizen_accounts ADD COLUMN IF NOT EXISTS samagra_id TEXT;
      ALTER TABLE citizen_accounts ADD COLUMN IF NOT EXISTS mobile_number TEXT;
      ALTER TABLE citizen_accounts ADD COLUMN IF NOT EXISTS mobile_verified INTEGER NOT NULL DEFAULT 0;
      UPDATE citizen_accounts SET samagra_id = NULL WHERE trim(coalesce(samagra_id, '')) = '';
      UPDATE citizen_accounts SET samagra_member_id = NULL WHERE trim(coalesce(samagra_member_id, '')) = '';
      UPDATE citizen_accounts SET samagra_family_id = NULL WHERE trim(coalesce(samagra_family_id, '')) = '';
      UPDATE citizen_accounts SET mobile_number = NULL WHERE trim(coalesce(mobile_number, '')) = '';
      UPDATE citizen_accounts SET phone = NULL WHERE trim(coalesce(phone, '')) = '' OR phone = '9826000000';
      UPDATE citizen_accounts
      SET samagra_id = COALESCE(samagra_member_id, samagra_family_id)
      WHERE samagra_id IS NULL
        AND COALESCE(samagra_member_id, samagra_family_id) IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM citizen_accounts c2
          WHERE c2.id <> citizen_accounts.id
            AND c2.samagra_id = COALESCE(citizen_accounts.samagra_member_id, citizen_accounts.samagra_family_id)
        );
      UPDATE citizen_accounts c
      SET mobile_number = NULL
      WHERE mobile_number IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM citizen_accounts c2
          WHERE c2.mobile_number = c.mobile_number AND c2.id < c.id
        );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_email_unique
        ON citizen_accounts (lower(email));
      CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_mobile_number_unique
        ON citizen_accounts (mobile_number) WHERE mobile_number IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_samagra_id_unique
        ON citizen_accounts (samagra_id) WHERE samagra_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_samagra_households_family_id_unique
        ON samagra_households (family_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_samagra_members_member_id_unique
        ON samagra_members (member_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_digilocker_credentials_citizen_uri_unique
        ON digilocker_credentials (citizen_id, doc_uri);
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile_created
        ON otp_verifications (mobile_number, created_at DESC);
    `);

    await client.query('BEGIN');
    const existingRes = await client.query<{ id: string }>('SELECT id FROM schemes');
    const existingIds = new Set(existingRes.rows.map(r => r.id));
    const nowIso = new Date().toISOString();
    let inserted = 0;

    for (const s of SCHEMES_DATABASE) {
      const portalUrl = resolveSchemePortalUrl(s);
      if (!existingIds.has(s.id)) {
        await client.query(
          `
          INSERT INTO schemes (
            id, code, title, title_hindi, title_malwi, governance_level, department,
            nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
            benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
            eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
            apply_url, csc_available, active_budget_cr, data_origin, portal_status, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17,
            $18, $19, $20, $21,
            $22, $23, $24, 'baseline_catalog', 'unchecked', $25
          )
          ON CONFLICT (id) DO NOTHING
          `,
          [
            s.id,
            s.code,
            s.title,
            s.titleHindi,
            s.titleMalwi,
            s.governanceLevel,
            s.department,
            s.nodalOfficeIndore,
            s.helpline,
            s.targetBeneficiary,
            s.description,
            s.descriptionHindi,
            s.benefits,
            s.benefitsHindi,
            s.financialEntitlement.amount,
            s.financialEntitlement.frequency,
            s.financialEntitlement.description,
            JSON.stringify(s.eligibilityRules),
            JSON.stringify(s.requiredDocuments),
            JSON.stringify(s.tags),
            JSON.stringify(s.malwiSynonyms),
            portalUrl,
            s.cscAvailable ? 1 : 0,
            s.activeBudgetCr || null,
            nowIso,
          ]
        );
        inserted += 1;
      } else {
        await client.query(
          `UPDATE schemes SET apply_url = $1 WHERE id = $2 AND (data_origin = 'baseline_catalog' OR apply_url IS NULL OR trim(apply_url) = '')`,
          [portalUrl, s.id]
        );
      }
    }

    await client.query('DELETE FROM samagra_families WHERE family_id = ANY($1::text[])', [
      DEMO_FAMILY_IDS,
    ]);
    await client.query('DELETE FROM samagra_households WHERE family_id = ANY($1::text[])', [
      DEMO_FAMILY_IDS,
    ]);
    await client.query('DELETE FROM applications WHERE arn = ANY($1::text[])', [DEMO_ARNS]);
    await client.query('DELETE FROM admin_broadcasts WHERE id = ANY($1::text[])', [DEMO_NOTIF_IDS]);
    await client.query(`
      DELETE FROM admin_broadcasts
      WHERE message LIKE 'DBT Batch credited: 120 beneficiaries%'
         OR message LIKE 'Citizen Portal Vijay Nagar: 8 new digital applications%'
         OR message LIKE 'Sanwer Block: Onion-Garlic storage shed subsidy approved for 5 farmer%'
         OR message LIKE 'IMC Town Vending Committee completed biometric survey for 14 street food%'
         OR message LIKE 'MP Kisan Kalyan ₹3,000 top-up installment released to 340%'
         OR message LIKE 'Tribal Bamboo Craft grant application registered under Ahilya Kosh.%'
         OR message LIKE '%MPOnline Kiosk%'
         OR message LIKE '%CSC Kiosk%'
    `);

    // Backfill normalized samagra_households & samagra_members from legacy samagra_families if needed
    const legacyFamRes = await client.query('SELECT * FROM samagra_families');
    for (const row of legacyFamRes.rows) {
      const fam = rowToSamagraFamily(row);
      await client.query(
        `
        INSERT INTO samagra_households (
          family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'manual', $7)
        ON CONFLICT (family_id) DO NOTHING
        `,
        [
          fam.familyId,
          fam.headName,
          fam.areaType,
          fam.wardOrBlock,
          fam.address,
          fam.rationCardType,
          fam.createdAt || nowIso,
        ]
      );
      for (const m of fam.members) {
        await client.query(
          `
          INSERT INTO samagra_members (
            member_id, family_id, name, name_hindi, relation, relation_hindi,
            age, gender, category, occupation, ekyc_status, dbt_active,
            annual_income, land_holding_hectares, has_disability, marital_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (member_id) DO NOTHING
          `,
          [
            String(m.memberId).trim(),
            fam.familyId,
            m.name,
            m.nameHindi || m.name,
            m.relation || 'Member',
            m.relationHindi || m.relation || 'सदस्य',
            Number.isFinite(m.age) ? m.age : 30,
            m.gender || 'female',
            m.category || 'GEN',
            m.occupation || 'Other',
            m.ekycStatus ? 1 : 0,
            m.dbtActive ? 1 : 0,
            m.annualIncome ?? 0,
            m.landHoldingHectares ?? 0,
            m.hasDisability ? 1 : 0,
            m.maritalStatus || 'Married',
          ]
        );
      }
    }

    await client.query('COMMIT');
    if (inserted > 0) {
      console.log(`[PostgreSQL] Loaded ${inserted} baseline schemes into Supabase PostgreSQL.`);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    await pool.end().catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  pgPool = pool;
  storageEngine = 'postgresql';
}

// ================= SQLITE FALLBACK INITIALIZATION =================

function initSqlite(): void {
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.resolve(dataDir, 'yojanasetu.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      title_hindi TEXT NOT NULL,
      title_malwi TEXT NOT NULL,
      governance_level TEXT NOT NULL,
      department TEXT NOT NULL,
      nodal_office_indore TEXT NOT NULL,
      helpline TEXT NOT NULL,
      target_beneficiary TEXT NOT NULL,
      description TEXT NOT NULL,
      description_hindi TEXT NOT NULL,
      benefits TEXT NOT NULL,
      benefits_hindi TEXT NOT NULL,
      financial_amount REAL NOT NULL DEFAULT 0,
      financial_frequency TEXT NOT NULL,
      financial_desc TEXT NOT NULL,
      eligibility_rules_json TEXT NOT NULL,
      required_documents_json TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      malwi_synonyms_json TEXT NOT NULL,
      apply_url TEXT,
      csc_available INTEGER NOT NULL DEFAULT 1,
      active_budget_cr REAL,
      data_origin TEXT NOT NULL DEFAULT 'baseline_catalog',
      portal_status TEXT NOT NULL DEFAULT 'unchecked',
      portal_http_status INTEGER,
      portal_checked_at TEXT,
      portal_latency_ms INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      arn TEXT PRIMARY KEY,
      citizen_id TEXT NOT NULL DEFAULT '',
      scheme_id TEXT NOT NULL,
      scheme_title TEXT NOT NULL,
      scheme_title_hindi TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      samagra_member_id TEXT NOT NULL,
      samagra_family_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      ward_or_block TEXT NOT NULL,
      area_type TEXT NOT NULL,
      applied_date TEXT NOT NULL,
      current_status TEXT NOT NULL,
      officer_in_charge TEXT NOT NULL,
      sanction_amount REAL DEFAULT 0,
      kiosk_operator_code TEXT,
      remarks TEXT,
      timeline_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS samagra_families (
      family_id TEXT PRIMARY KEY,
      head_name TEXT NOT NULL,
      area_type TEXT NOT NULL,
      ward_or_block TEXT NOT NULL,
      address TEXT NOT NULL,
      ration_card_type TEXT NOT NULL,
      members_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS samagra_households (
      family_id TEXT PRIMARY KEY,
      head_name TEXT NOT NULL,
      area_type TEXT NOT NULL,
      ward_or_block TEXT NOT NULL,
      address TEXT NOT NULL,
      ration_card_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      verified_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS samagra_members (
      member_id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL,
      name TEXT NOT NULL,
      name_hindi TEXT NOT NULL,
      relation TEXT NOT NULL,
      relation_hindi TEXT NOT NULL,
      age INTEGER NOT NULL DEFAULT 30,
      gender TEXT NOT NULL DEFAULT 'female',
      category TEXT DEFAULT 'GEN',
      occupation TEXT NOT NULL DEFAULT 'Other',
      ekyc_status INTEGER NOT NULL DEFAULT 0,
      dbt_active INTEGER NOT NULL DEFAULT 0,
      annual_income REAL DEFAULT 0,
      land_holding_hectares REAL DEFAULT 0,
      has_disability INTEGER NOT NULL DEFAULT 0,
      marital_status TEXT DEFAULT 'Married',
      FOREIGN KEY(family_id) REFERENCES samagra_households(family_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS digilocker_documents (
      citizen_key TEXT NOT NULL,
      doc_id TEXT NOT NULL,
      doc_number TEXT NOT NULL,
      source TEXT NOT NULL,
      issuer TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1,
      verified_at TEXT NOT NULL,
      PRIMARY KEY (citizen_key, doc_id)
    );

    CREATE TABLE IF NOT EXISTS digilocker_credentials (
      id TEXT PRIMARY KEY,
      citizen_id TEXT NOT NULL,
      doc_id TEXT,
      doc_uri TEXT NOT NULL,
      doc_name TEXT NOT NULL,
      doc_number TEXT,
      issuer TEXT NOT NULL,
      mime_type TEXT,
      verified INTEGER NOT NULL DEFAULT 1,
      issued_at TEXT,
      verified_at TEXT NOT NULL,
      UNIQUE (citizen_id, doc_uri)
    );

    CREATE TABLE IF NOT EXISTS otp_verifications (
      id TEXT PRIMARY KEY,
      mobile_number TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_pkce_states (
      state TEXT PRIMARY KEY,
      code_verifier TEXT NOT NULL,
      citizen_key TEXT NOT NULL,
      redirect_uri TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_broadcasts (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      message_hindi TEXT NOT NULL,
      ward_or_block TEXT NOT NULL,
      amount REAL,
      arn TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS citizen_accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      phone TEXT,
      mobile_number TEXT UNIQUE,
      mobile_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'citizen',
      samagra_id TEXT UNIQUE,
      samagra_family_id TEXT,
      samagra_member_id TEXT,
      area_type TEXT NOT NULL DEFAULT 'urban',
      ward_number INTEGER,
      block_name TEXT,
      category TEXT NOT NULL DEFAULT 'GEN',
      age INTEGER NOT NULL DEFAULT 30,
      gender TEXT NOT NULL DEFAULT 'female',
      annual_income REAL NOT NULL DEFAULT 150000,
      occupation TEXT NOT NULL DEFAULT 'Other',
      is_bpl INTEGER NOT NULL DEFAULT 0,
      has_disability INTEGER NOT NULL DEFAULT 0,
      marital_status TEXT NOT NULL DEFAULT 'Married',
      is_mp_domicile INTEGER NOT NULL DEFAULT 1,
      is_indore_resident INTEGER NOT NULL DEFAULT 1,
      ekyc_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS citizen_saved_schemes (
      citizen_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      scheme_title TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      PRIMARY KEY (citizen_id, scheme_id)
    );
  `);

  db.pragma('foreign_keys = ON');

  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(schemes)').all() as Array<{ name: string }>).map(c => c.name)
  );
  const migrations: Array<[string, string]> = [
    ['data_origin', "ALTER TABLE schemes ADD COLUMN data_origin TEXT NOT NULL DEFAULT 'baseline_catalog'"],
    ['portal_status', "ALTER TABLE schemes ADD COLUMN portal_status TEXT NOT NULL DEFAULT 'unchecked'"],
    ['portal_http_status', 'ALTER TABLE schemes ADD COLUMN portal_http_status INTEGER'],
    ['portal_checked_at', 'ALTER TABLE schemes ADD COLUMN portal_checked_at TEXT'],
    ['portal_latency_ms', 'ALTER TABLE schemes ADD COLUMN portal_latency_ms INTEGER'],
  ];
  for (const [col, sql] of migrations) {
    if (!existingCols.has(col)) {
      db.exec(sql);
    }
  }

  const appCols = new Set(
    (db.prepare('PRAGMA table_info(applications)').all() as Array<{ name: string }>).map(c => c.name)
  );
  if (!appCols.has('citizen_id')) {
    db.exec("ALTER TABLE applications ADD COLUMN citizen_id TEXT NOT NULL DEFAULT ''");
  }
  db.exec(`
    UPDATE applications
    SET citizen_id = COALESCE(NULLIF(trim(samagra_member_id), ''), arn)
    WHERE trim(citizen_id) = '';
    DELETE FROM applications
    WHERE rowid NOT IN (
      SELECT min(rowid) FROM applications GROUP BY citizen_id, scheme_id
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_citizen_scheme_unique
      ON applications (citizen_id, scheme_id);
  `);

  const citizenCols = new Set(
    (db.prepare('PRAGMA table_info(citizen_accounts)').all() as Array<{ name: string }>).map(
      c => c.name
    )
  );
  if (!citizenCols.has('samagra_id')) {
    db.exec('ALTER TABLE citizen_accounts ADD COLUMN samagra_id TEXT');
  }
  if (!citizenCols.has('mobile_number')) {
    db.exec('ALTER TABLE citizen_accounts ADD COLUMN mobile_number TEXT');
  }
  if (!citizenCols.has('mobile_verified')) {
    db.exec('ALTER TABLE citizen_accounts ADD COLUMN mobile_verified INTEGER NOT NULL DEFAULT 0');
  }
  db.exec(`
    UPDATE citizen_accounts SET samagra_id = NULL WHERE trim(coalesce(samagra_id, '')) = '';
    UPDATE citizen_accounts SET samagra_member_id = NULL WHERE trim(coalesce(samagra_member_id, '')) = '';
    UPDATE citizen_accounts SET samagra_family_id = NULL WHERE trim(coalesce(samagra_family_id, '')) = '';
    UPDATE citizen_accounts SET mobile_number = NULL WHERE trim(coalesce(mobile_number, '')) = '';
    UPDATE citizen_accounts SET phone = NULL WHERE trim(coalesce(phone, '')) = '' OR phone = '9826000000';
    UPDATE citizen_accounts
    SET samagra_id = COALESCE(samagra_member_id, samagra_family_id)
    WHERE samagra_id IS NULL
      AND COALESCE(samagra_member_id, samagra_family_id) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM citizen_accounts c2
        WHERE c2.id <> citizen_accounts.id
          AND c2.samagra_id = COALESCE(citizen_accounts.samagra_member_id, citizen_accounts.samagra_family_id)
      );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_email_unique
      ON citizen_accounts (lower(email));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_mobile_number_unique
      ON citizen_accounts (mobile_number) WHERE mobile_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_citizen_accounts_samagra_id_unique
      ON citizen_accounts (samagra_id) WHERE samagra_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_samagra_households_family_id_unique
      ON samagra_households (family_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_samagra_members_member_id_unique
      ON samagra_members (member_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_digilocker_credentials_citizen_uri_unique
      ON digilocker_credentials (citizen_id, doc_uri);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_mobile_created
      ON otp_verifications (mobile_number, created_at DESC);
  `);

  const existingIds = new Set(
    (db.prepare('SELECT id FROM schemes').all() as Array<{ id: string }>).map(r => r.id)
  );

  const insertBaselineSchemeStmt = db.prepare(`
    INSERT INTO schemes (
      id, code, title, title_hindi, title_malwi, governance_level, department,
      nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
      benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
      eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
      apply_url, csc_available, active_budget_cr, data_origin, portal_status, updated_at
    ) VALUES (
      @id, @code, @title, @titleHindi, @titleMalwi, @governanceLevel, @department,
      @nodalOfficeIndore, @helpline, @targetBeneficiary, @description, @descriptionHindi,
      @benefits, @benefitsHindi, @financialAmount, @financialFrequency, @financialDesc,
      @eligibilityRulesJson, @requiredDocumentsJson, @tagsJson, @malwiSynonymsJson,
      @applyUrl, @cscAvailable, @activeBudgetCr, 'baseline_catalog', 'unchecked', @updatedAt
    )
  `);

  const backfillPortalUrlStmt = db.prepare(`
    UPDATE schemes SET apply_url = ? WHERE id = ? AND (data_origin = 'baseline_catalog' OR apply_url IS NULL OR trim(apply_url) = '')
  `);

  const nowIso = new Date().toISOString();
  const syncBaseline = db.transaction((schemes: Scheme[]) => {
    let inserted = 0;
    for (const s of schemes) {
      const portalUrl = resolveSchemePortalUrl(s);
      if (!existingIds.has(s.id)) {
        insertBaselineSchemeStmt.run({
          id: s.id,
          code: s.code,
          title: s.title,
          titleHindi: s.titleHindi,
          titleMalwi: s.titleMalwi,
          governanceLevel: s.governanceLevel,
          department: s.department,
          nodalOfficeIndore: s.nodalOfficeIndore,
          helpline: s.helpline,
          targetBeneficiary: s.targetBeneficiary,
          description: s.description,
          descriptionHindi: s.descriptionHindi,
          benefits: s.benefits,
          benefitsHindi: s.benefitsHindi,
          financialAmount: s.financialEntitlement.amount,
          financialFrequency: s.financialEntitlement.frequency,
          financialDesc: s.financialEntitlement.description,
          eligibilityRulesJson: JSON.stringify(s.eligibilityRules),
          requiredDocumentsJson: JSON.stringify(s.requiredDocuments),
          tagsJson: JSON.stringify(s.tags),
          malwiSynonymsJson: JSON.stringify(s.malwiSynonyms),
          applyUrl: portalUrl,
          cscAvailable: s.cscAvailable ? 1 : 0,
          activeBudgetCr: s.activeBudgetCr || null,
          updatedAt: nowIso,
        });
        inserted += 1;
      } else {
        backfillPortalUrlStmt.run(portalUrl, s.id);
      }
    }
    return inserted;
  });

  const insertedCount = syncBaseline(SCHEMES_DATABASE);
  if (insertedCount > 0) {
    console.log(`[SQLite] Loaded ${insertedCount} baseline schemes into SQLite fallback database.`);
  }

  const purgeDemo = db.transaction(() => {
    db.prepare(`DELETE FROM samagra_families WHERE family_id IN (${DEMO_FAMILY_IDS.map(() => '?').join(',')})`).run(...DEMO_FAMILY_IDS);
    db.prepare(`DELETE FROM samagra_households WHERE family_id IN (${DEMO_FAMILY_IDS.map(() => '?').join(',')})`).run(...DEMO_FAMILY_IDS);
    db.prepare(`DELETE FROM applications WHERE arn IN (${DEMO_ARNS.map(() => '?').join(',')})`).run(...DEMO_ARNS);
    db.prepare(`DELETE FROM admin_broadcasts WHERE id IN (${DEMO_NOTIF_IDS.map(() => '?').join(',')})`).run(...DEMO_NOTIF_IDS);
    db.prepare(`
      DELETE FROM admin_broadcasts
      WHERE message LIKE 'DBT Batch credited: 120 beneficiaries%'
         OR message LIKE 'Citizen Portal Vijay Nagar: 8 new digital applications%'
         OR message LIKE 'Sanwer Block: Onion-Garlic storage shed subsidy approved for 5 farmer%'
         OR message LIKE 'IMC Town Vending Committee completed biometric survey for 14 street food%'
         OR message LIKE 'MP Kisan Kalyan ₹3,000 top-up installment released to 340%'
         OR message LIKE 'Tribal Bamboo Craft grant application registered under Ahilya Kosh.%'
         OR message LIKE '%MPOnline Kiosk%'
         OR message LIKE '%CSC Kiosk%'
    `).run();

    // Migrate any legacy samagra_families rows into samagra_households + samagra_members
    const legacyFams = db.prepare('SELECT * FROM samagra_families').all() as any[];
    const insertHouseholdStmt = db.prepare(`
      INSERT OR IGNORE INTO samagra_households (
        family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)
    `);
    const insertMemberStmt = db.prepare(`
      INSERT OR IGNORE INTO samagra_members (
        member_id, family_id, name, name_hindi, relation, relation_hindi,
        age, gender, category, occupation, ekyc_status, dbt_active,
        annual_income, land_holding_hectares, has_disability, marital_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const row of legacyFams) {
      const fam = rowToSamagraFamily(row);
      insertHouseholdStmt.run(
        fam.familyId,
        fam.headName,
        fam.areaType,
        fam.wardOrBlock,
        fam.address,
        fam.rationCardType,
        fam.createdAt || nowIso
      );
      for (const m of fam.members) {
        insertMemberStmt.run(
          String(m.memberId).trim(),
          fam.familyId,
          m.name,
          m.nameHindi || m.name,
          m.relation || 'Member',
          m.relationHindi || m.relation || 'सदस्य',
          Number.isFinite(m.age) ? m.age : 30,
          m.gender || 'female',
          m.category || 'GEN',
          m.occupation || 'Other',
          m.ekycStatus ? 1 : 0,
          m.dbtActive ? 1 : 0,
          m.annualIncome ?? 0,
          m.landHoldingHectares ?? 0,
          m.hasDisability ? 1 : 0,
          m.maritalStatus || 'Married'
        );
      }
    }
  });
  purgeDemo();

  sqliteDb = db;
  storageEngine = 'sqlite';
}

async function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const databaseUrl = process.env.DATABASE_URL?.trim();
      if (databaseUrl) {
        try {
          await initPostgres(databaseUrl);
          return;
        } catch (err) {
          console.warn(
            '[Database] Could not connect to Supabase PostgreSQL via DATABASE_URL; falling back to local SQLite database:',
            err instanceof Error ? err.message : String(err)
          );
        }
      }
      initSqlite();
    })();
  }
  await initPromise;
}

// ================= ASYNC DUAL-ENGINE CRUD OPERATIONS =================

export const dbService = {
  async init(): Promise<void> {
    await ensureInitialized();
  },

  getStorageEngine(): 'postgresql' | 'sqlite' {
    return storageEngine;
  },

  // ---------- Schemes ----------
  async getSchemes(filters?: { level?: string; search?: string }): Promise<Scheme[]> {
    await ensureInitialized();

    if (pgPool) {
      let query = 'SELECT * FROM schemes WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (filters?.level && filters.level !== 'all') {
        query += ` AND governance_level = $${idx++}`;
        params.push(filters.level);
      }

      if (filters?.search && filters.search.trim()) {
        const term = `%${filters.search.trim().toLowerCase()}%`;
        query += ` AND (
          lower(title) LIKE $${idx} OR
          lower(title_hindi) LIKE $${idx + 1} OR
          lower(title_malwi) LIKE $${idx + 2} OR
          lower(department) LIKE $${idx + 3} OR
          lower(description) LIKE $${idx + 4} OR
          lower(tags_json) LIKE $${idx + 5} OR
          lower(malwi_synonyms_json) LIKE $${idx + 6}
        )`;
        params.push(term, term, term, term, term, term, term);
        idx += 7;
      }

      query += ' ORDER BY seq_id ASC';
      const res = await pgPool.query(query, params);
      return res.rows.map(rowToScheme);
    }

    const db = sqliteDb!;
    let query = 'SELECT * FROM schemes WHERE 1=1';
    const params: any[] = [];

    if (filters?.level && filters.level !== 'all') {
      query += ' AND governance_level = ?';
      params.push(filters.level);
    }

    if (filters?.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toLowerCase()}%`;
      query += ` AND (
        lower(title) LIKE ? OR
        lower(title_hindi) LIKE ? OR
        lower(title_malwi) LIKE ? OR
        lower(department) LIKE ? OR
        lower(description) LIKE ? OR
        lower(tags_json) LIKE ? OR
        lower(malwi_synonyms_json) LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    query += ' ORDER BY rowid ASC';
    const rows = db.prepare(query).all(...params);
    return rows.map(rowToScheme);
  },

  async getSchemeById(id: string): Promise<Scheme | null> {
    await ensureInitialized();

    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM schemes WHERE id = $1', [id]);
      if (res.rows.length === 0) return null;
      return rowToScheme(res.rows[0]);
    }

    const row = sqliteDb!.prepare('SELECT * FROM schemes WHERE id = ?').get(id);
    if (!row) return null;
    return rowToScheme(row);
  },

  async insertScheme(
    scheme: Scheme,
    origin: 'baseline_catalog' | 'admin_live' = 'admin_live'
  ): Promise<Scheme> {
    await ensureInitialized();
    const existing = await this.getSchemeById(scheme.id);
    const portalUrl = resolveSchemePortalUrl(scheme);
    const nowIso = new Date().toISOString();

    const params = [
      scheme.id,
      scheme.code || scheme.id.toUpperCase(),
      scheme.title,
      scheme.titleHindi || scheme.title,
      scheme.titleMalwi || scheme.titleHindi || scheme.title,
      scheme.governanceLevel || 'district_indore',
      scheme.department || 'District Administration Indore',
      scheme.nodalOfficeIndore || 'Collectorate Campus Indore',
      scheme.helpline || '181',
      scheme.targetBeneficiary || 'Citizens of Indore',
      scheme.description || '',
      scheme.descriptionHindi || scheme.description || '',
      scheme.benefits || '',
      scheme.benefitsHindi || scheme.benefits || '',
      Number(scheme.financialEntitlement?.amount) || 0,
      scheme.financialEntitlement?.frequency || 'One-Time',
      scheme.financialEntitlement?.description || '',
      JSON.stringify(scheme.eligibilityRules || {}),
      JSON.stringify(scheme.requiredDocuments || []),
      JSON.stringify(scheme.tags || []),
      JSON.stringify(scheme.malwiSynonyms || []),
      portalUrl,
      scheme.cscAvailable === false ? 0 : 1,
      scheme.activeBudgetCr || null,
      origin,
      existing?.portalStatus || 'unchecked',
      existing?.portalHttpStatus ?? null,
      existing?.portalCheckedAt ?? null,
      existing?.portalLatencyMs ?? null,
      nowIso,
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO schemes (
          id, code, title, title_hindi, title_malwi, governance_level, department,
          nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
          benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
          eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
          apply_url, csc_available, active_budget_cr, data_origin,
          portal_status, portal_http_status, portal_checked_at, portal_latency_ms, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24, $25,
          $26, $27, $28, $29, $30
        )
        ON CONFLICT (id) DO UPDATE SET
          code = EXCLUDED.code,
          title = EXCLUDED.title,
          title_hindi = EXCLUDED.title_hindi,
          title_malwi = EXCLUDED.title_malwi,
          governance_level = EXCLUDED.governance_level,
          department = EXCLUDED.department,
          nodal_office_indore = EXCLUDED.nodal_office_indore,
          helpline = EXCLUDED.helpline,
          target_beneficiary = EXCLUDED.target_beneficiary,
          description = EXCLUDED.description,
          description_hindi = EXCLUDED.description_hindi,
          benefits = EXCLUDED.benefits,
          benefits_hindi = EXCLUDED.benefits_hindi,
          financial_amount = EXCLUDED.financial_amount,
          financial_frequency = EXCLUDED.financial_frequency,
          financial_desc = EXCLUDED.financial_desc,
          eligibility_rules_json = EXCLUDED.eligibility_rules_json,
          required_documents_json = EXCLUDED.required_documents_json,
          tags_json = EXCLUDED.tags_json,
          malwi_synonyms_json = EXCLUDED.malwi_synonyms_json,
          apply_url = EXCLUDED.apply_url,
          csc_available = EXCLUDED.csc_available,
          active_budget_cr = EXCLUDED.active_budget_cr,
          data_origin = EXCLUDED.data_origin,
          portal_status = EXCLUDED.portal_status,
          portal_http_status = EXCLUDED.portal_http_status,
          portal_checked_at = EXCLUDED.portal_checked_at,
          portal_latency_ms = EXCLUDED.portal_latency_ms,
          updated_at = EXCLUDED.updated_at
        `,
        params
      );
      return (await this.getSchemeById(scheme.id))!;
    }

    sqliteDb!
      .prepare(`
        INSERT OR REPLACE INTO schemes (
          id, code, title, title_hindi, title_malwi, governance_level, department,
          nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
          benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
          eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
          apply_url, csc_available, active_budget_cr, data_origin,
          portal_status, portal_http_status, portal_checked_at, portal_latency_ms, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?
        )
      `)
      .run(...params);

    return (await this.getSchemeById(scheme.id))!;
  },

  async updateSchemesPortalCheckByUrl(
    urlResults: Map<
      string,
      {
        status: PortalReachabilityStatus;
        httpStatus: number | null;
        latencyMs: number | null;
        checkedAt: string;
      }
    >
  ): Promise<SchemesRealtimeReport> {
    await ensureInitialized();
    const schemes = await this.getSchemes();

    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        for (const s of schemes) {
          const url = resolveSchemePortalUrl(s);
          const res = urlResults.get(url);
          if (res) {
            await client.query(
              `UPDATE schemes SET portal_status = $1, portal_http_status = $2, portal_checked_at = $3, portal_latency_ms = $4 WHERE id = $5`,
              [res.status, res.httpStatus, res.checkedAt, res.latencyMs, s.id]
            );
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return evaluateSchemesRealtimeStatus(await this.getSchemes());
    }

    const db = sqliteDb!;
    const updateStmt = db.prepare(`
      UPDATE schemes
      SET portal_status = ?, portal_http_status = ?, portal_checked_at = ?, portal_latency_ms = ?
      WHERE id = ?
    `);
    const tx = db.transaction(() => {
      for (const s of schemes) {
        const url = resolveSchemePortalUrl(s);
        const res = urlResults.get(url);
        if (res) {
          updateStmt.run(res.status, res.httpStatus, res.checkedAt, res.latencyMs, s.id);
        }
      }
    });
    tx();

    return evaluateSchemesRealtimeStatus(await this.getSchemes());
  },

  async getSchemesRealtimeStatus(): Promise<SchemesRealtimeReport> {
    return evaluateSchemesRealtimeStatus(await this.getSchemes());
  },

  async deleteScheme(id: string): Promise<boolean> {
    await ensureInitialized();
    if (pgPool) {
      const res = await pgPool.query('DELETE FROM schemes WHERE id = $1', [id]);
      return (res.rowCount ?? 0) > 0;
    }
    const info = sqliteDb!.prepare('DELETE FROM schemes WHERE id = ?').run(id);
    return info.changes > 0;
  },

  // ---------- Applications ----------
  async getApplications(filters?: {
    arn?: string;
    samagraId?: string;
    status?: string;
  }): Promise<ApplicationRecord[]> {
    await ensureInitialized();

    if (pgPool) {
      let query = 'SELECT * FROM applications WHERE 1=1';
      const params: any[] = [];
      let idx = 1;

      if (filters?.arn) {
        query += ` AND upper(arn) = upper($${idx++})`;
        params.push(filters.arn.trim());
      }
      if (filters?.samagraId) {
        query += ` AND (samagra_family_id = $${idx} OR samagra_member_id = $${idx + 1})`;
        params.push(filters.samagraId.trim(), filters.samagraId.trim());
        idx += 2;
      }
      if (filters?.status) {
        query += ` AND current_status = $${idx++}`;
        params.push(filters.status);
      }

      query += ' ORDER BY seq_id DESC';
      const res = await pgPool.query(query, params);
      return res.rows.map(rowToApplication);
    }

    let query = 'SELECT * FROM applications WHERE 1=1';
    const params: any[] = [];

    if (filters?.arn) {
      query += ' AND upper(arn) = upper(?)';
      params.push(filters.arn.trim());
    }
    if (filters?.samagraId) {
      query += ' AND (samagra_family_id = ? OR samagra_member_id = ?)';
      params.push(filters.samagraId.trim(), filters.samagraId.trim());
    }
    if (filters?.status) {
      query += ' AND current_status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY rowid DESC';
    const rows = sqliteDb!.prepare(query).all(...params);
    return rows.map(rowToApplication);
  },

  async getApplicationByArn(arn: string): Promise<ApplicationRecord | null> {
    await ensureInitialized();
    const clean = arn.trim();
    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM applications WHERE upper(arn) = upper($1)', [
        clean,
      ]);
      if (res.rows.length === 0) return null;
      return rowToApplication(res.rows[0]);
    }
    const row = sqliteDb!.prepare('SELECT * FROM applications WHERE upper(arn) = upper(?)').get(clean);
    if (!row) return null;
    return rowToApplication(row);
  },

  async insertApplication(app: ApplicationRecord): Promise<boolean> {
    await ensureInitialized();
    const citizenId = (app.citizenId || app.samagraMemberId || app.samagraFamilyId).trim();
    const params = [
      app.arn,
      citizenId,
      app.schemeId,
      app.schemeTitle,
      app.schemeTitleHindi,
      app.applicantName,
      app.samagraMemberId,
      app.samagraFamilyId,
      app.phone,
      app.wardOrBlock,
      app.areaType,
      app.appliedDate,
      app.currentStatus,
      app.officerInCharge,
      app.sanctionAmount || 0,
      null,
      app.remarks || '',
      JSON.stringify(app.timeline),
      new Date().toISOString(),
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO applications (
          arn, citizen_id, scheme_id, scheme_title, scheme_title_hindi, applicant_name,
          samagra_member_id, samagra_family_id, phone, ward_or_block, area_type,
          applied_date, current_status, officer_in_charge, sanction_amount,
          kiosk_operator_code, remarks, timeline_json, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19
        )
        `,
        params
      );
      return true;
    }

    sqliteDb!
      .prepare(`
        INSERT INTO applications (
          arn, citizen_id, scheme_id, scheme_title, scheme_title_hindi, applicant_name,
          samagra_member_id, samagra_family_id, phone, ward_or_block, area_type,
          applied_date, current_status, officer_in_charge, sanction_amount,
          kiosk_operator_code, remarks, timeline_json, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `)
      .run(...params);
    return true;
  },

  async updateApplicationStatus(
    arn: string,
    status: ApplicationRecord['currentStatus'],
    remarks?: string
  ): Promise<ApplicationRecord | null> {
    await ensureInitialized();
    const existing = await this.getApplicationByArn(arn);
    if (!existing) return null;

    const stageOrder: ApplicationRecord['currentStatus'][] = [
      'submitted',
      'ward_verification',
      'collectorate_scrutiny',
      'sanction_issued',
      'dbt_disbursed',
    ];
    const targetIdx = stageOrder.indexOf(status);
    const nowDisplay = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    let timeline = existing.timeline.map((step, idx) => {
      if (status === 'rejected') {
        if (step.status === 'completed') return step;
        return { ...step, status: 'pending' as const };
      }
      if (targetIdx >= 0) {
        if (idx < targetIdx) {
          return {
            ...step,
            status: 'completed' as const,
            date:
              step.date === 'Pending' || step.date.startsWith('In Progress')
                ? nowDisplay
                : step.date,
          };
        }
        if (idx === targetIdx) {
          return {
            ...step,
            status: 'completed' as const,
            date: nowDisplay,
            remarks: remarks || step.remarks,
          };
        }
        if (idx === targetIdx + 1) {
          return {
            ...step,
            status: 'in_progress' as const,
            date: 'In Progress',
          };
        }
      }
      return step;
    });

    if (status === 'rejected') {
      timeline = [
        ...timeline,
        {
          title: 'Application Returned / Rejected',
          titleHindi: 'आवेदन अस्वीकृत / वापस किया गया',
          date: nowDisplay,
          location: 'Indore Collectorate Admin Portal',
          status: 'completed',
          remarks: remarks || 'Returned by verification officer for correction.',
        },
      ];
    }

    const nextRemarks = remarks || existing.remarks;
    const timelineJson = JSON.stringify(timeline);
    const cleanArn = arn.trim();

    if (pgPool) {
      await pgPool.query(
        `UPDATE applications SET current_status = $1, remarks = $2, timeline_json = $3 WHERE upper(arn) = upper($4)`,
        [status, nextRemarks, timelineJson, cleanArn]
      );
    } else {
      sqliteDb!
        .prepare(
          `UPDATE applications SET current_status = ?, remarks = ?, timeline_json = ? WHERE upper(arn) = upper(?)`
        )
        .run(status, nextRemarks, timelineJson, cleanArn);
    }

    return this.getApplicationByArn(arn);
  },

  // ---------- Samagra Households & Members ----------
  async getAllSamagraFamilies(): Promise<SamagraFamily[]> {
    await ensureInitialized();
    if (pgPool) {
      const hRes = await pgPool.query('SELECT * FROM samagra_households ORDER BY created_at DESC');
      const mRes = await pgPool.query('SELECT * FROM samagra_members ORDER BY member_id ASC');
      const membersByFamily = new Map<string, SamagraFamily['members']>();
      for (const m of mRes.rows) {
        const list = membersByFamily.get(m.family_id) || [];
        list.push({
          memberId: m.member_id,
          name: m.name,
          nameHindi: m.name_hindi,
          relation: m.relation,
          relationHindi: m.relation_hindi,
          age: Number(m.age),
          gender: m.gender,
          category: m.category || 'GEN',
          occupation: m.occupation,
          ekycStatus: Boolean(Number(m.ekyc_status)),
          dbtActive: Boolean(Number(m.dbt_active)),
          annualIncome: m.annual_income !== null && m.annual_income !== undefined ? Number(m.annual_income) : 0,
          landHoldingHectares:
            m.land_holding_hectares !== null && m.land_holding_hectares !== undefined
              ? Number(m.land_holding_hectares)
              : 0,
          hasDisability: Boolean(Number(m.has_disability)),
          maritalStatus: m.marital_status || 'Married',
        });
        membersByFamily.set(m.family_id, list);
      }
      return hRes.rows.map(r => ({
        familyId: r.family_id,
        headName: r.head_name,
        areaType: r.area_type,
        wardOrBlock: r.ward_or_block,
        address: r.address,
        rationCardType: r.ration_card_type,
        source: r.source || 'manual',
        createdAt: toIsoString(r.created_at),
        members: membersByFamily.get(r.family_id) || [],
      }));
    }

    const db = sqliteDb!;
    const hRows = db.prepare('SELECT * FROM samagra_households ORDER BY created_at DESC').all() as any[];
    const mRows = db.prepare('SELECT * FROM samagra_members ORDER BY member_id ASC').all() as any[];
    const membersByFamily = new Map<string, SamagraFamily['members']>();
    for (const m of mRows) {
      const list = membersByFamily.get(m.family_id) || [];
      list.push({
        memberId: m.member_id,
        name: m.name,
        nameHindi: m.name_hindi,
        relation: m.relation,
        relationHindi: m.relation_hindi,
        age: Number(m.age),
        gender: m.gender,
        category: m.category || 'GEN',
        occupation: m.occupation,
        ekycStatus: Boolean(Number(m.ekyc_status)),
        dbtActive: Boolean(Number(m.dbt_active)),
        annualIncome: m.annual_income !== null && m.annual_income !== undefined ? Number(m.annual_income) : 0,
        landHoldingHectares:
          m.land_holding_hectares !== null && m.land_holding_hectares !== undefined
            ? Number(m.land_holding_hectares)
            : 0,
        hasDisability: Boolean(Number(m.has_disability)),
        maritalStatus: m.marital_status || 'Married',
      });
      membersByFamily.set(m.family_id, list);
    }
    return hRows.map(r => ({
      familyId: r.family_id,
      headName: r.head_name,
      areaType: r.area_type,
      wardOrBlock: r.ward_or_block,
      address: r.address,
      rationCardType: r.ration_card_type,
      source: r.source || 'manual',
      createdAt: toIsoString(r.created_at),
      members: membersByFamily.get(r.family_id) || [],
    }));
  },

  async getSamagraFamily(idOrMemberId: string): Promise<SamagraFamily | null> {
    await ensureInitialized();
    const cleanId = idOrMemberId.trim();
    if (!cleanId) return null;

    if (pgPool) {
      let famRes = await pgPool.query('SELECT * FROM samagra_households WHERE family_id = $1 LIMIT 1', [
        cleanId,
      ]);
      if (famRes.rows.length === 0) {
        const memLookup = await pgPool.query(
          'SELECT family_id FROM samagra_members WHERE member_id = $1 LIMIT 1',
          [cleanId]
        );
        if (memLookup.rows.length > 0) {
          famRes = await pgPool.query('SELECT * FROM samagra_households WHERE family_id = $1 LIMIT 1', [
            memLookup.rows[0].family_id,
          ]);
        }
      }
      if (famRes.rows.length === 0) return null;
      const h = famRes.rows[0];
      const mRes = await pgPool.query(
        'SELECT * FROM samagra_members WHERE family_id = $1 ORDER BY member_id ASC',
        [h.family_id]
      );
      return {
        familyId: h.family_id,
        headName: h.head_name,
        areaType: h.area_type,
        wardOrBlock: h.ward_or_block,
        address: h.address,
        rationCardType: h.ration_card_type,
        source: h.source || 'manual',
        createdAt: toIsoString(h.created_at),
        members: mRes.rows.map(m => ({
          memberId: m.member_id,
          name: m.name,
          nameHindi: m.name_hindi,
          relation: m.relation,
          relationHindi: m.relation_hindi,
          age: Number(m.age),
          gender: m.gender,
          category: m.category || 'GEN',
          occupation: m.occupation,
          ekycStatus: Boolean(Number(m.ekyc_status)),
          dbtActive: Boolean(Number(m.dbt_active)),
          annualIncome: m.annual_income !== null && m.annual_income !== undefined ? Number(m.annual_income) : 0,
          landHoldingHectares:
            m.land_holding_hectares !== null && m.land_holding_hectares !== undefined
              ? Number(m.land_holding_hectares)
              : 0,
          hasDisability: Boolean(Number(m.has_disability)),
          maritalStatus: m.marital_status || 'Married',
        })),
      };
    }

    const db = sqliteDb!;
    let h = db.prepare('SELECT * FROM samagra_households WHERE family_id = ? LIMIT 1').get(cleanId) as any;
    if (!h) {
      const mRow = db
        .prepare('SELECT family_id FROM samagra_members WHERE member_id = ? LIMIT 1')
        .get(cleanId) as any;
      if (mRow) {
        h = db
          .prepare('SELECT * FROM samagra_households WHERE family_id = ? LIMIT 1')
          .get(mRow.family_id) as any;
      }
    }
    if (!h) return null;

    const mRows = db
      .prepare('SELECT * FROM samagra_members WHERE family_id = ? ORDER BY member_id ASC')
      .all(h.family_id) as any[];
    return {
      familyId: h.family_id,
      headName: h.head_name,
      areaType: h.area_type,
      wardOrBlock: h.ward_or_block,
      address: h.address,
      rationCardType: h.ration_card_type,
      source: h.source || 'manual',
      createdAt: toIsoString(h.created_at),
      members: mRows.map(m => ({
        memberId: m.member_id,
        name: m.name,
        nameHindi: m.name_hindi,
        relation: m.relation,
        relationHindi: m.relation_hindi,
        age: Number(m.age),
        gender: m.gender,
        category: m.category || 'GEN',
        occupation: m.occupation,
        ekycStatus: Boolean(Number(m.ekyc_status)),
        dbtActive: Boolean(Number(m.dbt_active)),
        annualIncome: m.annual_income !== null && m.annual_income !== undefined ? Number(m.annual_income) : 0,
        landHoldingHectares:
          m.land_holding_hectares !== null && m.land_holding_hectares !== undefined
            ? Number(m.land_holding_hectares)
            : 0,
        hasDisability: Boolean(Number(m.has_disability)),
        maritalStatus: m.marital_status || 'Married',
      })),
    };
  },

  // Strict INSERT (throws unique violation 23505 / SQLITE_CONSTRAINT if family_id or any member_id exists)
  async registerSamagraFamily(
    family: SamagraFamily,
    source: string = 'manual'
  ): Promise<SamagraFamily> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    const cleanFamily: SamagraFamily = {
      familyId: family.familyId.trim(),
      headName: family.headName.trim(),
      areaType: family.areaType === 'rural' ? 'rural' : 'urban',
      wardOrBlock: family.wardOrBlock.trim(),
      address: family.address.trim(),
      rationCardType:
        family.rationCardType === 'BPL' || family.rationCardType === 'Antyodaya'
          ? family.rationCardType
          : 'APL',
      members: family.members.map(m => ({
        ...m,
        memberId: String(m.memberId).trim(),
        name: String(m.name).trim(),
        nameHindi: String(m.nameHindi || m.name).trim(),
        relation: String(m.relation || 'Member').trim(),
        relationHindi: String(m.relationHindi || m.relation || 'सदस्य').trim(),
      })),
      source,
      createdAt: nowIso,
    };

    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
          INSERT INTO samagra_households (
            family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            cleanFamily.familyId,
            cleanFamily.headName,
            cleanFamily.areaType,
            cleanFamily.wardOrBlock,
            cleanFamily.address,
            cleanFamily.rationCardType,
            source,
            cleanFamily.createdAt,
          ]
        );
        for (const m of cleanFamily.members) {
          await client.query(
            `
            INSERT INTO samagra_members (
              member_id, family_id, name, name_hindi, relation, relation_hindi,
              age, gender, category, occupation, ekyc_status, dbt_active,
              annual_income, land_holding_hectares, has_disability, marital_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `,
            [
              m.memberId,
              cleanFamily.familyId,
              m.name,
              m.nameHindi,
              m.relation,
              m.relationHindi,
              Number.isFinite(m.age) ? m.age : 30,
              m.gender || 'female',
              m.category || 'GEN',
              m.occupation || 'Other',
              m.ekycStatus ? 1 : 0,
              m.dbtActive ? 1 : 0,
              m.annualIncome ?? 0,
              m.landHoldingHectares ?? 0,
              m.hasDisability ? 1 : 0,
              m.maritalStatus || 'Married',
            ]
          );
        }
        await client.query(
          `
          INSERT INTO samagra_families (
            family_id, head_name, area_type, ward_or_block, address, ration_card_type, members_json, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (family_id) DO NOTHING
          `,
          [
            cleanFamily.familyId,
            cleanFamily.headName,
            cleanFamily.areaType,
            cleanFamily.wardOrBlock,
            cleanFamily.address,
            cleanFamily.rationCardType,
            JSON.stringify(cleanFamily.members),
            cleanFamily.createdAt,
          ]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return cleanFamily;
    }

    const db = sqliteDb!;
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO samagra_households (
          family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanFamily.familyId,
        cleanFamily.headName,
        cleanFamily.areaType,
        cleanFamily.wardOrBlock,
        cleanFamily.address,
        cleanFamily.rationCardType,
        source,
        cleanFamily.createdAt
      );

      const insertMemStmt = db.prepare(`
        INSERT INTO samagra_members (
          member_id, family_id, name, name_hindi, relation, relation_hindi,
          age, gender, category, occupation, ekyc_status, dbt_active,
          annual_income, land_holding_hectares, has_disability, marital_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of cleanFamily.members) {
        insertMemStmt.run(
          m.memberId,
          cleanFamily.familyId,
          m.name,
          m.nameHindi,
          m.relation,
          m.relationHindi,
          Number.isFinite(m.age) ? m.age : 30,
          m.gender || 'female',
          m.category || 'GEN',
          m.occupation || 'Other',
          m.ekycStatus ? 1 : 0,
          m.dbtActive ? 1 : 0,
          m.annualIncome ?? 0,
          m.landHoldingHectares ?? 0,
          m.hasDisability ? 1 : 0,
          m.maritalStatus || 'Married'
        );
      }

      db.prepare(`
        INSERT OR IGNORE INTO samagra_families (
          family_id, head_name, area_type, ward_or_block, address, ration_card_type, members_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanFamily.familyId,
        cleanFamily.headName,
        cleanFamily.areaType,
        cleanFamily.wardOrBlock,
        cleanFamily.address,
        cleanFamily.rationCardType,
        JSON.stringify(cleanFamily.members),
        cleanFamily.createdAt
      );
    });
    tx();

    return cleanFamily;
  },

  // Upsert cache strictly for verified external MP Samagra Portal API responses
  async upsertSamagraFamilyFromPortal(
    family: SamagraFamily,
    source: string = 'samagra_gov_in'
  ): Promise<SamagraFamily> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    const cleanFamily: SamagraFamily = {
      familyId: family.familyId.trim(),
      headName: family.headName.trim(),
      areaType: family.areaType === 'rural' ? 'rural' : 'urban',
      wardOrBlock: family.wardOrBlock.trim(),
      address: family.address.trim(),
      rationCardType:
        family.rationCardType === 'BPL' || family.rationCardType === 'Antyodaya'
          ? family.rationCardType
          : 'APL',
      members: family.members.map(m => ({
        ...m,
        memberId: String(m.memberId).trim(),
        name: String(m.name).trim(),
        nameHindi: String(m.nameHindi || m.name).trim(),
        relation: String(m.relation || 'Member').trim(),
        relationHindi: String(m.relationHindi || m.relation || 'सदस्य').trim(),
      })),
      source,
      createdAt: family.createdAt || nowIso,
    };

    if (pgPool) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
          INSERT INTO samagra_households (
            family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, verified_at, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (family_id) DO UPDATE SET
            head_name = EXCLUDED.head_name,
            area_type = EXCLUDED.area_type,
            ward_or_block = EXCLUDED.ward_or_block,
            address = EXCLUDED.address,
            ration_card_type = EXCLUDED.ration_card_type,
            source = EXCLUDED.source,
            verified_at = EXCLUDED.verified_at
          `,
          [
            cleanFamily.familyId,
            cleanFamily.headName,
            cleanFamily.areaType,
            cleanFamily.wardOrBlock,
            cleanFamily.address,
            cleanFamily.rationCardType,
            source,
            nowIso,
            cleanFamily.createdAt,
          ]
        );
        for (const m of cleanFamily.members) {
          await client.query(
            `
            INSERT INTO samagra_members (
              member_id, family_id, name, name_hindi, relation, relation_hindi,
              age, gender, category, occupation, ekyc_status, dbt_active,
              annual_income, land_holding_hectares, has_disability, marital_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (member_id) DO UPDATE SET
              family_id = EXCLUDED.family_id,
              name = EXCLUDED.name,
              name_hindi = EXCLUDED.name_hindi,
              relation = EXCLUDED.relation,
              relation_hindi = EXCLUDED.relation_hindi,
              age = EXCLUDED.age,
              gender = EXCLUDED.gender,
              category = EXCLUDED.category,
              occupation = EXCLUDED.occupation,
              ekyc_status = EXCLUDED.ekyc_status,
              dbt_active = EXCLUDED.dbt_active,
              annual_income = EXCLUDED.annual_income,
              land_holding_hectares = EXCLUDED.land_holding_hectares,
              has_disability = EXCLUDED.has_disability,
              marital_status = EXCLUDED.marital_status
            `,
            [
              m.memberId,
              cleanFamily.familyId,
              m.name,
              m.nameHindi,
              m.relation,
              m.relationHindi,
              Number.isFinite(m.age) ? m.age : 30,
              m.gender || 'female',
              m.category || 'GEN',
              m.occupation || 'Other',
              m.ekycStatus ? 1 : 0,
              m.dbtActive ? 1 : 0,
              m.annualIncome ?? 0,
              m.landHoldingHectares ?? 0,
              m.hasDisability ? 1 : 0,
              m.maritalStatus || 'Married',
            ]
          );
        }
        await client.query(
          `
          INSERT INTO samagra_families (
            family_id, head_name, area_type, ward_or_block, address, ration_card_type, members_json, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (family_id) DO UPDATE SET
            head_name = EXCLUDED.head_name,
            area_type = EXCLUDED.area_type,
            ward_or_block = EXCLUDED.ward_or_block,
            address = EXCLUDED.address,
            ration_card_type = EXCLUDED.ration_card_type,
            members_json = EXCLUDED.members_json
          `,
          [
            cleanFamily.familyId,
            cleanFamily.headName,
            cleanFamily.areaType,
            cleanFamily.wardOrBlock,
            cleanFamily.address,
            cleanFamily.rationCardType,
            JSON.stringify(cleanFamily.members),
            cleanFamily.createdAt,
          ]
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return cleanFamily;
    }

    const db = sqliteDb!;
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT OR REPLACE INTO samagra_households (
          family_id, head_name, area_type, ward_or_block, address, ration_card_type, source, verified_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanFamily.familyId,
        cleanFamily.headName,
        cleanFamily.areaType,
        cleanFamily.wardOrBlock,
        cleanFamily.address,
        cleanFamily.rationCardType,
        source,
        nowIso,
        cleanFamily.createdAt
      );
      const memUpsert = db.prepare(`
        INSERT OR REPLACE INTO samagra_members (
          member_id, family_id, name, name_hindi, relation, relation_hindi,
          age, gender, category, occupation, ekyc_status, dbt_active,
          annual_income, land_holding_hectares, has_disability, marital_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of cleanFamily.members) {
        memUpsert.run(
          m.memberId,
          cleanFamily.familyId,
          m.name,
          m.nameHindi,
          m.relation,
          m.relationHindi,
          Number.isFinite(m.age) ? m.age : 30,
          m.gender || 'female',
          m.category || 'GEN',
          m.occupation || 'Other',
          m.ekycStatus ? 1 : 0,
          m.dbtActive ? 1 : 0,
          m.annualIncome ?? 0,
          m.landHoldingHectares ?? 0,
          m.hasDisability ? 1 : 0,
          m.maritalStatus || 'Married'
        );
      }
      db.prepare(`
        INSERT OR REPLACE INTO samagra_families (
          family_id, head_name, area_type, ward_or_block, address, ration_card_type, members_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        cleanFamily.familyId,
        cleanFamily.headName,
        cleanFamily.areaType,
        cleanFamily.wardOrBlock,
        cleanFamily.address,
        cleanFamily.rationCardType,
        JSON.stringify(cleanFamily.members),
        cleanFamily.createdAt
      );
    });
    tx();
    return cleanFamily;
  },

  async updateSamagraMemberStatus(
    familyId: string,
    memberId: string,
    updates: { ekycStatus?: boolean; dbtActive?: boolean }
  ): Promise<SamagraFamily | null> {
    await ensureInitialized();
    const family = await this.getSamagraFamily(familyId);
    if (!family) return null;

    const cleanMemberId = memberId.trim();
    const targetMember = family.members.find(m => String(m.memberId).trim() === cleanMemberId);
    if (!targetMember) return null;

    const nextEkyc = updates.ekycStatus !== undefined ? Boolean(updates.ekycStatus) : targetMember.ekycStatus;
    const nextDbt = updates.dbtActive !== undefined ? Boolean(updates.dbtActive) : targetMember.dbtActive;

    const nextMembers = family.members.map(m =>
      String(m.memberId).trim() === cleanMemberId
        ? { ...m, ekycStatus: nextEkyc, dbtActive: nextDbt }
        : m
    );
    const membersJson = JSON.stringify(nextMembers);

    if (pgPool) {
      await pgPool.query(
        'UPDATE samagra_members SET ekyc_status = $1, dbt_active = $2 WHERE family_id = $3 AND member_id = $4',
        [nextEkyc ? 1 : 0, nextDbt ? 1 : 0, family.familyId, cleanMemberId]
      );
      await pgPool.query('UPDATE samagra_families SET members_json = $1 WHERE family_id = $2', [
        membersJson,
        family.familyId,
      ]);
    } else {
      sqliteDb!
        .prepare(
          'UPDATE samagra_members SET ekyc_status = ?, dbt_active = ? WHERE family_id = ? AND member_id = ?'
        )
        .run(nextEkyc ? 1 : 0, nextDbt ? 1 : 0, family.familyId, cleanMemberId);
      sqliteDb!
        .prepare('UPDATE samagra_families SET members_json = ? WHERE family_id = ?')
        .run(membersJson, family.familyId);
    }

    return this.getSamagraFamily(family.familyId);
  },

  // ---------- DigiLocker Wallet ----------
  async getDigiLockerDocuments(citizenKey: string): Promise<DigiLockerDocumentRecord[]> {
    await ensureInitialized();
    const cleanKey = citizenKey.trim();
    if (!cleanKey) return [];

    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM digilocker_documents WHERE citizen_key = $1 ORDER BY verified_at DESC',
        [cleanKey]
      );
      return res.rows.map(rowToDigiLockerDoc);
    }

    const rows = sqliteDb!
      .prepare('SELECT * FROM digilocker_documents WHERE citizen_key = ? ORDER BY verified_at DESC')
      .all(cleanKey) as any[];
    return rows.map(rowToDigiLockerDoc);
  },

  async upsertDigiLockerDocument(doc: DigiLockerDocumentRecord): Promise<DigiLockerDocumentRecord> {
    await ensureInitialized();
    const clean: DigiLockerDocumentRecord = {
      citizenKey: doc.citizenKey.trim(),
      docId: doc.docId.trim(),
      docNumber: doc.docNumber.trim(),
      source: doc.source === 'mp_edistrict' || doc.source === 'manual' ? doc.source : 'digilocker',
      issuer: doc.issuer.trim() || 'DigiLocker India',
      verified: Boolean(doc.verified),
      verifiedAt: doc.verifiedAt || new Date().toISOString(),
    };

    const params = [
      clean.citizenKey,
      clean.docId,
      clean.docNumber,
      clean.source,
      clean.issuer,
      clean.verified ? 1 : 0,
      clean.verifiedAt,
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO digilocker_documents (
          citizen_key, doc_id, doc_number, source, issuer, verified, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (citizen_key, doc_id) DO UPDATE SET
          doc_number = EXCLUDED.doc_number,
          source = EXCLUDED.source,
          issuer = EXCLUDED.issuer,
          verified = EXCLUDED.verified,
          verified_at = EXCLUDED.verified_at
        `,
        params
      );
    } else {
      sqliteDb!
        .prepare(`
          INSERT OR REPLACE INTO digilocker_documents (
            citizen_key, doc_id, doc_number, source, issuer, verified, verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(...params);
    }

    return clean;
  },

  async deleteDigiLockerDocument(citizenKey: string, docId: string): Promise<boolean> {
    await ensureInitialized();
    const cleanKey = citizenKey.trim();
    const cleanDoc = docId.trim();
    if (pgPool) {
      const res = await pgPool.query(
        'DELETE FROM digilocker_documents WHERE citizen_key = $1 AND doc_id = $2',
        [cleanKey, cleanDoc]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const info = sqliteDb!
      .prepare('DELETE FROM digilocker_documents WHERE citizen_key = ? AND doc_id = ?')
      .run(cleanKey, cleanDoc);
    return info.changes > 0;
  },

  // ---------- Official DigiLocker OAuth Credentials ----------
  async getDigiLockerCredentials(citizenId: string): Promise<DigiLockerCredentialRecord[]> {
    await ensureInitialized();
    const cleanId = citizenId.trim();
    if (!cleanId) return [];

    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM digilocker_credentials WHERE citizen_id = $1 ORDER BY verified_at DESC',
        [cleanId]
      );
      return res.rows.map(rowToDigiLockerCredential);
    }

    const rows = sqliteDb!
      .prepare('SELECT * FROM digilocker_credentials WHERE citizen_id = ? ORDER BY verified_at DESC')
      .all(cleanId) as any[];
    return rows.map(rowToDigiLockerCredential);
  },

  async upsertDigiLockerCredential(
    cred: DigiLockerCredentialRecord
  ): Promise<DigiLockerCredentialRecord> {
    await ensureInitialized();
    const clean: DigiLockerCredentialRecord = {
      id: cred.id.trim(),
      citizenId: cred.citizenId.trim(),
      docId: cred.docId?.trim() || undefined,
      docUri: cred.docUri.trim(),
      docName: cred.docName.trim(),
      docNumber: cred.docNumber?.trim() || undefined,
      issuer: cred.issuer.trim() || 'DigiLocker India',
      mimeType: cred.mimeType?.trim() || undefined,
      verified: Boolean(cred.verified),
      issuedAt: cred.issuedAt?.trim() || undefined,
      verifiedAt: cred.verifiedAt || new Date().toISOString(),
    };

    const params = [
      clean.id,
      clean.citizenId,
      clean.docId || null,
      clean.docUri,
      clean.docName,
      clean.docNumber || null,
      clean.issuer,
      clean.mimeType || null,
      clean.verified ? 1 : 0,
      clean.issuedAt || null,
      clean.verifiedAt,
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO digilocker_credentials (
          id, citizen_id, doc_id, doc_uri, doc_name, doc_number,
          issuer, mime_type, verified, issued_at, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (citizen_id, doc_uri) DO UPDATE SET
          doc_id = COALESCE(EXCLUDED.doc_id, digilocker_credentials.doc_id),
          doc_name = EXCLUDED.doc_name,
          doc_number = EXCLUDED.doc_number,
          issuer = EXCLUDED.issuer,
          mime_type = EXCLUDED.mime_type,
          verified = EXCLUDED.verified,
          issued_at = COALESCE(EXCLUDED.issued_at, digilocker_credentials.issued_at),
          verified_at = EXCLUDED.verified_at
        `,
        params
      );
    } else {
      sqliteDb!
        .prepare(`
          INSERT INTO digilocker_credentials (
            id, citizen_id, doc_id, doc_uri, doc_name, doc_number,
            issuer, mime_type, verified, issued_at, verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(citizen_id, doc_uri) DO UPDATE SET
            doc_id = COALESCE(excluded.doc_id, digilocker_credentials.doc_id),
            doc_name = excluded.doc_name,
            doc_number = excluded.doc_number,
            issuer = excluded.issuer,
            mime_type = excluded.mime_type,
            verified = excluded.verified,
            issued_at = COALESCE(excluded.issued_at, digilocker_credentials.issued_at),
            verified_at = excluded.verified_at
        `)
        .run(...params);
    }

    return clean;
  },

  async insertDigiLockerCredentialStrict(
    cred: DigiLockerCredentialRecord
  ): Promise<DigiLockerCredentialRecord> {
    await ensureInitialized();
    const clean: DigiLockerCredentialRecord = {
      id: cred.id.trim(),
      citizenId: cred.citizenId.trim(),
      docId: cred.docId?.trim() || undefined,
      docUri: cred.docUri.trim(),
      docName: cred.docName.trim(),
      docNumber: cred.docNumber?.trim() || undefined,
      issuer: cred.issuer.trim() || 'DigiLocker India',
      mimeType: cred.mimeType?.trim() || undefined,
      verified: Boolean(cred.verified),
      issuedAt: cred.issuedAt?.trim() || undefined,
      verifiedAt: cred.verifiedAt || new Date().toISOString(),
    };
    const params = [
      clean.id,
      clean.citizenId,
      clean.docId || null,
      clean.docUri,
      clean.docName,
      clean.docNumber || null,
      clean.issuer,
      clean.mimeType || null,
      clean.verified ? 1 : 0,
      clean.issuedAt || null,
      clean.verifiedAt,
    ];
    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO digilocker_credentials (
          id, citizen_id, doc_id, doc_uri, doc_name, doc_number,
          issuer, mime_type, verified, issued_at, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        params
      );
    } else {
      sqliteDb!
        .prepare(`
          INSERT INTO digilocker_credentials (
            id, citizen_id, doc_id, doc_uri, doc_name, doc_number,
            issuer, mime_type, verified, issued_at, verified_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(...params);
    }
    return clean;
  },

  async deleteDigiLockerCredential(citizenId: string, idOrUri: string): Promise<boolean> {
    await ensureInitialized();
    const cleanCitizen = citizenId.trim();
    const target = idOrUri.trim();
    if (pgPool) {
      const res = await pgPool.query(
        'DELETE FROM digilocker_credentials WHERE citizen_id = $1 AND (id = $2 OR doc_uri = $2 OR doc_id = $2)',
        [cleanCitizen, target]
      );
      return (res.rowCount ?? 0) > 0;
    }
    const info = sqliteDb!
      .prepare(
        'DELETE FROM digilocker_credentials WHERE citizen_id = ? AND (id = ? OR doc_uri = ? OR doc_id = ?)'
      )
      .run(cleanCitizen, target, target, target);
    return info.changes > 0;
  },

  // ---------- OAuth 2.0 PKCE State Store ----------
  async saveOAuthPkceState(rec: {
    state: string;
    codeVerifier: string;
    citizenKey: string;
    redirectUri: string;
    expiresAt: string;
  }): Promise<void> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    if (pgPool) {
      await pgPool.query('DELETE FROM oauth_pkce_states WHERE expires_at < $1', [nowIso]);
      await pgPool.query(
        `
        INSERT INTO oauth_pkce_states (state, code_verifier, citizen_key, redirect_uri, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [rec.state, rec.codeVerifier, rec.citizenKey, rec.redirectUri, rec.expiresAt, nowIso]
      );
      return;
    }
    sqliteDb!.prepare('DELETE FROM oauth_pkce_states WHERE expires_at < ?').run(nowIso);
    sqliteDb!
      .prepare(
        `INSERT INTO oauth_pkce_states (state, code_verifier, citizen_key, redirect_uri, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(rec.state, rec.codeVerifier, rec.citizenKey, rec.redirectUri, rec.expiresAt, nowIso);
  },

  async consumeOAuthPkceState(state: string): Promise<OAuthPkceStateRecord | null> {
    await ensureInitialized();
    const cleanState = state.trim();
    if (!cleanState) return null;

    if (pgPool) {
      const res = await pgPool.query(
        'DELETE FROM oauth_pkce_states WHERE state = $1 RETURNING *',
        [cleanState]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        state: r.state,
        codeVerifier: r.code_verifier,
        citizenKey: r.citizen_key,
        redirectUri: r.redirect_uri,
        expiresAt: toIsoString(r.expires_at) || '',
        createdAt: toIsoString(r.created_at) || '',
      };
    }

    const row = sqliteDb!
      .prepare('SELECT * FROM oauth_pkce_states WHERE state = ? LIMIT 1')
      .get(cleanState) as any;
    if (!row) return null;
    sqliteDb!.prepare('DELETE FROM oauth_pkce_states WHERE state = ?').run(cleanState);
    return {
      state: row.state,
      codeVerifier: row.code_verifier,
      citizenKey: row.citizen_key,
      redirectUri: row.redirect_uri,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  },

  // ---------- Mobile OTP Verifications ----------
  async createOtpVerification(rec: {
    id: string;
    mobileNumber: string;
    otpHash: string;
    expiresAt: string;
  }): Promise<OtpVerificationRecord> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    if (pgPool) {
      await pgPool.query(
        `INSERT INTO otp_verifications (id, mobile_number, otp_hash, expires_at, attempts, created_at)
         VALUES ($1, $2, $3, $4, 0, $5)`,
        [rec.id, rec.mobileNumber, rec.otpHash, rec.expiresAt, nowIso]
      );
    } else {
      sqliteDb!
        .prepare(
          `INSERT INTO otp_verifications (id, mobile_number, otp_hash, expires_at, attempts, created_at)
           VALUES (?, ?, ?, ?, 0, ?)`
        )
        .run(rec.id, rec.mobileNumber, rec.otpHash, rec.expiresAt, nowIso);
    }
    return {
      id: rec.id,
      mobileNumber: rec.mobileNumber,
      otpHash: rec.otpHash,
      expiresAt: rec.expiresAt,
      attempts: 0,
      createdAt: nowIso,
    };
  },

  async getLatestOtpVerification(mobileNumber: string): Promise<OtpVerificationRecord | null> {
    await ensureInitialized();
    const clean = mobileNumber.trim();
    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM otp_verifications WHERE mobile_number = $1 ORDER BY created_at DESC LIMIT 1',
        [clean]
      );
      if (res.rows.length === 0) return null;
      const r = res.rows[0];
      return {
        id: r.id,
        mobileNumber: r.mobile_number,
        otpHash: r.otp_hash,
        expiresAt: toIsoString(r.expires_at) || '',
        attempts: Number(r.attempts) || 0,
        createdAt: toIsoString(r.created_at) || '',
      };
    }

    const row = sqliteDb!
      .prepare(
        'SELECT * FROM otp_verifications WHERE mobile_number = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(clean) as any;
    if (!row) return null;
    return {
      id: row.id,
      mobileNumber: row.mobile_number,
      otpHash: row.otp_hash,
      expiresAt: row.expires_at,
      attempts: Number(row.attempts) || 0,
      createdAt: row.created_at,
    };
  },

  async countRecentOtpRequests(mobileNumber: string, sinceIso: string): Promise<number> {
    await ensureInitialized();
    const clean = mobileNumber.trim();
    if (pgPool) {
      const res = await pgPool.query(
        'SELECT count(*) AS count FROM otp_verifications WHERE mobile_number = $1 AND created_at >= $2',
        [clean, sinceIso]
      );
      return Number(res.rows[0]?.count) || 0;
    }
    const row = sqliteDb!
      .prepare(
        'SELECT count(*) AS count FROM otp_verifications WHERE mobile_number = ? AND created_at >= ?'
      )
      .get(clean, sinceIso) as any;
    return Number(row?.count) || 0;
  },

  async incrementOtpAttempts(id: string): Promise<number> {
    await ensureInitialized();
    if (pgPool) {
      const res = await pgPool.query(
        'UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts',
        [id]
      );
      return Number(res.rows[0]?.attempts) || 0;
    }
    sqliteDb!.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').run(id);
    const row = sqliteDb!
      .prepare('SELECT attempts FROM otp_verifications WHERE id = ?')
      .get(id) as any;
    return Number(row?.attempts) || 0;
  },

  async deleteOtpVerificationsForMobile(mobileNumber: string): Promise<void> {
    await ensureInitialized();
    const clean = mobileNumber.trim();
    if (pgPool) {
      await pgPool.query('DELETE FROM otp_verifications WHERE mobile_number = $1', [clean]);
      return;
    }
    sqliteDb!.prepare('DELETE FROM otp_verifications WHERE mobile_number = ?').run(clean);
  },

  async markCitizenMobileVerified(mobileNumber: string, citizenUid?: string): Promise<void> {
    await ensureInitialized();
    const cleanMobile = mobileNumber.trim();
    const nowIso = new Date().toISOString();
    if (pgPool) {
      if (citizenUid) {
        await pgPool.query(
          'UPDATE citizen_accounts SET mobile_number = $1, phone = $1, mobile_verified = 1, updated_at = $2 WHERE id = $3',
          [cleanMobile, nowIso, citizenUid]
        );
      } else {
        await pgPool.query(
          'UPDATE citizen_accounts SET mobile_verified = 1, updated_at = $1 WHERE mobile_number = $2',
          [nowIso, cleanMobile]
        );
      }
      return;
    }
    if (citizenUid) {
      sqliteDb!
        .prepare(
          'UPDATE citizen_accounts SET mobile_number = ?, phone = ?, mobile_verified = 1, updated_at = ? WHERE id = ?'
        )
        .run(cleanMobile, cleanMobile, nowIso, citizenUid);
    } else {
      sqliteDb!
        .prepare(
          'UPDATE citizen_accounts SET mobile_verified = 1, updated_at = ? WHERE mobile_number = ?'
        )
        .run(nowIso, cleanMobile);
    }
  },

  // ---------- Notifications ----------
  async getNotifications(limit: number = 30): Promise<LiveNotification[]> {
    await ensureInitialized();
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 30;

    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM admin_broadcasts ORDER BY seq_id DESC LIMIT $1',
        [safeLimit]
      );
      return res.rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        type: r.type,
        message: r.message,
        messageHindi: r.message_hindi,
        wardOrBlock: r.ward_or_block,
        amount: r.amount ? Number(r.amount) : undefined,
        arn: r.arn || undefined,
      }));
    }

    const rows = sqliteDb!
      .prepare('SELECT * FROM admin_broadcasts ORDER BY rowid DESC LIMIT ?')
      .all(safeLimit) as any[];
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      message: r.message,
      messageHindi: r.message_hindi,
      wardOrBlock: r.ward_or_block,
      amount: r.amount ? Number(r.amount) : undefined,
      arn: r.arn || undefined,
    }));
  },

  async insertNotification(notif: LiveNotification): Promise<boolean> {
    await ensureInitialized();
    const params = [
      notif.id,
      notif.timestamp,
      notif.type,
      notif.message,
      notif.messageHindi,
      notif.wardOrBlock,
      notif.amount || null,
      notif.arn || null,
      new Date().toISOString(),
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO admin_broadcasts (
          id, timestamp, type, message, message_hindi, ward_or_block, amount, arn, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO NOTHING
        `,
        params
      );
      return true;
    }

    sqliteDb!
      .prepare(`
        INSERT INTO admin_broadcasts (
          id, timestamp, type, message, message_hindi, ward_or_block, amount, arn, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(...params);
    return true;
  },

  // ---------- Citizen Email/Password Accounts ----------
  async getCitizenAccountByEmail(email: string): Promise<CitizenAccountWithSecret | null> {
    await ensureInitialized();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM citizen_accounts WHERE lower(email) = $1 LIMIT 1',
        [cleanEmail]
      );
      if (res.rows.length === 0) return null;
      return rowToCitizenAccount(res.rows[0]);
    }

    const row = sqliteDb!
      .prepare('SELECT * FROM citizen_accounts WHERE lower(email) = ? LIMIT 1')
      .get(cleanEmail) as any;
    if (!row) return null;
    return rowToCitizenAccount(row);
  },

  async getCitizenAccountById(id: string): Promise<CitizenAccountProfile | null> {
    await ensureInitialized();
    const cleanId = id.trim();
    if (!cleanId) return null;

    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM citizen_accounts WHERE id = $1 LIMIT 1', [
        cleanId,
      ]);
      if (res.rows.length === 0) return null;
      return sanitizeCitizenAccount(rowToCitizenAccount(res.rows[0]));
    }

    const row = sqliteDb!
      .prepare('SELECT * FROM citizen_accounts WHERE id = ? LIMIT 1')
      .get(cleanId) as any;
    if (!row) return null;
    return sanitizeCitizenAccount(rowToCitizenAccount(row));
  },

  async getCitizenAccountByMobile(mobileNumber: string): Promise<CitizenAccountProfile | null> {
    await ensureInitialized();
    const cleanMobile = mobileNumber.trim();
    if (!cleanMobile) return null;
    if (pgPool) {
      const res = await pgPool.query(
        'SELECT * FROM citizen_accounts WHERE mobile_number = $1 LIMIT 1',
        [cleanMobile]
      );
      if (res.rows.length === 0) return null;
      return sanitizeCitizenAccount(rowToCitizenAccount(res.rows[0]));
    }
    const row = sqliteDb!
      .prepare('SELECT * FROM citizen_accounts WHERE mobile_number = ? LIMIT 1')
      .get(cleanMobile) as any;
    if (!row) return null;
    return sanitizeCitizenAccount(rowToCitizenAccount(row));
  },

  async createCitizenAccount(input: CreateCitizenAccountInput): Promise<CitizenAccountProfile> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanFamilyId = input.samagraFamilyId?.trim() || null;
    const cleanMemberId = input.samagraMemberId?.trim() || null;
    const cleanSamagraId = input.samagraId?.trim() || cleanMemberId || cleanFamilyId || null;
    const cleanMobile = input.mobileNumber?.trim() || null;
    const cleanPhone = input.phone?.trim() || cleanMobile || null;
    const mobileVerifiedInt = cleanMobile && input.mobileVerified ? 1 : 0;

    const params = [
      input.id,
      cleanEmail,
      input.passwordHash,
      input.displayName.trim() || 'Citizen of Indore',
      cleanPhone,
      cleanMobile,
      mobileVerifiedInt,
      'citizen',
      cleanSamagraId,
      cleanFamilyId,
      cleanMemberId,
      input.areaType === 'rural' ? 'rural' : 'urban',
      input.areaType === 'urban' ? input.wardNumber ?? 72 : null,
      input.areaType === 'rural' ? input.blockName ?? 'Indore' : null,
      input.category || 'GEN',
      Number.isFinite(input.age) ? input.age : 30,
      input.gender || 'female',
      Number.isFinite(input.annualIncome) ? input.annualIncome : 150000,
      input.occupation || 'Other',
      input.isBPL ? 1 : 0,
      input.hasDisability ? 1 : 0,
      input.maritalStatus || 'Married',
      input.isMpDomicile ? 1 : 0,
      input.isIndoreResident ? 1 : 0,
      input.ekycVerified ? 1 : 0,
      nowIso,
      nowIso,
      nowIso,
    ];

    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO citizen_accounts (
          id, email, password_hash, display_name, phone, mobile_number, mobile_verified, role,
          samagra_id, samagra_family_id, samagra_member_id, area_type, ward_number, block_name,
          category, age, gender, annual_income, occupation,
          is_bpl, has_disability, marital_status, is_mp_domicile, is_indore_resident,
          ekyc_verified, created_at, updated_at, last_login_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27, $28
        )
        `,
        params
      );
    } else {
      sqliteDb!
        .prepare(`
          INSERT INTO citizen_accounts (
            id, email, password_hash, display_name, phone, mobile_number, mobile_verified, role,
            samagra_id, samagra_family_id, samagra_member_id, area_type, ward_number, block_name,
            category, age, gender, annual_income, occupation,
            is_bpl, has_disability, marital_status, is_mp_domicile, is_indore_resident,
            ekyc_verified, created_at, updated_at, last_login_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?
          )
        `)
        .run(...params);
    }

    return (await this.getCitizenAccountById(input.id))!;
  },

  async updateCitizenLastLogin(id: string): Promise<void> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    if (pgPool) {
      await pgPool.query('UPDATE citizen_accounts SET last_login_at = $1 WHERE id = $2', [
        nowIso,
        id,
      ]);
    } else {
      sqliteDb!
        .prepare('UPDATE citizen_accounts SET last_login_at = ? WHERE id = ?')
        .run(nowIso, id);
    }
  },

  async updateCitizenAccountProfile(
    id: string,
    updates: Partial<Omit<CitizenAccountProfile, 'uid' | 'email' | 'role' | 'authMethod' | 'createdAt'>>
  ): Promise<CitizenAccountProfile | null> {
    await ensureInitialized();
    const existing = await this.getCitizenAccountById(id);
    if (!existing) return null;

    const areaType: AreaType =
      updates.areaType === 'rural' || updates.areaType === 'urban'
        ? updates.areaType
        : existing.areaType;
    const nowIso = new Date().toISOString();

    const nextFamilyId =
      updates.samagraFamilyId !== undefined
        ? updates.samagraFamilyId?.trim() || null
        : existing.samagraFamilyId ?? null;
    const nextMemberId =
      updates.samagraMemberId !== undefined
        ? updates.samagraMemberId?.trim() || null
        : existing.samagraMemberId ?? null;
    const nextSamagraId =
      updates.samagraId !== undefined
        ? updates.samagraId?.trim() || null
        : nextMemberId || nextFamilyId || existing.samagraId || null;

    const nextMobileNumber =
      updates.mobileNumber !== undefined
        ? updates.mobileNumber?.trim() || null
        : existing.mobileNumber ?? null;
    const nextMobileVerified =
      updates.mobileVerified !== undefined
        ? updates.mobileVerified
          ? 1
          : 0
        : existing.mobileVerified
        ? 1
        : 0;

    const merged = {
      displayName: updates.displayName?.trim() || existing.displayName,
      phone:
        updates.phone !== undefined
          ? updates.phone?.trim() || nextMobileNumber
          : nextMobileNumber ?? existing.phone ?? null,
      mobileNumber: nextMobileNumber,
      mobileVerified: nextMobileVerified,
      samagraId: nextSamagraId,
      samagraFamilyId: nextFamilyId,
      samagraMemberId: nextMemberId,
      areaType,
      wardNumber:
        areaType === 'urban'
          ? updates.wardNumber ?? existing.wardNumber ?? 72
          : null,
      blockName:
        areaType === 'rural'
          ? updates.blockName ?? existing.blockName ?? 'Indore'
          : null,
      category: updates.category ?? existing.category,
      age: updates.age ?? existing.age,
      gender: updates.gender ?? existing.gender,
      annualIncome: updates.annualIncome ?? existing.annualIncome,
      occupation: updates.occupation ?? existing.occupation,
      isBPL: updates.isBPL !== undefined ? (updates.isBPL ? 1 : 0) : existing.isBPL ? 1 : 0,
      hasDisability:
        updates.hasDisability !== undefined
          ? updates.hasDisability
            ? 1
            : 0
          : existing.hasDisability
          ? 1
          : 0,
      maritalStatus: updates.maritalStatus ?? existing.maritalStatus,
      isMpDomicile:
        updates.isMpDomicile !== undefined
          ? updates.isMpDomicile
            ? 1
            : 0
          : existing.isMpDomicile
          ? 1
          : 0,
      isIndoreResident:
        updates.isIndoreResident !== undefined
          ? updates.isIndoreResident
            ? 1
            : 0
          : existing.isIndoreResident
          ? 1
          : 0,
      ekycVerified:
        updates.ekycVerified !== undefined
          ? updates.ekycVerified
            ? 1
            : 0
          : existing.ekycVerified
          ? 1
          : 0,
      updatedAt: nowIso,
    };

    const params = [
      merged.displayName,
      merged.phone,
      merged.mobileNumber,
      merged.mobileVerified,
      merged.samagraId,
      merged.samagraFamilyId,
      merged.samagraMemberId,
      merged.areaType,
      merged.wardNumber,
      merged.blockName,
      merged.category,
      merged.age,
      merged.gender,
      merged.annualIncome,
      merged.occupation,
      merged.isBPL,
      merged.hasDisability,
      merged.maritalStatus,
      merged.isMpDomicile,
      merged.isIndoreResident,
      merged.ekycVerified,
      merged.updatedAt,
      id,
    ];

    if (pgPool) {
      await pgPool.query(
        `
        UPDATE citizen_accounts SET
          display_name = $1,
          phone = $2,
          mobile_number = $3,
          mobile_verified = $4,
          samagra_id = $5,
          samagra_family_id = $6,
          samagra_member_id = $7,
          area_type = $8,
          ward_number = $9,
          block_name = $10,
          category = $11,
          age = $12,
          gender = $13,
          annual_income = $14,
          occupation = $15,
          is_bpl = $16,
          has_disability = $17,
          marital_status = $18,
          is_mp_domicile = $19,
          is_indore_resident = $20,
          ekyc_verified = $21,
          updated_at = $22
        WHERE id = $23
        `,
        params
      );
    } else {
      sqliteDb!
        .prepare(`
          UPDATE citizen_accounts SET
            display_name = ?,
            phone = ?,
            mobile_number = ?,
            mobile_verified = ?,
            samagra_id = ?,
            samagra_family_id = ?,
            samagra_member_id = ?,
            area_type = ?,
            ward_number = ?,
            block_name = ?,
            category = ?,
            age = ?,
            gender = ?,
            annual_income = ?,
            occupation = ?,
            is_bpl = ?,
            has_disability = ?,
            marital_status = ?,
            is_mp_domicile = ?,
            is_indore_resident = ?,
            ekyc_verified = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(...params);
    }

    return this.getCitizenAccountById(id);
  },

  // ---------- Citizen Saved Schemes (PostgreSQL / SQLite for Email Accounts) ----------
  async getCitizenSavedSchemes(
    citizenId: string
  ): Promise<Array<{ schemeId: string; schemeTitle: string; savedAt: string }>> {
    await ensureInitialized();
    if (pgPool) {
      const res = await pgPool.query(
        'SELECT scheme_id, scheme_title, saved_at FROM citizen_saved_schemes WHERE citizen_id = $1 ORDER BY saved_at DESC',
        [citizenId]
      );
      return res.rows.map(r => ({
        schemeId: r.scheme_id,
        schemeTitle: r.scheme_title,
        savedAt: toIsoString(r.saved_at) || new Date().toISOString(),
      }));
    }

    const rows = sqliteDb!
      .prepare(
        'SELECT scheme_id, scheme_title, saved_at FROM citizen_saved_schemes WHERE citizen_id = ? ORDER BY saved_at DESC'
      )
      .all(citizenId) as any[];
    return rows.map(r => ({
      schemeId: r.scheme_id,
      schemeTitle: r.scheme_title,
      savedAt: r.saved_at,
    }));
  },

  async saveCitizenScheme(
    citizenId: string,
    schemeId: string,
    schemeTitle: string
  ): Promise<void> {
    await ensureInitialized();
    const nowIso = new Date().toISOString();
    if (pgPool) {
      await pgPool.query(
        `
        INSERT INTO citizen_saved_schemes (citizen_id, scheme_id, scheme_title, saved_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (citizen_id, scheme_id) DO UPDATE SET
          scheme_title = EXCLUDED.scheme_title,
          saved_at = EXCLUDED.saved_at
        `,
        [citizenId, schemeId, schemeTitle, nowIso]
      );
      return;
    }

    sqliteDb!
      .prepare(
        `INSERT OR REPLACE INTO citizen_saved_schemes (citizen_id, scheme_id, scheme_title, saved_at) VALUES (?, ?, ?, ?)`
      )
      .run(citizenId, schemeId, schemeTitle, nowIso);
  },

  async removeCitizenSavedScheme(citizenId: string, schemeId: string): Promise<void> {
    await ensureInitialized();
    if (pgPool) {
      await pgPool.query(
        'DELETE FROM citizen_saved_schemes WHERE citizen_id = $1 AND scheme_id = $2',
        [citizenId, schemeId]
      );
      return;
    }
    sqliteDb!
      .prepare('DELETE FROM citizen_saved_schemes WHERE citizen_id = ? AND scheme_id = ?')
      .run(citizenId, schemeId);
  },

  // ---------- District Macro Statistics ----------
  async getDistrictStats(): Promise<DistrictStats> {
    await ensureInitialized();
    const families = await this.getAllSamagraFamilies();
    const registeredMembers = families.reduce((sum, f) => sum + f.members.length, 0);

    if (pgPool) {
      const [sRes, aRes, pRes, apRes, dRes, dbtRes, docRes, credRes] = await Promise.all([
        pgPool.query('SELECT count(*) AS count FROM schemes'),
        pgPool.query('SELECT count(*) AS count FROM applications'),
        pgPool.query(
          "SELECT count(*) AS count FROM applications WHERE current_status IN ('submitted', 'ward_verification', 'collectorate_scrutiny')"
        ),
        pgPool.query(
          "SELECT count(*) AS count FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')"
        ),
        pgPool.query("SELECT count(*) AS count FROM applications WHERE current_status = 'dbt_disbursed'"),
        pgPool.query(
          "SELECT coalesce(sum(sanction_amount), 0) AS total FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')"
        ),
        pgPool.query('SELECT count(*) AS count FROM digilocker_documents WHERE verified = 1'),
        pgPool.query('SELECT count(*) AS count FROM digilocker_credentials WHERE verified = 1'),
      ]);

      const schemeCount = Number(sRes.rows[0]?.count) || 0;
      const appCount = Number(aRes.rows[0]?.count) || 0;
      const pendingCount = Number(pRes.rows[0]?.count) || 0;
      const approvedCount = Number(apRes.rows[0]?.count) || 0;
      const disbursedCount = Number(dRes.rows[0]?.count) || 0;
      const dbtSumInr = Number(dbtRes.rows[0]?.total) || 0;
      const verifiedDocsCount =
        (Number(credRes.rows[0]?.count) || 0) + (Number(docRes.rows[0]?.count) || 0);

      return {
        totalSchemes: schemeCount,
        totalApplications: appCount,
        pendingApplications: pendingCount,
        approvedApplications: approvedCount,
        disbursedApplications: disbursedCount,
        totalDbtDisbursedInr: dbtSumInr,
        totalDbtDisbursedCr: Number((dbtSumInr / 10000000).toFixed(4)),
        registeredFamilies: families.length,
        registeredMembers,
        verifiedDocumentsCount: verifiedDocsCount,
        activeWards: IMC_WARDS.length,
        activeJanpadBlocks: JANPAD_BLOCKS.length,
        approvalRatePercent: appCount > 0 ? Math.round((approvedCount / appCount) * 100) : 0,
      };
    }

    const db = sqliteDb!;
    const schemeCount = Number((db.prepare('SELECT count(*) as count FROM schemes').get() as any).count) || 0;
    const appCount = Number((db.prepare('SELECT count(*) as count FROM applications').get() as any).count) || 0;
    const pendingCount =
      Number(
        (
          db
            .prepare(
              "SELECT count(*) as count FROM applications WHERE current_status IN ('submitted', 'ward_verification', 'collectorate_scrutiny')"
            )
            .get() as any
        ).count
      ) || 0;
    const approvedCount =
      Number(
        (
          db
            .prepare(
              "SELECT count(*) as count FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')"
            )
            .get() as any
        ).count
      ) || 0;
    const disbursedCount =
      Number(
        (
          db
            .prepare("SELECT count(*) as count FROM applications WHERE current_status = 'dbt_disbursed'")
            .get() as any
        ).count
      ) || 0;
    const dbtSumInr =
      Number(
        (
          db
            .prepare(
              "SELECT coalesce(sum(sanction_amount), 0) as total FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')"
            )
            .get() as any
        ).total
      ) || 0;
    const verifiedDocsCount =
      (Number(
        (db.prepare('SELECT count(*) as count FROM digilocker_credentials WHERE verified = 1').get() as any)
          .count
      ) || 0) +
      (Number(
        (db.prepare('SELECT count(*) as count FROM digilocker_documents WHERE verified = 1').get() as any).count
      ) || 0);

    return {
      totalSchemes: schemeCount,
      totalApplications: appCount,
      pendingApplications: pendingCount,
      approvedApplications: approvedCount,
      disbursedApplications: disbursedCount,
      totalDbtDisbursedInr: dbtSumInr,
      totalDbtDisbursedCr: Number((dbtSumInr / 10000000).toFixed(4)),
      registeredFamilies: families.length,
      registeredMembers,
      verifiedDocumentsCount: verifiedDocsCount,
      activeWards: IMC_WARDS.length,
      activeJanpadBlocks: JANPAD_BLOCKS.length,
      approvalRatePercent: appCount > 0 ? Math.round((approvedCount / appCount) * 100) : 0,
    };
  },

  async getWardAndBlockLiveStats() {
    const [apps, families] = await Promise.all([
      this.getApplications(),
      this.getAllSamagraFamilies(),
    ]);
    return {
      wards: aggregateWardLiveMetrics(apps, families, IMC_WARDS),
      blocks: aggregateJanpadLiveMetrics(apps, families, JANPAD_BLOCKS),
    };
  },
};
