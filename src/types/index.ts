export type GovernanceLevel =
  | 'international'
  | 'national'
  | 'state_mp'
  | 'district_indore'
  | 'urban_imc'
  | 'rural_janpad';

export type AreaType = 'urban' | 'rural';

export type JanpadBlock = 'Indore' | 'Mhow' | 'Sanwer' | 'Depalpur';

export type Category = 'SC' | 'ST' | 'OBC' | 'GEN' | 'EWS';

export type Gender = 'female' | 'male' | 'transgender' | 'any';

export type MaritalStatus = 'Unmarried' | 'Married' | 'Widow' | 'Divorced';

export type OccupationType =
  | 'Farmer'
  | 'Street Vendor'
  | 'Student'
  | 'Homemaker'
  | 'Construction Worker'
  | 'Artisan / Handicraft'
  | 'Gig Worker / Driver'
  | 'Small Business'
  | 'Unemployed'
  | 'Senior Citizen'
  | 'Other';

export interface EligibilityRules {
  ageMin?: number;
  ageMax?: number;
  gender?: Gender;
  allowedCategories?: Category[];
  allowedOccupations?: OccupationType[];
  maxIncomeAnnual?: number;
  requiredAreaType?: AreaType;
  requiredBlocks?: JanpadBlock[];
  requiredWards?: number[];
  landHoldingMinHectares?: number;
  landHoldingMaxHectares?: number;
  requiresBpl?: boolean;
  requiresDisability?: boolean;
  minDisabilityPercent?: number;
  allowedMaritalStatus?: MaritalStatus[];
  requiresMpDomicile?: boolean;
  requiresIndoreResident?: boolean;
  requiresGirlChild?: boolean;
}

export type PortalReachabilityStatus = 'unchecked' | 'reachable' | 'unreachable' | 'timeout';

export interface Scheme {
  id: string;
  code: string;
  title: string;
  titleHindi: string;
  titleMalwi: string;
  governanceLevel: GovernanceLevel;
  department: string;
  nodalOfficeIndore: string;
  helpline: string;
  targetBeneficiary: string;
  description: string;
  descriptionHindi: string;
  benefits: string;
  benefitsHindi: string;
  financialEntitlement: {
    amount: number;
    frequency: 'One-Time' | 'Monthly' | 'Annual' | 'Subsidized Loan' | 'In-Kind / Service';
    description: string;
  };
  eligibilityRules: EligibilityRules;
  requiredDocuments: string[];
  tags: string[];
  malwiSynonyms: string[];
  applyUrl?: string;
  cscAvailable: boolean;
  activeBudgetCr?: number;
  updatedAt?: string;
  dataOrigin?: 'baseline_catalog' | 'admin_live';
  portalStatus?: PortalReachabilityStatus;
  portalHttpStatus?: number | null;
  portalCheckedAt?: string | null;
  portalLatencyMs?: number | null;
}

export interface DocumentInfo {
  id: string;
  name: string;
  nameHindi: string;
  issuingAuthority: string;
  isDigiLockerAvailable: boolean;
  category: 'identity' | 'address' | 'income' | 'land' | 'caste' | 'banking';
}

export interface VerifiedDocumentMeta {
  verified: boolean;
  source: 'digilocker' | 'mp_edistrict' | 'manual';
  docNumber?: string;
  issuer?: string;
  verifiedAt?: string;
}

export interface DigiLockerDocumentRecord {
  citizenKey: string;
  docId: string;
  docNumber: string;
  source: 'digilocker' | 'mp_edistrict' | 'manual';
  issuer: string;
  verified: boolean;
  verifiedAt: string;
}

export interface DigiLockerCredentialRecord {
  id: string;
  citizenId: string;
  docId?: string;
  docUri: string;
  docName: string;
  docNumber?: string;
  issuer: string;
  mimeType?: string;
  verified: boolean;
  issuedAt?: string;
  verifiedAt: string;
}

export interface CitizenProfile {
  fullName: string;
  age: number;
  gender: Gender;
  category: Category;
  areaType: AreaType;
  wardNumber?: number; // 1-85 for urban IMC
  blockName?: JanpadBlock; // For rural Janpad
  gramPanchayat?: string;
  annualIncome: number; // in INR
  occupation: OccupationType;
  landHoldingHectares: number;
  isBPL: boolean;
  hasDisability: boolean;
  disabilityPercent?: number;
  maritalStatus: MaritalStatus;
  isMpDomicile: boolean;
  isIndoreResident: boolean;
  samagraFamilyId?: string;
  samagraMemberId?: string;
  phone?: string;
  verifiedDocuments: Record<string, VerifiedDocumentMeta>;
}

export interface CitizenAccountProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  mobileNumber?: string;
  mobileVerified?: boolean;
  role: 'citizen';
  authMethod: 'email';
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
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

export interface FamilyMember {
  memberId: string;
  name: string;
  nameHindi: string;
  relation: string;
  relationHindi: string;
  age: number;
  gender: Gender;
  category?: Category;
  occupation: OccupationType;
  ekycStatus: boolean;
  dbtActive: boolean;
  annualIncome?: number;
  landHoldingHectares?: number;
  hasDisability?: boolean;
  maritalStatus?: MaritalStatus;
}

export interface SamagraFamily {
  familyId: string;
  headName: string;
  areaType: AreaType;
  wardOrBlock: string;
  address: string;
  rationCardType: 'APL' | 'BPL' | 'Antyodaya';
  members: FamilyMember[];
  source?: string;
  createdAt?: string;
}

export interface RuleEvaluationResult {
  ruleName: string;
  passed: boolean;
  reason: string;
  reasonHindi: string;
}

export interface SchemeEligibilityResult {
  scheme: Scheme;
  status: 'eligible' | 'likely' | 'not_eligible';
  matchScore: number; // 0-100%
  ruleEvaluations: RuleEvaluationResult[];
  passingReasons: string[];
  failingReasons: string[];
  missingDocuments: string[];
  recommendations: string[];
}

export interface ApplicationTimelineEvent {
  title: string;
  titleHindi: string;
  date: string;
  location: string;
  status: 'completed' | 'in_progress' | 'pending';
  remarks?: string;
}

export interface ApplicationRecord {
  arn: string;
  schemeId: string;
  schemeTitle: string;
  schemeTitleHindi: string;
  applicantName: string;
  citizenId?: string;
  samagraMemberId: string;
  samagraFamilyId: string;
  phone: string;
  wardOrBlock: string;
  areaType: AreaType;
  appliedDate: string;
  currentStatus: 'submitted' | 'ward_verification' | 'collectorate_scrutiny' | 'sanction_issued' | 'dbt_disbursed' | 'rejected';
  timeline: ApplicationTimelineEvent[];
  officerInCharge: string;
  sanctionAmount?: number;
  remarks: string;
}

export interface LiveNotification {
  id: string;
  timestamp: string;
  type:
    | 'application_filed'
    | 'dbt_disbursed'
    | 'ward_verification'
    | 'sanction_order'
    | 'samagra_synced'
    | 'digilocker_verified'
    | 'schemes_synced';
  message: string;
  messageHindi: string;
  wardOrBlock: string;
  amount?: number;
  arn?: string;
}

export type SupportedLanguage = 'en' | 'hi' | 'malwi';

export type UserMode = 'citizen' | 'admin';

export interface DistrictStats {
  totalSchemes: number;
  totalApplications: number;
  pendingApplications: number;
  approvedApplications: number;
  disbursedApplications: number;
  totalDbtDisbursedInr: number;
  totalDbtDisbursedCr: number;
  registeredFamilies: number;
  registeredMembers: number;
  verifiedDocumentsCount: number;
  activeWards: number;
  activeJanpadBlocks: number;
  approvalRatePercent: number;
}

export interface WardLiveMetric {
  wardNumber: number;
  applicationsCount: number;
  approvedCount: number;
  dbtDisbursedInr: number;
  registeredFamiliesCount: number;
  approvalRatePercent: number | null;
}

export interface JanpadLiveMetric {
  blockName: JanpadBlock;
  applicationsCount: number;
  approvedCount: number;
  dbtDisbursedInr: number;
  registeredFamiliesCount: number;
}

export interface PortalDomainCheckResult {
  portalUrl: string;
  status: PortalReachabilityStatus;
  httpStatus: number | null;
  latencyMs: number | null;
  checkedAt: string | null;
  schemeCount: number;
}

export interface SchemesRealtimeReport {
  isDatabaseLive: boolean;
  hasExternalRealtimeFeed: boolean;
  verdict: 'baseline_unverified' | 'live_verified' | 'partially_verified' | 'unreachable';
  verdictLabel: string;
  verdictDetail: string;
  totalSchemes: number;
  baselineSchemesCount: number;
  adminLiveSchemesCount: number;
  checkedSchemesCount: number;
  reachableSchemesCount: number;
  unreachableSchemesCount: number;
  lastDatabaseUpdateAt: string | null;
  lastPortalCheckAt: string | null;
  portals: PortalDomainCheckResult[];
}
