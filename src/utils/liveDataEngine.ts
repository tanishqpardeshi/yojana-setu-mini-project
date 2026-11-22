import {
  ApplicationRecord,
  CitizenProfile,
  GovernanceLevel,
  JanpadBlock,
  JanpadLiveMetric,
  PortalDomainCheckResult,
  SamagraFamily,
  Scheme,
  SchemesRealtimeReport,
  WardLiveMetric,
} from '../types';
import type { JanpadBlockInfo, WardInfo } from '../data/indoreGovernance';

export const OFFICIAL_SCHEME_PORTAL_URLS: Record<string, string> = {
  // Level 1: International & Multilateral (4 Schemes)
  adb_mpusp_water: 'https://www.mpudc.co.in/',
  wb_mprcp_rural_connect: 'https://mprrda.mp.gov.in/',
  unicef_poshan_mitr: 'https://mpwcdmis.gov.in/',
  gef_clean_indore_mobility: 'https://smartcityindore.org/',

  // Level 2: National / Central Government (14 Schemes)
  pm_kisan: 'https://pmkisan.gov.in/',
  pmay_urban: 'https://pmaymis.gov.in/',
  pmay_gramin: 'https://pmayg.nic.in/',
  ayushman_bharat: 'https://pmjay.gov.in/',
  pm_svanidhi: 'https://pmsvanidhi.mohua.gov.in/',
  pm_vishwakarma: 'https://pmvishwakarma.gov.in/',
  pm_surya_ghar: 'https://pmsuryaghar.gov.in/',
  pmfby_crop_insurance: 'https://pmfby.gov.in/',
  mgnrega_indore: 'https://nrega.nic.in/',
  pm_kusum_solar_pump: 'https://pmkusum.mnre.gov.in/',
  day_nrlm_aajeevika: 'https://aajeevika.gov.in/',
  pm_mudra_yojana: 'https://www.mudra.org.in/',
  sukanya_samriddhi: 'https://www.nsiindia.gov.in/',
  pmfme_food_processing: 'https://pmfme.mofpi.gov.in/',

  // Level 3: Madhya Pradesh State Government (16 Schemes)
  mp_ladli_behna: 'https://cmladlibahna.mp.gov.in/',
  mp_ladli_laxmi: 'https://ladlilaxmi.mp.gov.in/',
  mp_kisan_kalyan: 'https://saara.mp.gov.in/',
  mp_sambal_2: 'https://sambal.mp.gov.in/',
  mp_seekho_kamao: 'https://mmsky.mp.gov.in/',
  mp_kanya_vivah: 'https://vivahportal.mp.gov.in/',
  mp_medhavi_vidyarthi: 'https://scholarshipportal.mp.nic.in/MedhaviChhatra/',
  mp_udyam_kranti: 'https://samast.mponline.gov.in/',
  mp_krishak_mitra_solar: 'https://cmsolarpump.mp.gov.in/',
  mp_teerth_darshan: 'https://dharmasva.mp.gov.in/',
  mp_gaon_ki_beti: 'https://scholarshipportal.mp.nic.in/',
  mp_pratibha_kiran: 'https://scholarshipportal.mp.nic.in/',
  mp_post_matric_scholarship: 'https://www.tribal.mp.gov.in/MPTAAS',
  mp_kalyani_vridha_pension: 'https://socialsecurity.mp.gov.in/',
  mp_rani_durgavati_livelihood: 'https://mpurban.gov.in/',
  mp_ration_aapke_gram: 'https://food.mp.gov.in/',

  // Level 4: District Collectorate Indore (6 Schemes)
  indore_redcross_arogya: 'https://indore.nic.in/en/schemes/',
  indore_ahilya_divyang: 'https://socialjustice.mp.gov.in/',
  indore_jal_hath_recharge: 'https://indore.nic.in/en/schemes/',
  indore_tribal_livelihood_grant: 'https://www.tribal.mp.gov.in/',
  indore_district_innovation_voucher: 'https://startup.mp.gov.in/',
  indore_ahilya_annapurna_meals: 'https://indore.nic.in/en/schemes/',

  // Level 5: Indore Municipal Corporation — IMC Wards 1-85 (5 Schemes)
  imc_swachhata_mitr: 'https://imcindore.mp.gov.in/',
  imc_rooftop_solar: 'https://www.mpwz.co.in/',
  imc_pink_vending_zone: 'https://imcindore.mp.gov.in/',
  imc_rainwater_harvesting_rebate: 'https://www.mpenagarpalika.gov.in/',
  imc_ev_charging_grant: 'https://smartcityindore.org/',

  // Level 6: Rural Janpad Panchayats & Corridors (6 Schemes)
  janpad_malwi_cow_dairy: 'https://mpdah.gov.in/',
  janpad_mhow_bamboo_forest: 'https://mpforest.gov.in/',
  janpad_sanwer_onion_storage: 'https://mpfsts.mp.gov.in/',
  janpad_indore_custom_hiring: 'https://farmer.mpdage.org/',
  corridor_pithampur_rural_skill: 'https://invest.mp.gov.in/',
  corridor_ujjain_mandi_logistics: 'https://mpmandiboard.gov.in/',
};

export const GOVERNANCE_LEVEL_DEFAULT_PORTALS: Record<GovernanceLevel, string> = {
  international: 'https://mp.gov.in/',
  national: 'https://www.myscheme.gov.in/',
  state_mp: 'https://mp.gov.in/',
  district_indore: 'https://indore.nic.in/',
  urban_imc: 'https://imcindore.mp.gov.in/',
  rural_janpad: 'https://prd.mp.gov.in/',
};

export function isSafeHttpUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function resolveSchemePortalUrl(
  scheme: Pick<Scheme, 'id' | 'governanceLevel' | 'applyUrl'> & { dataOrigin?: Scheme['dataOrigin'] }
): string {
  if (scheme.dataOrigin === 'admin_live' && isSafeHttpUrl(scheme.applyUrl)) {
    return scheme.applyUrl!.trim();
  }
  if (OFFICIAL_SCHEME_PORTAL_URLS[scheme.id]) {
    return OFFICIAL_SCHEME_PORTAL_URLS[scheme.id];
  }
  if (isSafeHttpUrl(scheme.applyUrl)) {
    return scheme.applyUrl!.trim();
  }
  return GOVERNANCE_LEVEL_DEFAULT_PORTALS[scheme.governanceLevel];
}

export function getOfficialPortalDisplayHost(scheme: Pick<Scheme, 'id' | 'governanceLevel' | 'applyUrl'>): string {
  const url = resolveSchemePortalUrl(scheme);
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function createEmptyCitizenProfile(): CitizenProfile {
  return {
    fullName: '',
    age: 28,
    gender: 'female',
    category: 'GEN',
    areaType: 'urban',
    wardNumber: 1,
    annualIncome: 150000,
    occupation: 'Other',
    landHoldingHectares: 0,
    isBPL: false,
    hasDisability: false,
    maritalStatus: 'Unmarried',
    isMpDomicile: true,
    isIndoreResident: true,
    samagraFamilyId: undefined,
    samagraMemberId: undefined,
    phone: undefined,
    verifiedDocuments: {},
  };
}

export function evaluateSchemesRealtimeStatus(schemes: Scheme[]): SchemesRealtimeReport {
  const totalSchemes = schemes.length;
  let baselineSchemesCount = 0;
  let adminLiveSchemesCount = 0;
  let checkedSchemesCount = 0;
  let reachableSchemesCount = 0;
  let unreachableSchemesCount = 0;
  let lastDatabaseUpdateAt: string | null = null;
  let lastPortalCheckAt: string | null = null;

  const portalMap = new Map<string, PortalDomainCheckResult>();

  for (const s of schemes) {
    if (s.dataOrigin === 'admin_live') {
      adminLiveSchemesCount += 1;
    } else {
      baselineSchemesCount += 1;
    }

    if (s.updatedAt && (!lastDatabaseUpdateAt || s.updatedAt > lastDatabaseUpdateAt)) {
      lastDatabaseUpdateAt = s.updatedAt;
    }

    const status = s.portalStatus || 'unchecked';
    if (status !== 'unchecked') {
      checkedSchemesCount += 1;
      if (status === 'reachable') reachableSchemesCount += 1;
      else unreachableSchemesCount += 1;
    }

    if (s.portalCheckedAt && (!lastPortalCheckAt || s.portalCheckedAt > lastPortalCheckAt)) {
      lastPortalCheckAt = s.portalCheckedAt;
    }

    const portalUrl = resolveSchemePortalUrl(s);
    const existing = portalMap.get(portalUrl);
    if (!existing) {
      portalMap.set(portalUrl, {
        portalUrl,
        status,
        httpStatus: s.portalHttpStatus ?? null,
        latencyMs: s.portalLatencyMs ?? null,
        checkedAt: s.portalCheckedAt ?? null,
        schemeCount: 1,
      });
    } else {
      existing.schemeCount += 1;
      if (s.portalCheckedAt && (!existing.checkedAt || s.portalCheckedAt > existing.checkedAt)) {
        existing.status = status;
        existing.httpStatus = s.portalHttpStatus ?? null;
        existing.latencyMs = s.portalLatencyMs ?? null;
        existing.checkedAt = s.portalCheckedAt;
      }
    }
  }

  let verdict: SchemesRealtimeReport['verdict'] = 'baseline_unverified';
  let verdictLabel = 'Live Database Catalog — External Portals Not Yet Checked';
  let verdictDetail =
    'Schemes are served live from the database with real-time Admin sync, but official government portals have not yet been probed in this session.';

  if (checkedSchemesCount > 0) {
    if (reachableSchemesCount === totalSchemes && totalSchemes > 0) {
      verdict = 'live_verified';
      verdictLabel = 'Live Database Sync + All Official Portals Reachable';
      verdictDetail = `All ${totalSchemes} schemes are live-synced in the database and every referenced official government portal responded to live verification.`;
    } else if (reachableSchemesCount > 0) {
      verdict = 'partially_verified';
      verdictLabel = `Live Database Sync • ${reachableSchemesCount}/${totalSchemes} Schemes Portal-Verified`;
      verdictDetail = `${reachableSchemesCount} schemes have live reachable official portals; ${unreachableSchemesCount} portal(s) timed out or blocked automated probes. Scheme rules remain editable in real time via Admin.`;
    } else {
      verdict = 'unreachable';
      verdictLabel = 'Live Database Only — Official Portals Unreachable';
      verdictDetail =
        'External government portals could not be reached from the server right now (firewall or network restriction). Schemes remain synced in the database.';
    }
  }

  const portals = Array.from(portalMap.values()).sort((a, b) => b.schemeCount - a.schemeCount);

  return {
    isDatabaseLive: totalSchemes > 0,
    hasExternalRealtimeFeed: false,
    verdict,
    verdictLabel,
    verdictDetail,
    totalSchemes,
    baselineSchemesCount,
    adminLiveSchemesCount,
    checkedSchemesCount,
    reachableSchemesCount,
    unreachableSchemesCount,
    lastDatabaseUpdateAt,
    lastPortalCheckAt,
    portals,
  };
}

export function extractWardNumber(wardOrBlock: string | undefined): number | null {
  if (!wardOrBlock) return null;
  const match = wardOrBlock.match(/ward\s*#?\s*(\d+)/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isInteger(num) || num < 1 || num > 85) return null;
  return num;
}

export function extractJanpadBlock(wardOrBlock: string | undefined): JanpadBlock | null {
  if (!wardOrBlock) return null;
  const lower = wardOrBlock.toLowerCase();
  if (lower.includes('depalpur')) return 'Depalpur';
  if (lower.includes('mhow')) return 'Mhow';
  if (lower.includes('sanwer')) return 'Sanwer';
  if (lower.includes('indore') && (lower.includes('janpad') || lower.includes('block') || lower.includes('rural'))) {
    return 'Indore';
  }
  return null;
}

export function aggregateWardLiveMetrics(
  applications: ApplicationRecord[],
  families: SamagraFamily[],
  wards: WardInfo[]
): Record<number, WardLiveMetric> {
  const result: Record<number, WardLiveMetric> = {};
  for (const w of wards) {
    result[w.number] = {
      wardNumber: w.number,
      applicationsCount: 0,
      approvedCount: 0,
      dbtDisbursedInr: 0,
      registeredFamiliesCount: 0,
      approvalRatePercent: null,
    };
  }

  for (const app of applications) {
    if (app.areaType !== 'urban') continue;
    const wardNum = extractWardNumber(app.wardOrBlock);
    if (!wardNum || !result[wardNum]) continue;
    result[wardNum].applicationsCount += 1;
    if (app.currentStatus === 'sanction_issued' || app.currentStatus === 'dbt_disbursed') {
      result[wardNum].approvedCount += 1;
      result[wardNum].dbtDisbursedInr += Number(app.sanctionAmount) || 0;
    }
  }

  for (const fam of families) {
    if (fam.areaType !== 'urban') continue;
    const wardNum = extractWardNumber(fam.wardOrBlock);
    if (!wardNum || !result[wardNum]) continue;
    result[wardNum].registeredFamiliesCount += 1;
  }

  for (const w of wards) {
    const m = result[w.number];
    if (m.applicationsCount > 0) {
      m.approvalRatePercent = Math.round((m.approvedCount / m.applicationsCount) * 100);
    }
  }

  return result;
}

export function aggregateJanpadLiveMetrics(
  applications: ApplicationRecord[],
  families: SamagraFamily[],
  blocks: JanpadBlockInfo[]
): Record<JanpadBlock, JanpadLiveMetric> {
  const result = {} as Record<JanpadBlock, JanpadLiveMetric>;
  for (const b of blocks) {
    result[b.name] = {
      blockName: b.name,
      applicationsCount: 0,
      approvedCount: 0,
      dbtDisbursedInr: 0,
      registeredFamiliesCount: 0,
    };
  }

  for (const app of applications) {
    if (app.areaType !== 'rural') continue;
    const block = extractJanpadBlock(app.wardOrBlock) || 'Indore';
    if (!result[block]) continue;
    result[block].applicationsCount += 1;
    if (app.currentStatus === 'sanction_issued' || app.currentStatus === 'dbt_disbursed') {
      result[block].approvedCount += 1;
      result[block].dbtDisbursedInr += Number(app.sanctionAmount) || 0;
    }
  }

  for (const fam of families) {
    if (fam.areaType !== 'rural') continue;
    const block = extractJanpadBlock(fam.wardOrBlock) || 'Indore';
    if (!result[block]) continue;
    result[block].registeredFamiliesCount += 1;
  }

  return result;
}

export function computeEntitlementDigest(identifier: string, schemeIds: string[]): string {
  const payload = `${identifier || 'UNLINKED'}|${[...schemeIds].sort().join(',')}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${hex1}${hex2}`.toUpperCase();
}
