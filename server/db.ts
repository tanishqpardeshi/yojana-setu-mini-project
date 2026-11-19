import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  Scheme,
  ApplicationRecord,
  LiveNotification,
  SamagraFamily,
  DistrictStats,
  DigiLockerDocumentRecord,
  PortalReachabilityStatus,
  SchemesRealtimeReport,
} from '../src/types/index.js';
import { SCHEMES_DATABASE } from '../src/data/schemesData.js';
import { IMC_WARDS, JANPAD_BLOCKS } from '../src/data/indoreGovernance.js';
import {
  aggregateJanpadLiveMetrics,
  aggregateWardLiveMetrics,
  evaluateSchemesRealtimeStatus,
  resolveSchemePortalUrl,
} from '../src/utils/liveDataEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory path
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'yojanasetu.db');
const db = new Database(dbPath);

// Enable WAL mode for concurrent performance
db.pragma('journal_mode = WAL');

// Initialize schema
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
`);

// Safe schema migration for existing SQLite databases created prior to real-time columns
function ensureSchemesRealtimeColumns() {
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
}

ensureSchemesRealtimeColumns();

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Helper to convert DB row to Scheme model
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
    cscAvailable: Boolean(row.csc_available),
    activeBudgetCr: row.active_budget_cr ? Number(row.active_budget_cr) : undefined,
    updatedAt: row.updated_at || undefined,
    dataOrigin: row.data_origin === 'admin_live' ? 'admin_live' : 'baseline_catalog',
    portalStatus: (row.portal_status as PortalReachabilityStatus) || 'unchecked',
    portalHttpStatus: row.portal_http_status !== null && row.portal_http_status !== undefined ? Number(row.portal_http_status) : null,
    portalCheckedAt: row.portal_checked_at || null,
    portalLatencyMs: row.portal_latency_ms !== null && row.portal_latency_ms !== undefined ? Number(row.portal_latency_ms) : null,
  };
  baseScheme.applyUrl = resolveSchemePortalUrl(baseScheme);
  return baseScheme;
}

// Helper to convert DB row to ApplicationRecord
function rowToApplication(row: any): ApplicationRecord {
  return {
    arn: row.arn,
    schemeId: row.scheme_id,
    schemeTitle: row.scheme_title,
    schemeTitleHindi: row.scheme_title_hindi,
    applicantName: row.applicant_name,
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

// Sync official scheme catalog baseline (without overwriting admin-edited schemes or portal check timestamps)
// and purge any legacy demo citizen/application/broadcast records from pre-existing SQLite files
function initializeLiveDatabase() {
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
    UPDATE schemes SET apply_url = ? WHERE id = ? AND (apply_url IS NULL OR trim(apply_url) = '')
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
    console.log(`[SQLite] Loaded ${insertedCount} baseline schemes into SQLite database.`);
  }

  // Purge legacy demo records from pre-existing SQLite files so only real user-created data exists
  const demoFamilyIds = ['48921840', '71203945', '39510482', '84019283'];
  const demoArns = ['YS-IND-2026-94812', 'YS-IND-2026-88319', 'YS-IND-2026-73190'];
  const demoNotifIds = ['notif-1', 'notif-2', 'notif-3', 'notif-4', 'notif-5'];

  const purgeDemo = db.transaction(() => {
    db.prepare(`DELETE FROM samagra_families WHERE family_id IN (${demoFamilyIds.map(() => '?').join(',')})`).run(...demoFamilyIds);
    db.prepare(`DELETE FROM applications WHERE arn IN (${demoArns.map(() => '?').join(',')})`).run(...demoArns);
    db.prepare(`DELETE FROM admin_broadcasts WHERE id IN (${demoNotifIds.map(() => '?').join(',')})`).run(...demoNotifIds);
    // Remove legacy interval-generated mock broadcasts
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
  });
  purgeDemo();
}

initializeLiveDatabase();

// ================= CRUD API OPERATIONS =================

export const dbService = {
  // Get all schemes or filtered
  getSchemes(filters?: { level?: string; search?: string }): Scheme[] {
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

  getSchemeById(id: string): Scheme | null {
    const row = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id);
    if (!row) return null;
    return rowToScheme(row);
  },

  insertScheme(scheme: Scheme, origin: 'baseline_catalog' | 'admin_live' = 'admin_live'): Scheme {
    const existing = this.getSchemeById(scheme.id);
    const portalUrl = resolveSchemePortalUrl(scheme);
    const nowIso = new Date().toISOString();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO schemes (
        id, code, title, title_hindi, title_malwi, governance_level, department,
        nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
        benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
        eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
        apply_url, csc_available, active_budget_cr, data_origin,
        portal_status, portal_http_status, portal_checked_at, portal_latency_ms, updated_at
      ) VALUES (
        @id, @code, @title, @titleHindi, @titleMalwi, @governanceLevel, @department,
        @nodalOfficeIndore, @helpline, @targetBeneficiary, @description, @descriptionHindi,
        @benefits, @benefitsHindi, @financialAmount, @financialFrequency, @financialDesc,
        @eligibilityRulesJson, @requiredDocumentsJson, @tagsJson, @malwiSynonymsJson,
        @applyUrl, @cscAvailable, @activeBudgetCr, @dataOrigin,
        @portalStatus, @portalHttpStatus, @portalCheckedAt, @portalLatencyMs, @updatedAt
      )
    `);

    stmt.run({
      id: scheme.id,
      code: scheme.code || scheme.id.toUpperCase(),
      title: scheme.title,
      titleHindi: scheme.titleHindi || scheme.title,
      titleMalwi: scheme.titleMalwi || scheme.titleHindi || scheme.title,
      governanceLevel: scheme.governanceLevel || 'district_indore',
      department: scheme.department || 'District Administration Indore',
      nodalOfficeIndore: scheme.nodalOfficeIndore || 'Collectorate Campus Indore',
      helpline: scheme.helpline || '181',
      targetBeneficiary: scheme.targetBeneficiary || 'Citizens of Indore',
      description: scheme.description || '',
      descriptionHindi: scheme.descriptionHindi || scheme.description || '',
      benefits: scheme.benefits || '',
      benefitsHindi: scheme.benefitsHindi || scheme.benefits || '',
      financialAmount: Number(scheme.financialEntitlement?.amount) || 0,
      financialFrequency: scheme.financialEntitlement?.frequency || 'One-Time',
      financialDesc: scheme.financialEntitlement?.description || '',
      eligibilityRulesJson: JSON.stringify(scheme.eligibilityRules || {}),
      requiredDocumentsJson: JSON.stringify(scheme.requiredDocuments || []),
      tagsJson: JSON.stringify(scheme.tags || []),
      malwiSynonymsJson: JSON.stringify(scheme.malwiSynonyms || []),
      applyUrl: portalUrl,
      cscAvailable: scheme.cscAvailable === false ? 0 : 1,
      activeBudgetCr: scheme.activeBudgetCr || null,
      dataOrigin: origin,
      portalStatus: existing?.portalStatus || 'unchecked',
      portalHttpStatus: existing?.portalHttpStatus ?? null,
      portalCheckedAt: existing?.portalCheckedAt ?? null,
      portalLatencyMs: existing?.portalLatencyMs ?? null,
      updatedAt: nowIso,
    });
    return this.getSchemeById(scheme.id)!;
  },

  updateSchemesPortalCheckByUrl(
    urlResults: Map<string, { status: PortalReachabilityStatus; httpStatus: number | null; latencyMs: number | null; checkedAt: string }>
  ): SchemesRealtimeReport {
    const schemes = this.getSchemes();
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

    return evaluateSchemesRealtimeStatus(this.getSchemes());
  },

  getSchemesRealtimeStatus(): SchemesRealtimeReport {
    return evaluateSchemesRealtimeStatus(this.getSchemes());
  },

  deleteScheme(id: string): boolean {
    const info = db.prepare('DELETE FROM schemes WHERE id = ?').run(id);
    return info.changes > 0;
  },

  // Applications
  getApplications(filters?: { arn?: string; samagraId?: string; status?: string }): ApplicationRecord[] {
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
    const rows = db.prepare(query).all(...params);
    return rows.map(rowToApplication);
  },

  getApplicationByArn(arn: string): ApplicationRecord | null {
    const row = db.prepare('SELECT * FROM applications WHERE upper(arn) = upper(?)').get(arn.trim());
    if (!row) return null;
    return rowToApplication(row);
  },

  insertApplication(app: ApplicationRecord): boolean {
    const stmt = db.prepare(`
      INSERT INTO applications (
        arn, scheme_id, scheme_title, scheme_title_hindi, applicant_name,
        samagra_member_id, samagra_family_id, phone, ward_or_block, area_type,
        applied_date, current_status, officer_in_charge, sanction_amount,
        kiosk_operator_code, remarks, timeline_json, created_at
      ) VALUES (
        @arn, @schemeId, @schemeTitle, @schemeTitleHindi, @applicantName,
        @samagraMemberId, @samagraFamilyId, @phone, @wardOrBlock, @areaType,
        @appliedDate, @currentStatus, @officerInCharge, @sanctionAmount,
        @kioskOperatorCode, @remarks, @timelineJson, @createdAt
      )
    `);

    stmt.run({
      arn: app.arn,
      schemeId: app.schemeId,
      schemeTitle: app.schemeTitle,
      schemeTitleHindi: app.schemeTitleHindi,
      applicantName: app.applicantName,
      samagraMemberId: app.samagraMemberId,
      samagraFamilyId: app.samagraFamilyId,
      phone: app.phone,
      wardOrBlock: app.wardOrBlock,
      areaType: app.areaType,
      appliedDate: app.appliedDate,
      currentStatus: app.currentStatus,
      officerInCharge: app.officerInCharge,
      sanctionAmount: app.sanctionAmount || 0,
      kioskOperatorCode: null,
      remarks: app.remarks || '',
      timelineJson: JSON.stringify(app.timeline),
      createdAt: new Date().toISOString(),
    });
    return true;
  },

  updateApplicationStatus(arn: string, status: ApplicationRecord['currentStatus'], remarks?: string): ApplicationRecord | null {
    const existing = this.getApplicationByArn(arn);
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
            date: step.date === 'Pending' || step.date.startsWith('In Progress') ? nowDisplay : step.date,
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

    const stmt = db.prepare(`
      UPDATE applications
      SET current_status = ?, remarks = ?, timeline_json = ?
      WHERE upper(arn) = upper(?)
    `);

    stmt.run(status, remarks || existing.remarks, JSON.stringify(timeline), arn.trim());
    return this.getApplicationByArn(arn);
  },

  // Samagra Families
  getAllSamagraFamilies(): SamagraFamily[] {
    const rows = db.prepare('SELECT * FROM samagra_families ORDER BY created_at DESC').all() as any[];
    return rows.map(r => ({
      familyId: r.family_id,
      headName: r.head_name,
      areaType: r.area_type,
      wardOrBlock: r.ward_or_block,
      address: r.address,
      rationCardType: r.ration_card_type,
      members: safeJsonParse<SamagraFamily['members']>(r.members_json, []),
      createdAt: r.created_at,
    }));
  },

  getSamagraFamily(familyId: string): SamagraFamily | null {
    const cleanId = familyId.trim();
    if (!cleanId) return null;

    const row = db.prepare('SELECT * FROM samagra_families WHERE family_id = ?').get(cleanId) as any;
    if (!row) {
      const allRows = db.prepare('SELECT * FROM samagra_families').all() as any[];
      for (const r of allRows) {
        const members = safeJsonParse<SamagraFamily['members']>(r.members_json, []);
        if (members.some(m => String(m.memberId).trim() === cleanId)) {
          return {
            familyId: r.family_id,
            headName: r.head_name,
            areaType: r.area_type,
            wardOrBlock: r.ward_or_block,
            address: r.address,
            rationCardType: r.ration_card_type,
            members,
            createdAt: r.created_at,
          };
        }
      }
      return null;
    }

    return {
      familyId: row.family_id,
      headName: row.head_name,
      areaType: row.area_type,
      wardOrBlock: row.ward_or_block,
      address: row.address,
      rationCardType: row.ration_card_type,
      members: safeJsonParse<SamagraFamily['members']>(row.members_json, []),
      createdAt: row.created_at,
    };
  },

  registerSamagraFamily(family: SamagraFamily): SamagraFamily {
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
      createdAt: new Date().toISOString(),
    };

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO samagra_families (
        family_id, head_name, area_type, ward_or_block, address,
        ration_card_type, members_json, created_at
      ) VALUES (
        @familyId, @headName, @areaType, @wardOrBlock, @address,
        @rationCardType, @membersJson, @createdAt
      )
    `);

    stmt.run({
      familyId: cleanFamily.familyId,
      headName: cleanFamily.headName,
      areaType: cleanFamily.areaType,
      wardOrBlock: cleanFamily.wardOrBlock,
      address: cleanFamily.address,
      rationCardType: cleanFamily.rationCardType,
      membersJson: JSON.stringify(cleanFamily.members),
      createdAt: cleanFamily.createdAt,
    });

    return cleanFamily;
  },

  updateSamagraMemberStatus(
    familyId: string,
    memberId: string,
    updates: { ekycStatus?: boolean; dbtActive?: boolean }
  ): SamagraFamily | null {
    const family = this.getSamagraFamily(familyId);
    if (!family) return null;

    let found = false;
    const nextMembers = family.members.map(m => {
      if (String(m.memberId).trim() === memberId.trim()) {
        found = true;
        return {
          ...m,
          ekycStatus: updates.ekycStatus !== undefined ? Boolean(updates.ekycStatus) : m.ekycStatus,
          dbtActive: updates.dbtActive !== undefined ? Boolean(updates.dbtActive) : m.dbtActive,
        };
      }
      return m;
    });

    if (!found) return null;

    db.prepare('UPDATE samagra_families SET members_json = ? WHERE family_id = ?').run(
      JSON.stringify(nextMembers),
      family.familyId
    );

    return this.getSamagraFamily(family.familyId);
  },

  // DigiLocker Wallet Persistence
  getDigiLockerDocuments(citizenKey: string): DigiLockerDocumentRecord[] {
    const cleanKey = citizenKey.trim();
    if (!cleanKey) return [];
    const rows = db
      .prepare('SELECT * FROM digilocker_documents WHERE citizen_key = ? ORDER BY verified_at DESC')
      .all(cleanKey) as any[];
    return rows.map(r => ({
      citizenKey: r.citizen_key,
      docId: r.doc_id,
      docNumber: r.doc_number,
      source: r.source,
      issuer: r.issuer,
      verified: Boolean(r.verified),
      verifiedAt: r.verified_at,
    }));
  },

  upsertDigiLockerDocument(doc: DigiLockerDocumentRecord): DigiLockerDocumentRecord {
    const clean: DigiLockerDocumentRecord = {
      citizenKey: doc.citizenKey.trim(),
      docId: doc.docId.trim(),
      docNumber: doc.docNumber.trim(),
      source: doc.source === 'mp_edistrict' || doc.source === 'manual' ? doc.source : 'digilocker',
      issuer: doc.issuer.trim() || 'DigiLocker India',
      verified: Boolean(doc.verified),
      verifiedAt: doc.verifiedAt || new Date().toISOString(),
    };

    db.prepare(`
      INSERT OR REPLACE INTO digilocker_documents (
        citizen_key, doc_id, doc_number, source, issuer, verified, verified_at
      ) VALUES (
        @citizenKey, @docId, @docNumber, @source, @issuer, @verified, @verifiedAt
      )
    `).run({
      ...clean,
      verified: clean.verified ? 1 : 0,
    });

    return clean;
  },

  deleteDigiLockerDocument(citizenKey: string, docId: string): boolean {
    const info = db
      .prepare('DELETE FROM digilocker_documents WHERE citizen_key = ? AND doc_id = ?')
      .run(citizenKey.trim(), docId.trim());
    return info.changes > 0;
  },

  // Notifications
  getNotifications(limit: number = 30): LiveNotification[] {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(200, Math.floor(limit)) : 30;
    const rows = db.prepare('SELECT * FROM admin_broadcasts ORDER BY rowid DESC LIMIT ?').all(safeLimit) as any[];
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

  insertNotification(notif: LiveNotification): boolean {
    const stmt = db.prepare(`
      INSERT INTO admin_broadcasts (
        id, timestamp, type, message, message_hindi, ward_or_block, amount, arn, created_at
      ) VALUES (
        @id, @timestamp, @type, @message, @messageHindi, @wardOrBlock, @amount, @arn, @createdAt
      )
    `);

    stmt.run({
      id: notif.id,
      timestamp: notif.timestamp,
      type: notif.type,
      message: notif.message,
      messageHindi: notif.messageHindi,
      wardOrBlock: notif.wardOrBlock,
      amount: notif.amount || null,
      arn: notif.arn || null,
      createdAt: new Date().toISOString(),
    });
    return true;
  },

  // District Macro Statistics (100% real SQLite aggregates — zero fabricated offsets)
  getDistrictStats(): DistrictStats {
    const schemeCount = (db.prepare('SELECT count(*) as count FROM schemes').get() as any).count;
    const appCount = (db.prepare('SELECT count(*) as count FROM applications').get() as any).count;
    const pendingCount = (
      db
        .prepare("SELECT count(*) as count FROM applications WHERE current_status IN ('submitted', 'ward_verification', 'collectorate_scrutiny')")
        .get() as any
    ).count;
    const approvedCount = (
      db
        .prepare("SELECT count(*) as count FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')")
        .get() as any
    ).count;
    const disbursedCount = (
      db.prepare("SELECT count(*) as count FROM applications WHERE current_status = 'dbt_disbursed'").get() as any
    ).count;
    const dbtSumInr = (
      db
        .prepare("SELECT coalesce(sum(sanction_amount), 0) as total FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')")
        .get() as any
    ).total;
    const families = this.getAllSamagraFamilies();
    const registeredMembers = families.reduce((sum, f) => sum + f.members.length, 0);
    const verifiedDocsCount = (
      db.prepare('SELECT count(*) as count FROM digilocker_documents WHERE verified = 1').get() as any
    ).count;

    return {
      totalSchemes: schemeCount,
      totalApplications: appCount,
      pendingApplications: pendingCount,
      approvedApplications: approvedCount,
      disbursedApplications: disbursedCount,
      totalDbtDisbursedInr: Number(dbtSumInr) || 0,
      totalDbtDisbursedCr: Number(((Number(dbtSumInr) || 0) / 10000000).toFixed(4)),
      registeredFamilies: families.length,
      registeredMembers,
      verifiedDocumentsCount: verifiedDocsCount,
      activeWards: IMC_WARDS.length,
      activeJanpadBlocks: JANPAD_BLOCKS.length,
      approvalRatePercent: appCount > 0 ? Math.round((approvedCount / appCount) * 100) : 0,
    };
  },

  getWardAndBlockLiveStats() {
    const apps = this.getApplications();
    const families = this.getAllSamagraFamilies();
    return {
      wards: aggregateWardLiveMetrics(apps, families, IMC_WARDS),
      blocks: aggregateJanpadLiveMetrics(apps, families, JANPAD_BLOCKS),
    };
  },
};
