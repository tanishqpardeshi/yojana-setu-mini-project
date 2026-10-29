import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSchemeEligibility } from './rulesEngine';
import { SCHEMES_DATABASE } from '../data/schemesData';
import { CitizenProfile } from '../types';

test('Mukhyamantri Ladli Behna: Married woman in Indore is eligible/likely', () => {
  const ladliScheme = SCHEMES_DATABASE.find(s => s.id === 'mp_ladli_behna')!;
  assert.ok(ladliScheme, 'Ladli Behna scheme must exist');

  const profile: CitizenProfile = {
    fullName: 'Sunita Sharma',
    age: 43,
    gender: 'female',
    category: 'GEN',
    areaType: 'urban',
    wardNumber: 72,
    annualIncome: 120000,
    occupation: 'Homemaker',
    landHoldingHectares: 0,
    isBPL: false,
    hasDisability: false,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    verifiedDocuments: {
      samagra_member: { verified: true, source: 'mp_edistrict' },
      samagra_family: { verified: true, source: 'mp_edistrict' },
      aadhaar: { verified: true, source: 'digilocker' },
      bank_dbt: { verified: true, source: 'digilocker' },
      mp_domicile: { verified: true, source: 'digilocker' },
    },
  };

  const result = evaluateSchemeEligibility(profile, ladliScheme);
  assert.equal(result.status, 'eligible');
  assert.equal(result.matchScore, 100);
  assert.equal(result.failingReasons.length, 0);
  assert.ok(result.passingReasons.some(r => r.includes('women')));
});

test('Mukhyamantri Ladli Behna: Male applicant gets Not Eligible with clear explanation', () => {
  const ladliScheme = SCHEMES_DATABASE.find(s => s.id === 'mp_ladli_behna')!;

  const maleProfile: CitizenProfile = {
    fullName: 'Rajesh Sharma',
    age: 47,
    gender: 'male',
    category: 'GEN',
    areaType: 'urban',
    wardNumber: 72,
    annualIncome: 240000,
    occupation: 'Small Business',
    landHoldingHectares: 0,
    isBPL: false,
    hasDisability: false,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    verifiedDocuments: {},
  };

  const result = evaluateSchemeEligibility(maleProfile, ladliScheme);
  assert.equal(result.status, 'not_eligible');
  assert.ok(result.failingReasons.some(r => r.toLowerCase().includes('gender')));
});

test('PM-KISAN: Rural landholding farmer in Depalpur is eligible', () => {
  const pmKisan = SCHEMES_DATABASE.find(s => s.id === 'pm_kisan')!;
  assert.ok(pmKisan, 'PM-KISAN scheme must exist');

  const farmerProfile: CitizenProfile = {
    fullName: 'Mukesh Patel',
    age: 48,
    gender: 'male',
    category: 'OBC',
    areaType: 'rural',
    blockName: 'Depalpur',
    gramPanchayat: 'Jalod',
    annualIncome: 180000,
    occupation: 'Farmer',
    landHoldingHectares: 1.8,
    isBPL: true,
    hasDisability: false,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    verifiedDocuments: {
      khasra_b1: { verified: true, source: 'mp_edistrict' },
      aadhaar: { verified: true, source: 'digilocker' },
      bank_dbt: { verified: true, source: 'digilocker' },
      samagra_member: { verified: true, source: 'mp_edistrict' },
    },
  };

  const result = evaluateSchemeEligibility(farmerProfile, pmKisan);
  assert.equal(result.status, 'eligible');
  assert.equal(result.matchScore, 100);
});

test('Rural Janpad Malwi Cow Scheme: Urban resident is rejected for area mismatch', () => {
  const cowScheme = SCHEMES_DATABASE.find(s => s.id === 'janpad_malwi_cow_dairy')!;
  assert.ok(cowScheme, 'Malwi cow scheme must exist');

  const urbanProfile: CitizenProfile = {
    fullName: 'Sunita Sharma',
    age: 43,
    gender: 'female',
    category: 'GEN',
    areaType: 'urban',
    wardNumber: 72,
    annualIncome: 120000,
    occupation: 'Homemaker',
    landHoldingHectares: 0,
    isBPL: false,
    hasDisability: false,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    verifiedDocuments: {},
  };

  const result = evaluateSchemeEligibility(urbanProfile, cowScheme);
  assert.equal(result.status, 'not_eligible');
  assert.ok(result.failingReasons.some(r => r.includes('rural')));
});

test('Ahilya Divyang Kosh: Person with 40%+ disability is eligible', () => {
  const divyangScheme = SCHEMES_DATABASE.find(s => s.id === 'indore_ahilya_divyang')!;
  assert.ok(divyangScheme, 'Ahilya Divyang scheme must exist');

  const divyangProfile: CitizenProfile = {
    fullName: 'Santosh Malviya',
    age: 35,
    gender: 'male',
    category: 'SC',
    areaType: 'urban',
    wardNumber: 22,
    annualIncome: 90000,
    occupation: 'Small Business',
    landHoldingHectares: 0,
    isBPL: true,
    hasDisability: true,
    disabilityPercent: 55,
    maritalStatus: 'Married',
    isMpDomicile: true,
    isIndoreResident: true,
    verifiedDocuments: {
      udid_card: { verified: true, source: 'digilocker' },
      samagra_member: { verified: true, source: 'mp_edistrict' },
      aadhaar: { verified: true, source: 'digilocker' },
      mp_domicile: { verified: true, source: 'digilocker' },
    },
  };

  const result = evaluateSchemeEligibility(divyangProfile, divyangScheme);
  assert.equal(result.status, 'eligible');
  assert.equal(result.matchScore, 100);
});
