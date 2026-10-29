import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { 
  Scheme, 
  ApplicationRecord, 
  LiveNotification, 
  SamagraFamily, 
  DistrictStats 
} from '../src/types/index.js';
import { SCHEMES_DATABASE } from '../src/data/schemesData.js';
import { 
  INITIAL_APPLICATION_RECORDS, 
  INITIAL_NOTIFICATIONS, 
  MOCK_SAMAGRA_FAMILIES 
} from '../src/data/samagraMockProfiles.js';

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

// Helper to convert DB row to Scheme model
function rowToScheme(row: any): Scheme {
  return {
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
      amount: row.financial_amount,
      frequency: row.financial_frequency,
      description: row.financial_desc,
    },
    eligibilityRules: JSON.parse(row.eligibility_rules_json || '{}'),
    requiredDocuments: JSON.parse(row.required_documents_json || '[]'),
    tags: JSON.parse(row.tags_json || '[]'),
    malwiSynonyms: JSON.parse(row.malwi_synonyms_json || '[]'),
    applyUrl: row.apply_url || undefined,
    cscAvailable: Boolean(row.csc_available),
    activeBudgetCr: row.active_budget_cr ? Number(row.active_budget_cr) : undefined,
  };
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
    kioskOperatorCode: row.kiosk_operator_code || undefined,
    remarks: row.remarks || '',
    timeline: JSON.parse(row.timeline_json || '[]'),
  };
}

// Seed / Sync schemes data on startup
function seedDatabase() {
  const insertSchemeStmt = db.prepare(`
    INSERT OR REPLACE INTO schemes (
      id, code, title, title_hindi, title_malwi, governance_level, department,
      nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
      benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
      eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
      apply_url, csc_available, active_budget_cr, updated_at
    ) VALUES (
      @id, @code, @title, @titleHindi, @titleMalwi, @governanceLevel, @department,
      @nodalOfficeIndore, @helpline, @targetBeneficiary, @description, @descriptionHindi,
      @benefits, @benefitsHindi, @financialAmount, @financialFrequency, @financialDesc,
      @eligibilityRulesJson, @requiredDocumentsJson, @tagsJson, @malwiSynonymsJson,
      @applyUrl, @cscAvailable, @activeBudgetCr, @updatedAt
    )
  `);

  const insertManySchemes = db.transaction((schemes: Scheme[]) => {
    for (const s of schemes) {
      insertSchemeStmt.run({
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
        applyUrl: s.applyUrl || null,
        cscAvailable: s.cscAvailable ? 1 : 0,
        activeBudgetCr: s.activeBudgetCr || null,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  insertManySchemes(SCHEMES_DATABASE);
  console.log(`[SQLite] Synced ${SCHEMES_DATABASE.length} schemes into SQLite database.`);

  // Seed applications
  const appCount = (db.prepare('SELECT count(*) as count FROM applications').get() as any).count;
  if (appCount === 0) {
    const insertAppStmt = db.prepare(`
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

    const insertManyApps = db.transaction((apps: ApplicationRecord[]) => {
      for (const a of apps) {
        insertAppStmt.run({
          arn: a.arn,
          schemeId: a.schemeId,
          schemeTitle: a.schemeTitle,
          schemeTitleHindi: a.schemeTitleHindi,
          applicantName: a.applicantName,
          samagraMemberId: a.samagraMemberId,
          samagraFamilyId: a.samagraFamilyId,
          phone: a.phone,
          wardOrBlock: a.wardOrBlock,
          areaType: a.areaType,
          appliedDate: a.appliedDate,
          currentStatus: a.currentStatus,
          officerInCharge: a.officerInCharge,
          sanctionAmount: a.sanctionAmount || 0,
          kioskOperatorCode: a.kioskOperatorCode || null,
          remarks: a.remarks || '',
          timelineJson: JSON.stringify(a.timeline),
          createdAt: new Date().toISOString(),
        });
      }
    });

    insertManyApps(INITIAL_APPLICATION_RECORDS);
    console.log(`[SQLite] Seeded ${INITIAL_APPLICATION_RECORDS.length} initial applications.`);
  }

  // Seed Samagra Families
  const famCount = (db.prepare('SELECT count(*) as count FROM samagra_families').get() as any).count;
  if (famCount === 0) {
    const insertFamStmt = db.prepare(`
      INSERT INTO samagra_families (
        family_id, head_name, area_type, ward_or_block, address,
        ration_card_type, members_json, created_at
      ) VALUES (
        @familyId, @headName, @areaType, @wardOrBlock, @address,
        @rationCardType, @membersJson, @createdAt
      )
    `);

    const insertManyFams = db.transaction((families: SamagraFamily[]) => {
      for (const f of families) {
        insertFamStmt.run({
          familyId: f.familyId,
          headName: f.headName,
          areaType: f.areaType,
          wardOrBlock: f.wardOrBlock,
          address: f.address,
          rationCardType: f.rationCardType,
          membersJson: JSON.stringify(f.members),
          createdAt: new Date().toISOString(),
        });
      }
    });

    insertManyFams(MOCK_SAMAGRA_FAMILIES);
    console.log(`[SQLite] Seeded ${MOCK_SAMAGRA_FAMILIES.length} Samagra families.`);
  }

  // Seed Notifications
  const notifCount = (db.prepare('SELECT count(*) as count FROM admin_broadcasts').get() as any).count;
  if (notifCount === 0) {
    const insertNotifStmt = db.prepare(`
      INSERT INTO admin_broadcasts (
        id, timestamp, type, message, message_hindi, ward_or_block, amount, arn, created_at
      ) VALUES (
        @id, @timestamp, @type, @message, @messageHindi, @wardOrBlock, @amount, @arn, @createdAt
      )
    `);

    const insertManyNotifs = db.transaction((notifs: LiveNotification[]) => {
      for (const n of notifs) {
        insertNotifStmt.run({
          id: n.id,
          timestamp: n.timestamp,
          type: n.type,
          message: n.message,
          messageHindi: n.messageHindi,
          wardOrBlock: n.wardOrBlock,
          amount: n.amount || null,
          arn: n.arn || null,
          createdAt: new Date().toISOString(),
        });
      }
    });

    insertManyNotifs(INITIAL_NOTIFICATIONS);
    console.log(`[SQLite] Seeded ${INITIAL_NOTIFICATIONS.length} initial administrative broadcasts.`);
  }
}

// Run initial seed
seedDatabase();

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

  insertScheme(scheme: Scheme): boolean {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO schemes (
        id, code, title, title_hindi, title_malwi, governance_level, department,
        nodal_office_indore, helpline, target_beneficiary, description, description_hindi,
        benefits, benefits_hindi, financial_amount, financial_frequency, financial_desc,
        eligibility_rules_json, required_documents_json, tags_json, malwi_synonyms_json,
        apply_url, csc_available, active_budget_cr, updated_at
      ) VALUES (
        @id, @code, @title, @titleHindi, @titleMalwi, @governanceLevel, @department,
        @nodalOfficeIndore, @helpline, @targetBeneficiary, @description, @descriptionHindi,
        @benefits, @benefitsHindi, @financialAmount, @financialFrequency, @financialDesc,
        @eligibilityRulesJson, @requiredDocumentsJson, @tagsJson, @malwiSynonymsJson,
        @applyUrl, @cscAvailable, @activeBudgetCr, @updatedAt
      )
    `);

    stmt.run({
      id: scheme.id,
      code: scheme.code,
      title: scheme.title,
      titleHindi: scheme.titleHindi,
      titleMalwi: scheme.titleMalwi,
      governanceLevel: scheme.governanceLevel,
      department: scheme.department,
      nodalOfficeIndore: scheme.nodalOfficeIndore,
      helpline: scheme.helpline,
      targetBeneficiary: scheme.targetBeneficiary,
      description: scheme.description,
      descriptionHindi: scheme.descriptionHindi,
      benefits: scheme.benefits,
      benefitsHindi: scheme.benefitsHindi,
      financialAmount: scheme.financialEntitlement.amount,
      financialFrequency: scheme.financialEntitlement.frequency,
      financialDesc: scheme.financialEntitlement.description,
      eligibilityRulesJson: JSON.stringify(scheme.eligibilityRules),
      requiredDocumentsJson: JSON.stringify(scheme.requiredDocuments),
      tagsJson: JSON.stringify(scheme.tags),
      malwiSynonymsJson: JSON.stringify(scheme.malwiSynonyms),
      applyUrl: scheme.applyUrl || null,
      cscAvailable: scheme.cscAvailable ? 1 : 0,
      activeBudgetCr: scheme.activeBudgetCr || null,
      updatedAt: new Date().toISOString(),
    });
    return true;
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
      kioskOperatorCode: app.kioskOperatorCode || null,
      remarks: app.remarks || '',
      timelineJson: JSON.stringify(app.timeline),
      createdAt: new Date().toISOString(),
    });
    return true;
  },

  updateApplicationStatus(arn: string, status: string, remarks?: string): ApplicationRecord | null {
    const existing = this.getApplicationByArn(arn);
    if (!existing) return null;

    const timeline = [...existing.timeline];
    timeline.push({
      title: `Status updated to ${status.replace('_', ' ').toUpperCase()}`,
      titleHindi: `स्थिति परिवर्तित: ${status}`,
      date: new Date().toLocaleString(),
      location: 'Indore Administrative Portal',
      status: 'completed',
      remarks: remarks || undefined,
    });

    const stmt = db.prepare(`
      UPDATE applications
      SET current_status = ?, remarks = ?, timeline_json = ?
      WHERE upper(arn) = upper(?)
    `);

    stmt.run(status, remarks || existing.remarks, JSON.stringify(timeline), arn.trim());
    return this.getApplicationByArn(arn);
  },

  // Samagra Families
  getSamagraFamily(familyId: string): SamagraFamily | null {
    const row = db.prepare('SELECT * FROM samagra_families WHERE family_id = ?').get(familyId.trim());
    if (!row) {
      // Also check if member ID matches any member inside members_json
      const allRows = db.prepare('SELECT * FROM samagra_families').all() as any[];
      for (const r of allRows) {
        const members = JSON.parse(r.members_json || '[]');
        if (members.some((m: any) => m.memberId === familyId.trim())) {
          return {
            familyId: r.family_id,
            headName: r.head_name,
            areaType: r.area_type,
            wardOrBlock: r.ward_or_block,
            address: r.address,
            rationCardType: r.ration_card_type,
            members,
          };
        }
      }
      return null;
    }

    const r = row as any;
    return {
      familyId: r.family_id,
      headName: r.head_name,
      areaType: r.area_type,
      wardOrBlock: r.ward_or_block,
      address: r.address,
      rationCardType: r.ration_card_type,
      members: JSON.parse(r.members_json || '[]'),
    };
  },

  // Notifications
  getNotifications(limit: number = 30): LiveNotification[] {
    const rows = db.prepare('SELECT * FROM admin_broadcasts ORDER BY rowid DESC LIMIT ?').all(limit) as any[];
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

  // District Macro Statistics
  getDistrictStats(): DistrictStats {
    const schemeCount = (db.prepare('SELECT count(*) as count FROM schemes').get() as any).count;
    const appCount = (db.prepare('SELECT count(*) as count FROM applications').get() as any).count;
    const dbtSum = (db.prepare("SELECT coalesce(sum(sanction_amount), 0) as total FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')").get() as any).total;
    const approvedCount = (db.prepare("SELECT count(*) as count FROM applications WHERE current_status IN ('sanction_issued', 'dbt_disbursed')").get() as any).count;

    return {
      totalSchemes: schemeCount,
      totalApplications: appCount,
      totalDbtDisbursedCr: Number(((dbtSum / 10000000) + 48.6).toFixed(1)), // base seed + dynamic
      activeWards: 85,
      activeJanpadBlocks: 4,
      avgTurnaroundDays: 4.2,
      approvalRatePercent: appCount > 0 ? Math.round((approvedCount / appCount) * 100) : 94,
      grievanceRedressalPercent: 98.4,
    };
  },
};
