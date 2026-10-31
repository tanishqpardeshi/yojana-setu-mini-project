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
}

export interface DocumentInfo {
  id: string;
  name: string;
  nameHindi: string;
  issuingAuthority: string;
  isDigiLockerAvailable: boolean;
  category: 'identity' | 'address' | 'income' | 'land' | 'caste' | 'banking';
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
  verifiedDocuments: Record<string, { verified: boolean; source: 'digilocker' | 'mp_edistrict' | 'manual'; docNumber?: string }>;
}

export interface FamilyMember {
  memberId: string;
  name: string;
  nameHindi: string;
  relation: string;
  relationHindi: string;
  age: number;
  gender: Gender;
  occupation: OccupationType;
  ekycStatus: boolean;
  dbtActive: boolean;
  annualIncome?: number;
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
  arn: string; // e.g. YS-IND-2026-10492
  schemeId: string;
  schemeTitle: string;
  schemeTitleHindi: string;
  applicantName: string;
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
  kioskOperatorCode?: string;
  remarks: string;
}

export interface LiveNotification {
  id: string;
  timestamp: string;
  type: 'application_filed' | 'dbt_disbursed' | 'ward_verification' | 'csc_intake' | 'sanction_order';
  message: string;
  messageHindi: string;
  wardOrBlock: string;
  amount?: number;
  arn?: string;
}

export type SupportedLanguage = 'en' | 'hi' | 'malwi';

export type UserMode = 'citizen' | 'csc_operator' | 'admin';

export type RagChunkType = 'eligibility' | 'benefits' | 'documents' | 'nodal_office' | 'application_process';

export interface RagChunk {
  id: string;
  schemeId: string;
  schemeTitle: string;
  schemeTitleHindi: string;
  governanceLevel: GovernanceLevel;
  chunkType: RagChunkType;
  title: string;
  content: string;
  keywords: string[];
  malwiKeywords: string[];
}

export interface RagSearchResult {
  chunk: RagChunk;
  score: number; // Hybrid combined score
  matchedTerms: string[];
  sourceLevel: string;
  confidencePercent: number; // e.g. 94%
  bm25Score?: number;
  cosineSimilarity?: number;
}

export interface RagQueryResponse {
  query: string;
  groundedAnswer: string;
  retrievedChunks: RagSearchResult[];
  modelUsed: string;
  latencyMs: number;
}

export interface DistrictStats {
  totalSchemes: number;
  totalApplications: number;
  totalDbtDisbursedCr: number;
  activeWards: number;
  activeJanpadBlocks: number;
  avgTurnaroundDays: number;
  approvalRatePercent: number;
  grievanceRedressalPercent: number;
}
