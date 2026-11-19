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

interface SamagraFamilyViewProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  activeFamilyId?: string;
  activeMemberId?: string;
  onSelectMemberForProfile: (member: FamilyMember, family: SamagraFamily) => void;
  onFamiliesChanged?: () => void;
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

function generateSamagraFamilyId(): string {
  return String(Math.floor(40000000 + Math.random() * 59999999));
}

function generateSamagraMemberId(): string {
  return String(Math.floor(100000000 + Math.random() * 899999999));
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
    memberId: generateSamagraMemberId(),
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
    ekycStatus: true,
    dbtActive: true,
  };
}

export const SamagraFamilyView: React.FC<SamagraFamilyViewProps> = ({
  currentLanguage,
  schemes,
  activeFamilyId,
  activeMemberId,
  onSelectMemberForProfile,
  onFamiliesChanged,
}) => {
  const [searchId, setSearchId] = useState(activeFamilyId || '');
  const [registeredFamilies, setRegisteredFamilies] = useState<SamagraFamily[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<SamagraFamily | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [searching, setSearching] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Registration Form State
  const [regFamilyId, setRegFamilyId] = useState(() => generateSamagraFamilyId());
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
      const res = await fetch('/api/samagra');
      if (res.ok) {
        const data = await res.json();
        const list: SamagraFamily[] = Array.isArray(data?.families) ? data.families : [];
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
      }
    } catch (err) {
      console.warn('Could not load live Samagra registry:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadRegisteredFamilies(activeFamilyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFamilyId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);
    const cleaned = searchId.trim();
    if (!cleaned) {
      setErrorMsg('Enter an 8-digit Samagra Family ID or 9-digit Member ID to fetch live records.');
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/samagra/${encodeURIComponent(cleaned)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.family) {
          setSelectedFamily(data.family);
          setShowRegisterForm(false);
          setStatusBanner(`Fetched live Samagra record for Family ID ${data.family.familyId} from SQLite.`);
          return;
        }
      }
      setSelectedFamily(null);
      setErrorMsg(
        `No live Samagra record found for "${cleaned}". Register this household below to simulate live Samagra & DigiLocker sync.`
      );
    } catch {
      setErrorMsg('Unable to reach live Samagra API endpoint. Please verify server connectivity.');
    } finally {
      setSearching(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusBanner(null);

    const cleanFamId = regFamilyId.trim();
    if (!/^\d{8}$/.test(cleanFamId)) {
      setErrorMsg('Samagra Family ID must be exactly 8 numeric digits.');
      return;
    }

    const headMember = draftMembers[0];
    if (!headMember || !headMember.name.trim()) {
      setErrorMsg('Please enter the Head of Household full name.');
      return;
    }

    for (const m of draftMembers) {
      if (!m.name.trim()) {
        setErrorMsg('Every household member must have a full name.');
        return;
      }
      if (!/^\d{9}$/.test(m.memberId.trim())) {
        setErrorMsg(`Member "${m.name}" must have a valid 9-digit Samagra Member ID.`);
        return;
      }
    }

    const selectedWardInfo = IMC_WARDS.find(w => w.number === regWardNumber);
    const wardOrBlock =
      regAreaType === 'urban'
        ? `Ward ${regWardNumber} (${selectedWardInfo?.name || 'Indore IMC'})`
        : `${regBlockName} Janpad Panchayat`;

    const payload: SamagraFamily = {
      familyId: cleanFamId,
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

      const data = await res.json();
      if (!res.ok || !data?.family) {
        setErrorMsg(data?.error || 'Could not register Samagra household.');
        return;
      }

      setSelectedFamily(data.family);
      setSearchId(data.family.familyId);
      setShowRegisterForm(false);
      setStatusBanner(
        `Registered live Samagra Family ID ${data.family.familyId} (${data.family.members.length} member${data.family.members.length > 1 ? 's' : ''}) and synced initial eKYC/DBT credentials to DigiLocker Wallet.`
      );
      setRegFamilyId(generateSamagraFamilyId());
      setRegAddress('');
      setDraftMembers([createEmptyDraftMember(true)]);
      await loadRegisteredFamilies(data.family.familyId);
      onFamiliesChanged?.();
    } catch {
      setErrorMsg('Network error while registering live Samagra household.');
    } finally {
      setIsSavingFamily(false);
    }
  };

  const handleToggleMemberVerification = async (
    familyId: string,
    member: FamilyMember,
    field: 'ekycStatus' | 'dbtActive'
  ) => {
    setUpdatingMemberId(member.memberId);
    setErrorMsg(null);
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
      const data = await res.json();
      if (res.ok && data?.family) {
        setSelectedFamily(data.family);
        setRegisteredFamilies(prev =>
          prev.map(f => (f.familyId === data.family.familyId ? data.family : f))
        );
        setStatusBanner(
          `Updated ${member.name} (${member.memberId}): ${
            field === 'ekycStatus'
              ? nextVal
                ? 'Aadhaar eKYC Verified & synced to DigiLocker'
                : 'Aadhaar eKYC marked Pending'
              : nextVal
              ? 'NPCI Bank DBT Activated & synced to DigiLocker'
              : 'NPCI Bank DBT marked Inactive'
          }.`
        );
        onFamiliesChanged?.();
      }
    } catch {
      setErrorMsg('Could not update member eKYC/DBT status.');
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
              Live Samagra ID Integration • Real-Time SQLite Registry
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'समग्र परिवार आईडी (लाइव पंजीयन एवं प्रोफाइल)'
              : currentLanguage === 'malwi'
              ? 'समग्र कुटुंब खाता (लाइव खोज व पंजीयन)'
              : 'Live Samagra Family ID Portal & Household Sync'}
          </h2>
          <p className="text-sm text-slate-500">
            Search an existing Samagra Family/Member ID or register a live household below to auto-sync Aadhaar eKYC, NPCI DBT, and DigiLocker Wallet eligibility.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadRegisteredFamilies(selectedFamily?.familyId)}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowRegisterForm(prev => !prev);
              setErrorMsg(null);
            }}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showRegisterForm ? 'Close Registration Form' : 'Register New Samagra Family'}</span>
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
          <button type="button" onClick={() => setStatusBanner(null)} className="text-emerald-700 hover:text-emerald-950 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-700 hover:text-rose-950 font-bold">
            ✕
          </button>
        </div>
      )}

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
              placeholder="Enter registered 8-digit Samagra Family ID or 9-digit Member ID..."
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Fetch Live Samagra Profile</span>
          </button>
        </form>

        {/* Live Registered Households Directory Strip */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-600 font-semibold">
              Live Registered Households in Database ({registeredFamilies.length}):
            </span>
            {registeredFamilies.length === 0 && !loadingList && (
              <span className="text-amber-700 font-medium">
                No households registered yet — click "Register New Samagra Family" to begin live simulation.
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
                Live Samagra Family Registration
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-1">
                Create Real-Time Household & Sync to DigiLocker
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setRegFamilyId(generateSamagraFamilyId())}
              className="text-xs font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
            >
              Generate Fresh 8-Digit Family ID
            </button>
          </div>

          {/* Household Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                8-Digit Samagra Family ID *
              </label>
              <input
                type="text"
                value={regFamilyId}
                onChange={e => setRegFamilyId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                required
                placeholder="e.g. 52910483"
                className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jurisdiction Type *
              </label>
              <select
                value={regAreaType}
                onChange={e => setRegAreaType(e.target.value as AreaType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="urban">Urban (Indore IMC Ward 1–85)</option>
                <option value="rural">Rural (Indore Janpad Block)</option>
              </select>
            </div>

            {regAreaType === 'urban' ? (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  IMC Ward *
                </label>
                <select
                  value={regWardNumber}
                  onChange={e => setRegWardNumber(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {IMC_WARDS.map(w => (
                    <option key={w.number} value={w.number}>
                      Ward {w.number}: {w.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Janpad Block *
                </label>
                <select
                  value={regBlockName}
                  onChange={e => setRegBlockName(e.target.value as JanpadBlock)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  {JANPAD_BLOCKS.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name} Janpad ({b.panchayatCount} Panchayats)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ration Card Category *
              </label>
              <select
                value={regRationCard}
                onChange={e => setRegRationCard(e.target.value as 'APL' | 'BPL' | 'Antyodaya')}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="APL">APL (Above Poverty Line)</option>
                <option value="BPL">BPL (Below Poverty Line)</option>
                <option value="Antyodaya">Antyodaya (AAY)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Residential Address in Indore District
            </label>
            <input
              type="text"
              value={regAddress}
              onChange={e => setRegAddress(e.target.value)}
              placeholder="House / Street / Colony / Village name in Indore District"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Household Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Household Members ({draftMembers.length})
              </h4>
              <button
                type="button"
                onClick={() => setDraftMembers(prev => [...prev, createEmptyDraftMember(false)])}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Family Member</span>
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
                      {idx === 0 ? 'Member 1 (Head of Household)' : `Member ${idx + 1}`}
                    </span>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => setDraftMembers(prev => prev.filter((_, i) => i !== idx))}
                        className="text-xs text-rose-600 hover:text-rose-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Full Name *
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
                        placeholder="Citizen full name"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        9-Digit Member ID *
                      </label>
                      <input
                        type="text"
                        required
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
                        Relation
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
                          Age
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
                          Gender
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
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="transgender">Other</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Occupation
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
                            {occ}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Category / Marital
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
                              {c}
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
                              {ms}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Annual Income (₹)
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
                        Land Holding (Ha)
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
                      <span>Aadhaar eKYC Verified</span>
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
                      <span>NPCI Bank DBT Enabled</span>
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
                      <span>Divyang (40%+)</span>
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
              Cancel
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
              <span>Save Live Samagra Family & Sync Wallet</span>
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
              No Samagra Household Linked Yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Demo profiles have been completely removed. Register a live Samagra Family ID (8-digit) and Member ID (9-digit) to run real-time eligibility matching, persistent DigiLocker Wallet verification, and end-to-end application tracking.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterForm(true)}
            className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Your Live Samagra Household</span>
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
                <span>Live Samagra Family Record (SPR Synced)</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black mt-1 font-heading">
                Family ID: <span className="font-mono text-amber-400">{selectedFamily.familyId}</span> • Head: {selectedFamily.headName}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1.5">
                <span className="flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>{selectedFamily.wardOrBlock}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    Ration Card: <strong className="text-white">{selectedFamily.rationCardType}</strong>
                  </span>
                </span>
                <span className="text-slate-400">{selectedFamily.address}</span>
              </div>
            </div>

            <div className="bg-slate-800 px-4 py-2.5 rounded-2xl border border-slate-700 text-center shrink-0">
              <div className="text-xs text-slate-400">Members Mapped</div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {selectedFamily.members.length}
              </div>
            </div>
          </div>

          {/* Family Members Grid */}
          <div className="p-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <span>Household Members — Toggle Live eKYC/DBT or Load into Citizen Profile:</span>
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
                          {member.relation}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          ID: {member.memberId}
                        </span>
                      </div>

                      {/* Name & Age */}
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-base font-bold text-slate-900">{member.name}</h5>
                        {isActiveMember && (
                          <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {member.age} yrs • {member.gender.toUpperCase()} • {member.category || 'GEN'} • {member.occupation}
                      </p>

                      {/* Live Interactive eKYC & DBT Verification Controls */}
                      <div className="mt-4 pt-3 border-t border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">Aadhaar eKYC:</span>
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
                            title="Toggle live Aadhaar eKYC status"
                          >
                            {member.ekycStatus ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{member.ekycStatus ? 'Verified' : 'Verify eKYC'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-600">NPCI Bank DBT:</span>
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
                            title="Toggle live NPCI Bank DBT seeding status"
                          >
                            {member.dbtActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5" />
                            )}
                            <span>{member.dbtActive ? 'DBT Active' : 'Activate DBT'}</span>
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Annual Income:</span>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{(member.annualIncome ?? 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      {/* Scheme Count Preview */}
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs flex justify-between items-center">
                        <span className="font-semibold text-amber-900">Matched Schemes:</span>
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
                      <span>Load Citizen & Sync DigiLocker</span>
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
