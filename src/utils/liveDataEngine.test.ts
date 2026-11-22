import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateJanpadLiveMetrics,
  aggregateWardLiveMetrics,
  computeEntitlementDigest,
  createEmptyCitizenProfile,
  evaluateSchemesRealtimeStatus,
  extractJanpadBlock,
  extractWardNumber,
  OFFICIAL_SCHEME_PORTAL_URLS,
  resolveSchemePortalUrl,
} from './liveDataEngine';
import { getSchemeApplicationProcedure } from './schemeProcedures';
import { SCHEMES_DATABASE } from '../data/schemesData';
import { IMC_WARDS, JANPAD_BLOCKS } from '../data/indoreGovernance';
import { ApplicationRecord, SamagraFamily, Scheme } from '../types';

test('createEmptyCitizenProfile returns clean unlinked citizen profile with zero demo data', () => {
  const profile = createEmptyCitizenProfile();
  assert.equal(profile.fullName, '');
  assert.equal(profile.samagraFamilyId, undefined);
  assert.equal(profile.samagraMemberId, undefined);
  assert.deepEqual(profile.verifiedDocuments, {});
});

test('resolveSchemePortalUrl maps all 51 schemes to explicit verified https official government portals', () => {
  assert.equal(SCHEMES_DATABASE.length, 51, 'Expected 51 baseline schemes');
  for (const scheme of SCHEMES_DATABASE) {
    assert.ok(
      scheme.applyUrl && scheme.applyUrl.startsWith('https://'),
      `Expected explicit https applyUrl directly on scheme ${scheme.id}, got ${scheme.applyUrl}`
    );
    assert.ok(
      OFFICIAL_SCHEME_PORTAL_URLS[scheme.id],
      `Expected explicit official portal URL mapping for ${scheme.id}`
    );
    assert.equal(
      scheme.applyUrl,
      OFFICIAL_SCHEME_PORTAL_URLS[scheme.id],
      `Expected scheme.applyUrl to match verified official URL for ${scheme.id}`
    );
    const url = resolveSchemePortalUrl(scheme);
    assert.ok(url.startsWith('https://'), `Expected https portal URL for ${scheme.id}, got ${url}`);
  }
  const pmKisan = SCHEMES_DATABASE.find(s => s.id === 'pm_kisan')!;
  assert.equal(resolveSchemePortalUrl(pmKisan), 'https://pmkisan.gov.in/');
  const pmfby = SCHEMES_DATABASE.find(s => s.id === 'pmfby_crop_insurance')!;
  assert.equal(resolveSchemePortalUrl(pmfby), 'https://pmfby.gov.in/');

  // Ensure unsafe non-http(s) URLs are rejected and fall back safely
  const unsafeResolved = resolveSchemePortalUrl({
    id: 'custom_test_scheme',
    governanceLevel: 'district_indore',
    applyUrl: 'javascript:alert(1)',
    dataOrigin: 'admin_live',
  });
  assert.equal(unsafeResolved, 'https://indore.nic.in/');
});

test('getSchemeApplicationProcedure returns complete EN, HI, and Malwi procedures for all 51 schemes', () => {
  for (const scheme of SCHEMES_DATABASE) {
    for (const lang of ['en', 'hi', 'malwi'] as const) {
      const proc = getSchemeApplicationProcedure(scheme, lang);
      assert.ok(proc.portalUrl.startsWith('https://'));
      assert.ok(proc.mode.length > 5);
      assert.ok(proc.estimatedTime.length > 3);
      assert.ok(proc.steps.length >= 4, `Expected >= 4 steps for ${scheme.id} in ${lang}`);
    }
  }
});

test('evaluateSchemesRealtimeStatus reports baseline_unverified when portals are unchecked', () => {
  const report = evaluateSchemesRealtimeStatus(SCHEMES_DATABASE);
  assert.equal(report.isDatabaseLive, true);
  assert.equal(report.hasExternalRealtimeFeed, false);
  assert.equal(report.verdict, 'baseline_unverified');
  assert.equal(report.totalSchemes, SCHEMES_DATABASE.length);
  assert.equal(report.checkedSchemesCount, 0);
  assert.ok(report.portals.length > 5);
});

test('evaluateSchemesRealtimeStatus reports live_verified when all schemes are portal-reachable', () => {
  const now = new Date().toISOString();
  const checkedSchemes: Scheme[] = SCHEMES_DATABASE.slice(0, 3).map((s, idx) => ({
    ...s,
    dataOrigin: idx === 0 ? 'admin_live' : 'baseline_catalog',
    portalStatus: 'reachable',
    portalHttpStatus: 200,
    portalLatencyMs: 180,
    portalCheckedAt: now,
    updatedAt: now,
  }));

  const report = evaluateSchemesRealtimeStatus(checkedSchemes);
  assert.equal(report.verdict, 'live_verified');
  assert.equal(report.adminLiveSchemesCount, 1);
  assert.equal(report.baselineSchemesCount, 2);
  assert.equal(report.reachableSchemesCount, 3);
  assert.equal(report.lastPortalCheckAt, now);
});

test('aggregateWardLiveMetrics and aggregateJanpadLiveMetrics compute strictly real counts starting from zero', () => {
  const emptyWardMetrics = aggregateWardLiveMetrics([], [], IMC_WARDS);
  assert.equal(emptyWardMetrics[72].applicationsCount, 0);
  assert.equal(emptyWardMetrics[72].dbtDisbursedInr, 0);
  assert.equal(emptyWardMetrics[72].approvalRatePercent, null);

  const sampleApps: ApplicationRecord[] = [
    {
      arn: 'YS-IND-2026-10001',
      schemeId: 'mp_ladli_behna',
      schemeTitle: 'Ladli Behna',
      schemeTitleHindi: 'लाड़ली बहना',
      applicantName: 'Citizen A',
      samagraMemberId: '111111111',
      samagraFamilyId: '11111111',
      phone: '9826011111',
      wardOrBlock: 'Ward 72 (Vijay Nagar)',
      areaType: 'urban',
      appliedDate: '2026-04-01',
      currentStatus: 'dbt_disbursed',
      timeline: [],
      officerInCharge: 'Nodal Officer',
      sanctionAmount: 1500,
      remarks: '',
    },
    {
      arn: 'YS-IND-2026-10002',
      schemeId: 'pm_kisan',
      schemeTitle: 'PM-KISAN',
      schemeTitleHindi: 'पीएम किसान',
      applicantName: 'Citizen B',
      samagraMemberId: '222222222',
      samagraFamilyId: '22222222',
      phone: '9826022222',
      wardOrBlock: 'Depalpur Janpad',
      areaType: 'rural',
      appliedDate: '2026-04-01',
      currentStatus: 'submitted',
      timeline: [],
      officerInCharge: 'Nodal Officer',
      sanctionAmount: 6000,
      remarks: '',
    },
  ];

  const sampleFamilies: SamagraFamily[] = [
    {
      familyId: '11111111',
      headName: 'Citizen A',
      areaType: 'urban',
      wardOrBlock: 'Ward 72 (Vijay Nagar)',
      address: 'Indore',
      rationCardType: 'APL',
      members: [],
    },
    {
      familyId: '22222222',
      headName: 'Citizen B',
      areaType: 'rural',
      wardOrBlock: 'Depalpur Janpad',
      address: 'Depalpur',
      rationCardType: 'BPL',
      members: [],
    },
  ];

  const wardMetrics = aggregateWardLiveMetrics(sampleApps, sampleFamilies, IMC_WARDS);
  assert.equal(wardMetrics[72].applicationsCount, 1);
  assert.equal(wardMetrics[72].approvedCount, 1);
  assert.equal(wardMetrics[72].dbtDisbursedInr, 1500);
  assert.equal(wardMetrics[72].registeredFamiliesCount, 1);
  assert.equal(wardMetrics[72].approvalRatePercent, 100);
  assert.equal(wardMetrics[15].applicationsCount, 0);

  const janpadMetrics = aggregateJanpadLiveMetrics(sampleApps, sampleFamilies, JANPAD_BLOCKS);
  assert.equal(janpadMetrics.Depalpur.applicationsCount, 1);
  assert.equal(janpadMetrics.Depalpur.approvedCount, 0);
  assert.equal(janpadMetrics.Depalpur.registeredFamiliesCount, 1);
  assert.equal(janpadMetrics.Mhow.applicationsCount, 0);
});

test('extractWardNumber, extractJanpadBlock and computeEntitlementDigest work deterministically', () => {
  assert.equal(extractWardNumber('Ward 15 (Khajrana)'), 15);
  assert.equal(extractWardNumber('Ward 99'), null);
  assert.equal(extractJanpadBlock('Sanwer Janpad Panchayat'), 'Sanwer');
  assert.equal(extractJanpadBlock('Ward 12'), null);

  const d1 = computeEntitlementDigest('109283742', ['b', 'a']);
  const d2 = computeEntitlementDigest('109283742', ['a', 'b']);
  const d3 = computeEntitlementDigest('999999999', ['a', 'b']);
  assert.equal(d1, d2);
  assert.notEqual(d1, d3);
  assert.equal(d1.length, 16);
});
