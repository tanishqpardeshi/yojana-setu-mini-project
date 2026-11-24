import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  MapPin,
  CreditCard,
  ArrowRight,
  UserCheck,
  Plus,
  Trash2,
  Loader2,
  UserPlus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  SamagraFamily,
  FamilyMember,
  SupportedLanguage,
  Scheme,
  AreaType,
  Category,
  Gender,
  JanpadBlock,
  MaritalStatus,
  OccupationType,
} from '../types';
import { IMC_WARDS, JANPAD_BLOCKS } from '../data/indoreGovernance';
import { rankSchemesForCitizen } from '../utils/rulesEngine';
import { ToastItem } from './ToastContainer';
import { parseApiResponse } from '../utils/apiClient';
import {
  DemoCitizenCredential,
  verifySamagraId,
} from '../services/govApiService';
import { DemoCredentialsCard } from './DemoCredentialsCard';
import {
  SAMAGRA_PORTAL_URL,
  validateSamagraFamilyId,
  validateSamagraLookupId,
  validateSamagraMemberId,
} from '../utils/samagraValidator';
import {
  getCategoryLabel,
  getGenderLabel,
  getMaritalLabel,
  getOccupationLabel,
  pickText,
} from '../utils/i18n';

interface SamagraFamilyViewProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  activeFamilyId?: string;
  activeMemberId?: string;
  onSelectMemberForProfile: (member: FamilyMember, family: SamagraFamily) => void;
  onFamiliesChanged?: () => void;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

const OCCUPATIONS: OccupationType[] = [
  'Homemaker',
  'Farmer',
  'Street Vendor',
  'Student',
  'Construction Worker',
  'Artisan / Handicraft',
  'Gig Worker / Driver',
  'Small Business',
  'Unemployed',
  'Senior Citizen',
  'Other',
];

const CATEGORIES: Category[] = ['GEN', 'OBC', 'SC', 'ST', 'EWS'];
const MARITAL_STATUSES: MaritalStatus[] = ['Married', 'Unmarried', 'Widow', 'Divorced'];

const MY_SAMAGRA_IDS_KEY = 'yojanasetu_my_samagra_ids';

function readStoredSamagraIds(): string[] {
  try {
    const raw = localStorage.getItem(MY_SAMAGRA_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0) : [];
  } catch {
    return [];
  }
}

function rememberSamagraFamilyId(familyId: string) {
  try {
    const clean = familyId.trim();
    if (!clean) return;
    const existing = readStoredSamagraIds();
    const updated = Array.from(new Set([clean, ...existing])).slice(0, 12);
    localStorage.setItem(MY_SAMAGRA_IDS_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

interface DraftMember {
  memberId: string;
  name: string;
  relation: string;
  age: number;
  gender: Gender;
  category: Category;
  occupation: OccupationType;
  annualIncome: number;
  landHoldingHectares: number;
  maritalStatus: MaritalStatus;
  hasDisability: boolean;
  ekycStatus: boolean;
  dbtActive: boolean;
}

function createEmptyDraftMember(isHead: boolean): DraftMember {
  return {
    memberId: '',
    name: '',
    relation: isHead ? 'Self / Head' : 'Spouse',
    age: isHead ? 35 : 30,
    gender: isHead ? 'female' : 'male',
    category: 'GEN',
    occupation: 'Homemaker',
    annualIncome: 120000,
    landHoldingHectares: 0,
    maritalStatus: 'Married',
    hasDisability: false,
    ekycStatus: false,
    dbtActive: false,
  };
}

export const SamagraFamilyView: React.FC<SamagraFamilyViewProps> = ({
  currentLanguage,
  schemes,
  activeFamilyId,
  activeMemberId,
  onSelectMemberForProfile,
  onFamiliesChanged,
  onNotify,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const [searchId, setSearchId] = useState(activeFamilyId || '');
  const [registeredFamilies, setRegisteredFamilies] = useState<SamagraFamily[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<SamagraFamily | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [searching, setSearching] = useState(false);
  const [loadingDemoMemberId, setLoadingDemoMemberId] = useState<string | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [samagraPortalFallback, setSamagraPortalFallback] = useState<{
    searchedId: string;
    kind: 'family' | 'member' | null;
    error: string;
    details?: string;
    portalUrl?: string;
    allowManualEntry?: boolean;
  } | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration Form State
  const [regFamilyId, setRegFamilyId] = useState('');
  const [regAreaType, setRegAreaType] = useState<AreaType>('urban');
  const [regWardNumber, setRegWardNumber] = useState<number>(72);
  const [regBlockName, setRegBlockName] = useState<JanpadBlock>('Depalpur');
  const [regAddress, setRegAddress] = useState('');
  const [regRationCard, setRegRationCard] = useState<'APL' | 'BPL' | 'Antyodaya'>('APL');
  const [draftMembers, setDraftMembers] = useState<DraftMember[]>([createEmptyDraftMember(true)]);
  const [isSavingFamily, setIsSavingFamily] = useState(false);

  const loadRegisteredFamilies = async (preserveSelectedId?: string) => {
    setLoadingList(true);
    try {
      const candidateIds = Array.from(
        new Set(
          [preserveSelectedId, activeFamilyId, ...readStoredSamagraIds()].filter(
            (id): id is string => Boolean(id && id.trim())
          )
        )
      );

      if (candidateIds.length === 0) {
        setRegisteredFamilies([]);
        setLoadingList(false);
        return;
      }

      const fetched = await Promise.all(
        candidateIds.map(async id => {
          try {
            const res = await fetch(`/api/samagra/${encodeURIComponent(id)}`);
            if (!res.ok) return null;
            const data = await res.json();
            return (data?.family as SamagraFamily) || null;
          } catch {
            return null;
          }
        })
      );

      const dedupedMap = new Map<string, SamagraFamily>();
      for (const fam of fetched) {
        if (fam) dedupedMap.set(fam.familyId, fam);
      }
      const list = Array.from(dedupedMap.values());
      setRegisteredFamilies(list);

      const targetId = preserveSelectedId || activeFamilyId;
      if (targetId) {
        const match = list.find(
          f => f.familyId === targetId || f.members.some(m => m.memberId === targetId)
        );
        if (match) {
          setSelectedFamily(match);
        }
      } else if (list.length > 0 && !selectedFamily) {
        setSelectedFamily(list[0]);
      }
    } catch (err) {
      console.warn('Could not load linked Samagra households:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadRegisteredFamilies(activeFamilyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyId]);

  const executeSamagraLookup = async (
    rawQuery: string,
    autoLoadIntoProfile = false
  ) => {
    setErrorMsg(null);
    setErrorDetails(null);
    setSamagraPortalFallback(null);
    setStatusBanner(null);

    const validation = validateSamagraLookupId(rawQuery);
    if (!validation.valid) {
      setErrorMsg(
        validation.error ||
          'Enter an 8-digit Samagra Family ID or 9-digit Member ID (numeric digits only).'
      );
      return;
    }

    setSearching(true);
    try {
      const result = await verifySamagraId(validation.cleaned);

      if (result.ok && result.family) {
        const fam = result.family;
        rememberSamagraFamilyId(fam.familyId);
        setSelectedFamily(fam);
        setRegisteredFamilies(prev => [fam, ...prev.filter(f => f.familyId !== fam.familyId)]);
        setShowRegisterForm(false);
        const sourceNote = result.notice ? ` (${result.notice})` : '';
        const successText = `Fetched verified Samagra record for Family ID ${fam.familyId}${sourceNote}`;
        setStatusBanner(successText);
        onNotify?.({
          type: 'success',
          title: 'Samagra Record Verified',
          message: `${fam.headName} (Family ID ${fam.familyId}) verified successfully.`,
        });

        if (autoLoadIntoProfile && fam.members.length > 0) {
          const matchedMember =
            fam.members.find(m => m.memberId === validation.cleaned) || fam.members[0];
          onSelectMemberForProfile(matchedMember, fam);
        }
        return;
      }

      setSelectedFamily(null);
      setErrorMsg(result.error || `No verified Samagra record found for "${validation.cleaned}".`);
      setErrorDetails(result.details || null);
      setSamagraPortalFallback({
        searchedId: validation.cleaned,
        kind: validation.kind,
        error: result.error || `No verified Samagra record found for "${validation.cleaned}".`,
        details: result.details,
        portalUrl: result.portalUrl || SAMAGRA_PORTAL_URL,
        allowManualEntry: result.allowManualEntry ?? true,
      });
      onNotify?.({
        type: 'warning',
        title: 'Samagra Portal Lookup',
        message: result.error || `No verified Samagra record found for "${validation.cleaned}".`,
        details: result.details,
        actionUrl: result.portalUrl || SAMAGRA_PORTAL_URL,
        actionLabel: 'Open samagra.gov.in',
      });
    } catch {
      const msg = 'Unable to reach Samagra verification API endpoint. Please verify server connectivity.';
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searching) return;
    await executeSamagraLookup(searchId, false);
  };

  const handleDemoCredentialClick = async (cred: DemoCitizenCredential) => {
    if (searching || loadingDemoMemberId) return;
    setSearchId(cred.memberId);
    setLoadingDemoMemberId(cred.memberId);
    try {
      await executeSamagraLookup(cred.memberId, true);
    } finally {
      setLoadingDemoMemberId(null);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingFamily) return;
    setErrorMsg(null);
    setErrorDetails(null);
    setSamagraPortalFallback(null);
    setStatusBanner(null);

    const famValidation = validateSamagraFamilyId(regFamilyId);
    if (!famValidation.valid) {
      setErrorMsg(famValidation.error || 'Samagra Family ID must be exactly 8 numeric digits.');
      return;
    }

    const headMember = draftMembers[0];
    if (!headMember || !headMember.name.trim()) {
      setErrorMsg('Please enter the Head of Household full name.');
      return;
    }

    const seenMemberIds = new Set<string>();
    for (const m of draftMembers) {
      if (!m.name.trim()) {
        setErrorMsg('Every household member must have a full name.');
        return;
      }
      const memValidation = validateSamagraMemberId(m.memberId);
      if (!memValidation.valid) {
        setErrorMsg(`Member "${m.name}": ${memValidation.error}`);
        return;
      }
      if (seenMemberIds.has(memValidation.cleaned)) {
        setErrorMsg(
          `Duplicate 9-digit Samagra Member ID "${memValidation.cleaned}" detected in this form. Each family member must have a unique ID.`
        );
        return;
      }
      seenMemberIds.add(memValidation.cleaned);
    }

    const selectedWardInfo = IMC_WARDS.find(w => w.number === regWardNumber);
    const wardOrBlock =
      regAreaType === 'urban'
        ? `Ward ${regWardNumber} (${selectedWardInfo?.name || 'Indore IMC'})`
        : `${regBlockName} Janpad Panchayat`;

    const payload: SamagraFamily = {
      familyId: famValidation.cleaned,
      headName: headMember.name.trim(),
      areaType: regAreaType,
      wardOrBlock,
      address:
        regAddress.trim() ||
        (regAreaType === 'urban'
          ? `${selectedWardInfo?.name || 'Indore'}, Ward ${regWardNumber}, Indore, MP`
          : `${regBlockName} Block, Indore District, MP`),
      rationCardType: regRationCard,
      members: draftMembers.map(m => ({
        memberId: m.memberId.trim(),
        name: m.name.trim(),
        nameHindi: m.name.trim(),
        relation: m.relation.trim() || 'Member',
        relationHindi: m.relation.trim() || 'सदस्य',
        age: Math.max(0, Math.min(120, Number(m.age) || 0)),
        gender: m.gender,
        category: m.category,
        occupation: m.occupation,
        annualIncome: Math.max(0, Number(m.annualIncome) || 0),
        landHoldingHectares: Math.max(0, Number(m.landHoldingHectares) || 0),
        maritalStatus: m.maritalStatus,
        hasDisability: m.hasDisability,
        ekycStatus: m.ekycStatus,
        dbtActive: m.dbtActive,
      })),
    };

    setIsSavingFamily(true);
    try {
      const res = await fetch('/api/samagra/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const parsed = await parseApiResponse<{ family?: SamagraFamily }>(res);
      if (!parsed.ok || !parsed.data?.family) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Could not register Samagra household.',
        };
        setErrorMsg(errInfo.error);
        setErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title: parsed.status === 409 ? 'Duplicate Samagra ID' : 'Samagra Registration Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        return;
      }

      const registeredFamily = parsed.data.family;
      rememberSamagraFamilyId(registeredFamily.familyId);
      setSelectedFamily(registeredFamily);
      setSearchId(registeredFamily.familyId);
      setShowRegisterForm(false);
      const bannerMsg = `Registered Samagra Family ID ${registeredFamily.familyId} (${registeredFamily.members.length} member${registeredFamily.members.length > 1 ? 's' : ''}) in the database.`;
      setStatusBanner(bannerMsg);
      onNotify?.({
        type: 'success',
        title: 'Household Registered',
        message: `Samagra Family ID ${registeredFamily.familyId} saved.`,
      });
      setRegFamilyId('');
      setRegAddress('');
      setDraftMembers([createEmptyDraftMember(true)]);
      await loadRegisteredFamilies(registeredFamily.familyId);
      onFamiliesChanged?.();
    } catch {
      const msg = 'Network error while registering live Samagra household.';
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleToggleMemberVerification = async (
    familyId: string,
    member: FamilyMember,
    field: 'ekycStatus' | 'dbtActive'
  ) => {
    if (updatingMemberId) return;
    setUpdatingMemberId(member.memberId);
    setErrorMsg(null);
    setErrorDetails(null);
    try {
      const nextVal = !member[field];
      const res = await fetch(
        `/api/samagra/${encodeURIComponent(familyId)}/members/${encodeURIComponent(member.memberId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: nextVal }),
        }
      );
      const parsed = await parseApiResponse<{ family?: SamagraFamily }>(res);
      if (!parsed.ok || !parsed.data?.family) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Could not update member eKYC/DBT status.',
        };
        setErrorMsg(errInfo.error);
        setErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title: 'Verification Update Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        return;
      }

      const updatedFamily = parsed.data.family;
      setSelectedFamily(updatedFamily);
      setRegisteredFamilies(prev =>
        prev.map(f => (f.familyId === updatedFamily.familyId ? updatedFamily : f))
      );
      const statusText = `Updated ${member.name} (${member.memberId}): ${
        field === 'ekycStatus'
          ? nextVal
            ? 'Aadhaar eKYC marked Verified'
            : 'Aadhaar eKYC marked Pending'
          : nextVal
          ? 'NPCI Bank DBT marked Active'
          : 'NPCI Bank DBT marked Inactive'
      }.`;
      setStatusBanner(statusText);
      onFamiliesChanged?.();
    } catch {
      const msg = 'Could not update member eKYC/DBT status due to a network error.';
      setErrorMsg(msg);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const getMemberEligibleCount = (member: FamilyMember, family: SamagraFamily) => {
    const wardMatch = family.wardOrBlock.match(/ward\s*(\d+)/i);
    const wardNum = wardMatch ? Number(wardMatch[1]) : 1;
    const blockLower = family.wardOrBlock.toLowerCase();
    const blockName: JanpadBlock = blockLower.includes('depalpur')
      ? 'Depalpur'
      : blockLower.includes('mhow')
      ? 'Mhow'
      : blockLower.includes('sanwer')
      ? 'Sanwer'
      : 'Indore';

    const tempProfile = {
      fullName: member.name,
      age: member.age,
      gender: member.gender,
      category: member.category || ('GEN' as Category),
      areaType: family.areaType,
      wardNumber: family.areaType === 'urban' ? wardNum : undefined,
      blockName: family.areaType === 'rural' ? blockName : undefined,
      annualIncome: member.annualIncome ?? (family.rationCardType === 'BPL' ? 120000 : 250000),
      occupation: member.occupation,
      landHoldingHectares: member.landHoldingHectares ?? (member.occupation === 'Farmer' ? 1.5 : 0),
      isBPL: family.rationCardType === 'BPL' || family.rationCardType === 'Antyodaya',
      hasDisability: Boolean(member.hasDisability),
      disabilityPercent: member.hasDisability ? 45 : 0,
      maritalStatus: member.maritalStatus || ('Married' as MaritalStatus),
      isMpDomicile: true,
      isIndoreResident: true,
      samagraFamilyId: family.familyId,
      samagraMemberId: member.memberId,
      verifiedDocuments: {
        samagra_family: { verified: true, source: 'mp_edistrict' as const },
        samagra_member: { verified: member.ekycStatus, source: 'mp_edistrict' as const },
        aadhaar: { verified: member.ekycStatus, source: 'digilocker' as const },
        bank_dbt: { verified: member.dbtActive, source: 'digilocker' as const },
      },
    };
    const results = rankSchemesForCitizen(tempProfile, schemes);
    return results.filter(r => r.status === 'eligible' || r.status === 'likely').length;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
              {t('Live Samagra Portal Registry', 'लाइव समग्र पोर्टल रजिस्ट्री', 'लाइव समग्र पोर्टल खाता')}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {t(
              'Live Samagra Family ID Portal & Household Sync',
              'समग्र परिवार आईडी (लाइव पंजीयन एवं प्रोफाइल)',
              'समग्र कुटुंब खाता (लाइव खोज व पंजीयन)'
            )}
          </h2>
          <p className="text-sm text-slate-500">
            {t(
              'Search your official Samagra Family/Member ID or register your verified household below for eligibility matching. Connect Official DigiLocker separately to verify government certificates.',
              'अपनी आधिकारिक समग्र परिवार/सदस्य आईडी खोजें या पात्रता जांच के लिए नीचे अपना परिवार पंजीकृत करें। सरकारी प्रमाण पत्रों के लिए डिजिलॉकर अलग से जोड़ें।',
              'तमारी सरकारी समग्र कुटुंब या सदस्य आईडी खोजो या योजना जांच खातर नीचे अपणो कुटुंब दर्ज करो। सरकारी कागद खातर डिजिलॉकर अलग सूं जोड़ सको छो।'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadRegisteredFamilies(selectedFamily?.familyId)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            <span>{t('Refresh', 'रिफ्रेश', 'ताजा करो')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRegisterForm(prev => !prev);
              setErrorMsg(null);
              setErrorDetails(null);
              setSamagraPortalFallback(null);
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {showRegisterForm
                ? t('Close Registration Form', 'पंजीयन फॉर्म बंद करें', 'फॉर्म बंद करो')
                : t('Register New Samagra Family', 'नया समग्र परिवार जोड़ें', 'नयो समग्र कुटुंब जोड़ो')}
            </span>
          </button>
        </div>
      </div>

      {/* Status / Error Alerts */}
      {statusBanner && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusBanner}</span>
          </div>
          <button type="button" onClick={() => setStatusBanner(null)} className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2.5" role="alert">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{errorMsg}</p>
                {errorDetails && (
                  <p className="text-rose-700 font-normal leading-relaxed">{errorDetails}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setErrorDetails(null);
                setSamagraPortalFallback(null);
              }}
              className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
          {samagraPortalFallback && (
            <div className="flex flex-wrap items-center gap-3 pl-6 pt-1">
              <a
                href={samagraPortalFallback.portalUrl || SAMAGRA_PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-300 text-rose-900 font-bold hover:bg-rose-100 transition"
              >
                <span>Open Official Portal (samagra.gov.in)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {samagraPortalFallback.allowManualEntry !== false && (
                <button
                  type="button"
                  onClick={() => {
                    if (samagraPortalFallback.kind === 'family' && samagraPortalFallback.searchedId) {
                      setRegFamilyId(samagraPortalFallback.searchedId);
                    } else if (samagraPortalFallback.kind === 'member' && samagraPortalFallback.searchedId) {
                      setDraftMembers(prev =>
                        prev.map((m, i) =>
                          i === 0 ? { ...m, memberId: samagraPortalFallback.searchedId } : m
                        )
                      );
                    }
                    setShowRegisterForm(true);
                    setErrorMsg(null);
                    setErrorDetails(null);
                    setSamagraPortalFallback(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Enter &amp; Verify Household Manually</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Demo Test Credentials Helper Card (Indore 6-Tier Profiles) */}
      <DemoCredentialsCard
        currentLanguage={currentLanguage}
        activeMemberId={activeMemberId}
        loadingMemberId={loadingDemoMemberId}
        onSelectDemoCredential={handleDemoCredentialClick}
        compact
      />

      {/* Search Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-amber-600" />
            </div>
            <input
              type="text"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              placeholder={t(
                'Enter registered 8-digit Samagra Family ID or 9-digit Member ID...',
                '8-अंकीय समग्र परिवार आईडी या 9-अंकीय सदस्य आईडी दर्ज करें...',
                '8 अंक रो समग्र कुटुंब नंबर या 9 अंक रो सदस्य नंबर लिखो...'
              )}
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>{t('Fetch Live Samagra Profile', 'समग्र प्रोफाइल खोजें', 'समग्र खाता खोजो')}</span>
          </button>
        </form>

        {/* Session-Linked Samagra Households Strip */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-600 font-semibold">
              {t(
                `Your Linked Samagra Households (${registeredFamilies.length}):`,
                `आपके जुड़े समग्र परिवार (${registeredFamilies.length}):`,
                `तमारा जुड़योड़ा समग्र कुटुंब (${registeredFamilies.length}):`
              )}
            </span>
            {registeredFamilies.length === 0 && !loadingList && (
              <span className="text-amber-700 font-medium">
                {t(
                  'Enter your 8-digit Samagra Family ID above or click "Register New Samagra Family".',
                  'ऊपर अपनी 8-अंकीय समग्र परिवार आईडी दर्ज करें या "नया समग्र परिवार जोड़ें" पर क्लिक करें।',
                  'ऊपर 8 अंक रो समग्र कुटुंब नंबर लिखो या "नयो समग्र कुटुंब जोड़ो" दबावो।'
                )}
              </span>
            )}
          </div>
          {registeredFamilies.length > 0 && (
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {registeredFamilies.map(fam => (
                <button
                  key={fam.familyId}
                  type="button"
                  onClick={() => {
                    setSearchId(fam.familyId);
                    setSelectedFamily(fam);
                    setErrorMsg(null);
                    setErrorDetails(null);
                    setSamagraPortalFallback(null);
                    setShowRegisterForm(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition cursor-pointer ${
                    selectedFamily?.familyId === fam.familyId
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono font-bold">{fam.familyId}</span> · {fam.headName} ({fam.members.length})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Live Samagra Registration Builder */}
      {showRegisterForm && (
        <form
          onSubmit={handleRegisterSubmit}
          className="bg-white rounded-3xl border-2 border-amber-300 shadow-md p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                {t('Samagra Family Registration', 'समग्र परिवार पंजीयन', 'समग्र कुटुंब पंजीयन')}
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                {t(
                  'Enter Official Household Details from Samagra Portal',
                  'समग्र पोर्टल के अनुसार परिवार का विवरण दर्ज करें',
                  'समग्र पोर्टल रा हिसाब सूं कुटुंब री जानकारी भरो'
                )}
              </h3>
            </div>
            <a
              href={SAMAGRA_PORTAL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 underline"
            >
              <span>{t('Check ID on samagra.gov.in', 'samagra.gov.in पर आईडी जांचें', 'samagra.gov.in पर नंबर देखो')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Household Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('8-Digit Samagra Family ID *', '8-अंकीय समग्र परिवार आईडी *', '8 अंक रो समग्र कुटुंब नंबर *')}
              </label>
              <input
                type="text"
                value={regFamilyId}
                onChange={e => setRegFamilyId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                placeholder={t('Enter 8-digit Family ID', '8-अंकीय परिवार आईडी लिखें', '8 अंक रो कुटुंब नंबर लिखो')}
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Jurisdiction Type *', 'क्षेत्र प्रकार *', 'शहर या गाँव *')}
              </label>
              <select
                value={regAreaType}
                onChange={e => setRegAreaType(e.target.value as AreaType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="urban">
                  {t('Urban (Indore IMC Ward 1–85)', 'शहरी (इंदौर नगर निगम वार्ड 1–85)', 'शहर (इंदौर नगर निगम वार्ड 1–85)')}
                </option>
                <option value="rural">
                  {t('Rural (Indore Janpad Block)', 'ग्रामीण (इंदौर जनपद ब्लॉक)', 'गाँव (इंदौर जनपद ब्लॉक)')}
                </option>
              </select>
            </div>

            {regAreaType === 'urban' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('IMC Ward *', 'नगर निगम वार्ड *', 'नगर निगम वार्ड *')}
                </label>
                <select
                  value={regWardNumber}
                  onChange={e => setRegWardNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {IMC_WARDS.map(w => (
                    <option key={w.number} value={w.number}>
                      {t(`Ward ${w.number}: ${w.name}`, `वार्ड ${w.number}: ${w.name}`, `वार्ड ${w.number}: ${w.name}`)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Janpad Block *', 'जनपद ब्लॉक *', 'जनपद ब्लॉक *')}
                </label>
                <select
                  value={regBlockName}
                  onChange={e => setRegBlockName(e.target.value as JanpadBlock)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {JANPAD_BLOCKS.map(b => (
                    <option key={b.name} value={b.name}>
                      {t(`${b.name} Janpad`, `${b.name} जनपद`, `${b.name} जनपद`)} ({b.panchayatCount}{' '}
                      {t('Panchayats', 'पंचायतें', 'पंचायत')})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Ration Card Category *', 'राशन कार्ड श्रेणी *', 'राशन कार्ड री श्रेणी *')}
              </label>
              <select
                value={regRationCard}
                onChange={e => setRegRationCard(e.target.value as 'APL' | 'BPL' | 'Antyodaya')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="APL">{t('APL (Above Poverty Line)', 'एपीएल (सामान्य राशन कार्ड)', 'एपीएल (सफेद राशन कार्ड)')}</option>
                <option value="BPL">{t('BPL (Below Poverty Line)', 'बीपीएल (गरीबी रेखा से नीचे)', 'बीपीएल (पीलो राशन कार्ड)')}</option>
                <option value="Antyodaya">{t('Antyodaya (AAY)', 'अंत्योदय (AAY)', 'अंत्योदय (AAY)')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Residential Address in Indore District', 'इंदौर जिले का आवासीय पता', 'इंदौर जिला रो घर रो पतो')}
            </label>
            <input
              type="text"
              value={regAddress}
              onChange={e => setRegAddress(e.target.value)}
              placeholder={t(
                'House / Street / Colony / Village name in Indore District',
                'मकान नंबर / गली / कॉलोनी / गांव का नाम लिखें',
                'मकान / मोहल्लो / कॉलोनी / गाँव रो नाम लिखो'
              )}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Household Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {t(
                  `Household Members (${draftMembers.length})`,
                  `परिवार के सदस्य (${draftMembers.length})`,
                  `कुटुंब रा सदस्य (${draftMembers.length})`
                )}
              </h4>
              <button
                type="button"
                onClick={() => setDraftMembers(prev => [...prev, createEmptyDraftMember(false)])}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('Add Family Member', 'सदस्य जोड़ें', 'नयो सदस्य जोड़ो')}</span>
              </button>
            </div>

            <div className="space-y-4">
              {draftMembers.map((member, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      {idx === 0
                        ? t('Member 1 (Head of Household)', 'सदस्य 1 (परिवार का मुखिया)', 'सदस्य 1 (घर रो मुखिया)')
                        : t(`Member ${idx + 1}`, `सदस्य ${idx + 1}`, `सदस्य ${idx + 1}`)}
                    </span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setDraftMembers(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('Remove', 'हटाएं', 'हटावो')}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Full Name *', 'पूरा नाम *', 'पूरो नाम *')}
                      </label>
                      <input
                        type="text"
                        required
                        value={member.name}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) => (i === idx ? { ...m, name: e.target.value } : m))
                          )
                        }
                        placeholder={t('Citizen full name', 'नागरिक का पूरा नाम', 'सदस्य रो पूरो नाम')}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('9-Digit Member ID *', '9-अंकीय सदस्य आईडी *', '9 अंक रो सदस्य नंबर *')}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={t('Enter 9-digit Member ID', '9-अंकीय सदस्य आईडी', '9 अंक रो सदस्य नंबर')}
                        value={member.memberId}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx
                                ? { ...m, memberId: e.target.value.replace(/\D/g, '').slice(0, 9) }
                                : m
                            )
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Relation', 'संबंध', 'नातो / संबंध')}
                      </label>
                      <input
                        type="text"
                        value={member.relation}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) => (i === idx ? { ...m, relation: e.target.value } : m))
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {t('Age', 'आयु', 'उमर')}
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          value={member.age}
                          onChange={e =>
                            setDraftMembers(prev =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, age: Number(e.target.value) } : m
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          {t('Gender', 'लिंग', 'लिंग')}
                        </label>
                        <select
                          value={member.gender}
                          onChange={e =>
                            setDraftMembers(prev =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, gender: e.target.value as Gender } : m
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          <option value="female">{getGenderLabel('female', currentLanguage)}</option>
                          <option value="male">{getGenderLabel('male', currentLanguage)}</option>
                          <option value="transgender">{getGenderLabel('transgender', currentLanguage)}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Occupation', 'व्यवसाय', 'काम-धंधो')}
                      </label>
                      <select
                        value={member.occupation}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, occupation: e.target.value as OccupationType } : m
                            )
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      >
                        {OCCUPATIONS.map(occ => (
                          <option key={occ} value={occ}>
                            {getOccupationLabel(occ, currentLanguage)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Category / Marital', 'वर्ग / वैवाहिक', 'वर्ग / ब्याह स्थिति')}
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={member.category}
                          onChange={e =>
                            setDraftMembers(prev =>
                              prev.map((m, i) =>
                                i === idx ? { ...m, category: e.target.value as Category } : m
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>
                              {getCategoryLabel(c, currentLanguage)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={member.maritalStatus}
                          onChange={e =>
                            setDraftMembers(prev =>
                              prev.map((m, i) =>
                                i === idx
                                  ? { ...m, maritalStatus: e.target.value as MaritalStatus }
                                  : m
                              )
                            )
                          }
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                        >
                          {MARITAL_STATUSES.map(ms => (
                            <option key={ms} value={ms}>
                              {getMaritalLabel(ms, currentLanguage)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Annual Income (₹)', 'वार्षिक आय (₹)', 'सालाना कमाई (₹)')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={5000}
                        value={member.annualIncome}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, annualIncome: Number(e.target.value) } : m
                            )
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {t('Land Holding (Ha)', 'कृषि भूमि (हेक्टेयर)', 'खेती री जमीन (हेक्टेयर)')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.1}
                        value={member.landHoldingHectares}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx
                                ? { ...m, landHoldingHectares: Number(e.target.value) }
                                : m
                            )
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 pt-1 text-xs text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.ekycStatus}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, ekycStatus: e.target.checked } : m
                            )
                          )
                        }
                        className="rounded text-emerald-600"
                      />
                      <span>{t('Aadhaar eKYC Verified', 'आधार eKYC सत्यापित', 'आधार eKYC पक्को छे')}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.dbtActive}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, dbtActive: e.target.checked } : m
                            )
                          )
                        }
                        className="rounded text-emerald-600"
                      />
                      <span>{t('NPCI Bank DBT Enabled', 'बैंक DBT सक्रिय', 'बैंक खाता मां DBT चालू')}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={member.hasDisability}
                        onChange={e =>
                          setDraftMembers(prev =>
                            prev.map((m, i) =>
                              i === idx ? { ...m, hasDisability: e.target.checked } : m
                            )
                          )
                        }
                        className="rounded text-amber-600"
                      />
                      <span>{t('Divyang (40%+)', 'दिव्यांग (40%+)', 'दिव्यांग (40%+)')}</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowRegisterForm(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {t('Cancel', 'रद्द करें', 'रद्द करो')}
            </button>
            <button
              type="submit"
              disabled={isSavingFamily}
              className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isSavingFamily ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{t('Save Samagra Household', 'समग्र परिवार सहेजें', 'समग्र कुटुंब सहेजो')}</span>
            </button>
          </div>
        </form>
      )}

      {/* Empty State when no household is registered or selected */}
      {!selectedFamily && !showRegisterForm && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Users className="w-7 h-7" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">
              {t(
                'No Samagra Household Linked Yet',
                'अभी कोई समग्र परिवार लिंक नहीं है',
                'अभी कोई समग्र कुटुंब जुड़यो नी छे'
              )}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t(
                'Register a live Samagra Family ID (8-digit) and Member ID (9-digit) to run real-time eligibility matching, persistent DigiLocker Wallet verification, and end-to-end application tracking.',
                'लाइव पात्रता जांच, डिजिलॉकर दस्तावेज़ सत्यापन और आवेदन ट्रैकिंग के लिए अपनी 8-अंकीय समग्र परिवार आईडी और 9-अंकीय सदस्य आईडी दर्ज करें।',
                'सही योजना जांच, डिजिलॉकर कागद सत्यापन अने अर्जी ट्रैकिंग खातर अपणो 8 अंक रो समग्र कुटुंब नंबर अने 9 अंक रो सदस्य नंबर दर्ज करो।'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterForm(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>
              {t(
                'Register Your Live Samagra Household',
                'अपना समग्र परिवार पंजीकृत करें',
                'अपणो समग्र कुटुंब दर्ज करो'
              )}
            </span>
          </button>
        </div>
      )}

      {/* Family Tree Card Display */}
      {selectedFamily && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Family Header Banner */}
          <div className="bg-slate-900 text-white p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase">
                <ShieldCheck className="w-4 h-4" />
                <span>
                  {t(
                    'Live Samagra Family Record (SPR Synced)',
                    'लाइव समग्र परिवार रिकॉर्ड (SPR सिंक)',
                    'लाइव समग्र कुटुंब रिकॉर्ड'
                  )}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black mt-1 font-heading">
                {t('Family ID:', 'परिवार आईडी:', 'कुटुंब नंबर:')}{' '}
                <span className="font-mono text-amber-400">{selectedFamily.familyId}</span> •{' '}
                {t('Head:', 'मुखिया:', 'मुखिया:')} {selectedFamily.headName}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1.5">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedFamily.wardOrBlock}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {t('Ration Card:', 'राशन कार्ड:', 'राशन कार्ड:')}{' '}
                    <strong className="text-white">{selectedFamily.rationCardType}</strong>
                  </span>
                </span>
                <span className="text-slate-400">{selectedFamily.address}</span>
              </div>
            </div>

            <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700 text-center shrink-0">
              <div className="text-xs text-slate-400">
                {t('Members Mapped', 'कुल सदस्य', 'कुल सदस्य')}
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {selectedFamily.members.length}
              </div>
            </div>
          </div>

          {/* Family Members Grid */}
          <div className="p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>
                {t(
                  'Household Members — Toggle Live eKYC/DBT or Load into Citizen Profile:',
                  'परिवार के सदस्य — eKYC/DBT बदलें या नागरिक प्रोफाइल में लोड करें:',
                  'कुटुंब रा सदस्य — eKYC/DBT बदलो या योजना जांच खातर सदस्य चुनो:'
                )}
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectedFamily.members.map(member => {
                const matchCount = getMemberEligibleCount(member, selectedFamily);
                const isActiveMember = activeMemberId === member.memberId;
                const isUpdating = updatingMemberId === member.memberId;

                return (
                  <div
                    key={member.memberId}
                    className={`rounded-2xl border p-5 flex flex-col justify-between transition ${
                      isActiveMember
                        ? 'bg-amber-50/40 border-amber-400 ring-2 ring-amber-200'
                        : 'bg-slate-50 border-slate-200 hover:border-amber-300 hover:bg-white'
                    }`}
                  >
                    <div>
                      {/* Top ID & Relation */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                          {currentLanguage === 'en' ? member.relation : member.relationHindi || member.relation}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          ID: {member.memberId}
                        </span>
                      </div>

                      {/* Name & Age */}
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-base font-bold text-slate-900">
                          {currentLanguage === 'en' ? member.name : member.nameHindi || member.name}
                        </h5>
                        {isActiveMember && (
                          <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                            {t('Active', 'सक्रिय', 'चालू')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {member.age} {t('yrs', 'वर्ष', 'बरस')} • {getGenderLabel(member.gender, currentLanguage)} •{' '}
                        {getCategoryLabel(member.category || 'GEN', currentLanguage)} •{' '}
                        {getOccupationLabel(member.occupation, currentLanguage)}
                      </p>

                      {/* Live Interactive eKYC & DBT Verification Controls */}
                      <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">{t('Aadhaar eKYC:', 'आधार eKYC:', 'आधार eKYC:')}</span>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleToggleMemberVerification(
                                selectedFamily.familyId,
                                member,
                                'ekycStatus'
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                              member.ekycStatus
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            {member.ekycStatus ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {member.ekycStatus
                                ? t('Verified', 'सत्यापित', 'पक्को')
                                : t('Verify eKYC', 'eKYC करें', 'eKYC करो')}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">{t('NPCI Bank DBT:', 'बैंक DBT:', 'बैंक DBT:')}</span>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() =>
                              handleToggleMemberVerification(
                                selectedFamily.familyId,
                                member,
                                'dbtActive'
                              )
                            }
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold transition cursor-pointer ${
                              member.dbtActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            }`}
                          >
                            {member.dbtActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {member.dbtActive
                                ? t('DBT Active', 'DBT सक्रिय', 'DBT चालू')
                                : t('Activate DBT', 'DBT चालू करें', 'DBT चालू करो')}
                            </span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">
                            {t('Annual Income:', 'वार्षिक आय:', 'सालाना कमाई:')}
                          </span>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{(member.annualIncome ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Scheme Count Preview */}
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex justify-between items-center">
                        <span className="font-semibold text-amber-900">
                          {t('Matched Schemes:', 'पात्र योजनाएं:', 'मिलती योजना:')}
                        </span>
                        <span className="font-black text-amber-700 font-mono text-sm">
                          {matchCount}
                        </span>
                      </div>
                    </div>

                    {/* Action Button */}
                    <button
                      type="button"
                      onClick={() => onSelectMemberForProfile(member, selectedFamily)}
                      className="mt-4 w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-amber-600 text-white transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>
                        {t(
                          'Load Citizen & Sync DigiLocker',
                          'प्रोफाइल लोड करें व डिजिलॉकर जोड़ें',
                          'ई सदस्य ने चुनो व योजना देखो'
                        )}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
