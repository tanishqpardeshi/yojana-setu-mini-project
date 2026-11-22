import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  ArrowRight,
  Sliders,
  MapPin,
  ExternalLink,
  Info,
  Bookmark,
  Check,
  RefreshCw,
  Globe,
  ShieldCheck,
  Loader2,
  Plus,
  Minus,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock,
  PhoneCall,
} from 'lucide-react';
import {
  CitizenProfile,
  Scheme,
  SchemeEligibilityResult,
  SchemesRealtimeReport,
  SupportedLanguage,
  JanpadBlock,
  Category,
  Gender,
  OccupationType,
  MaritalStatus,
} from '../types';
import { IMC_WARDS, JANPAD_BLOCKS } from '../data/indoreGovernance';
import { rankSchemesForCitizen } from '../utils/rulesEngine';
import { getOfficialPortalDisplayHost, resolveSchemePortalUrl } from '../utils/liveDataEngine';
import { getSchemeApplicationProcedure } from '../utils/schemeProcedures';
import {
  DOCUMENT_LABELS,
  getCategoryLabel,
  getDocumentLabel,
  getFrequencyLabel,
  getGenderLabel,
  getGovernanceLevelLabel,
  getMaritalLabel,
  getOccupationLabel,
  getRealtimeReportText,
  getSchemeDescription,
  getSchemeTitle,
  pickText,
} from '../utils/i18n';

export const DOCUMENT_NAMES: Record<string, { en: string; hi: string; malwi: string }> = DOCUMENT_LABELS;

const AGE_MIN = 0;
const AGE_MAX = 120;
const INCOME_MIN = 0;
const INCOME_MAX = 10000000;
const INCOME_STEP = 10000;

interface EligibilityCalculatorProps {
  schemes: Scheme[];
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  setProfile: React.Dispatch<React.SetStateAction<CitizenProfile>>;
  citizenKey: string | null;
  onApplyScheme: (scheme: Scheme, profile: CitizenProfile) => void;
  onNavigateToDigilocker: () => void;
  onNavigateToSamagra: () => void;
  schemesRealtimeReport: SchemesRealtimeReport | null;
  isCheckingRealtime: boolean;
  onRunSchemesRealtimeCheck: () => Promise<void>;
  savedSchemeIds?: string[];
  onToggleSaveScheme?: (scheme: Scheme) => void;
  isProfileFilterApplied?: boolean;
  onApplyProfileFilter?: (nextProfile: CitizenProfile) => void;
  onClearProfileFilter?: () => void;
  searchQuery?: string;
  selectedLevel?: string;
  onResetAllCriteria?: () => void;
}

const OCCUPATION_OPTIONS: OccupationType[] = [
  'Farmer',
  'Street Vendor',
  'Homemaker',
  'Student',
  'Construction Worker',
  'Artisan / Handicraft',
  'Gig Worker / Driver',
  'Small Business',
  'Unemployed',
  'Senior Citizen',
  'Other',
];

const CATEGORY_OPTIONS: Category[] = ['GEN', 'OBC', 'SC', 'ST', 'EWS'];
const MARITAL_OPTIONS: MaritalStatus[] = ['Married', 'Unmarried', 'Widow', 'Divorced'];

export const EligibilityCalculator: React.FC<EligibilityCalculatorProps> = ({
  schemes,
  currentLanguage,
  profile,
  setProfile,
  onApplyScheme,
  onNavigateToDigilocker,
  onNavigateToSamagra,
  schemesRealtimeReport,
  isCheckingRealtime,
  onRunSchemesRealtimeCheck,
  savedSchemeIds = [],
  onToggleSaveScheme,
  isProfileFilterApplied = false,
  onApplyProfileFilter,
  onClearProfileFilter,
  searchQuery = '',
  selectedLevel = 'all',
  onResetAllCriteria,
}) => {
  const [draftProfile, setDraftProfile] = useState<CitizenProfile>(profile);
  const [ageInputText, setAgeInputText] = useState<string>(String(profile.age));
  const [incomeInputText, setIncomeInputText] = useState<string>(String(profile.annualIncome));
  const [expandedProcedureIds, setExpandedProcedureIds] = useState<Record<string, boolean>>({});

  const toggleProcedure = (schemeId: string) => {
    setExpandedProcedureIds(prev => ({ ...prev, [schemeId]: !prev[schemeId] }));
  };

  const handleRestartCriteria = () => {
    setFilterTab('all');
    if (onResetAllCriteria) {
      onResetAllCriteria();
    } else if (onClearProfileFilter) {
      onClearProfileFilter();
    }
    const formEl = document.getElementById('citizen-profile-form');
    formEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const [filterTab, setFilterTab] = useState<'matching' | 'all' | 'eligible' | 'likely' | 'not_eligible'>(
    isProfileFilterApplied ? 'matching' : 'all'
  );
  const [selectedSchemeDetail, setSelectedSchemeDetail] = useState<SchemeEligibilityResult | null>(null);
  const [resolvedDocToast, setResolvedDocToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  // Sync draft form whenever external sources (Samagra link / Cloud Auth / Clear Filter) update profile
  useEffect(() => {
    setDraftProfile(profile);
    setAgeInputText(String(profile.age));
    setIncomeInputText(String(profile.annualIncome));
  }, [profile]);

  // Keep filterTab aligned when external filter state toggles
  useEffect(() => {
    if (isProfileFilterApplied) {
      setFilterTab('matching');
    } else if (filterTab === 'matching') {
      setFilterTab('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileFilterApplied]);

  const hasPendingChanges = useMemo(() => {
    return (
      draftProfile.areaType !== profile.areaType ||
      draftProfile.wardNumber !== profile.wardNumber ||
      draftProfile.blockName !== profile.blockName ||
      draftProfile.age !== profile.age ||
      draftProfile.gender !== profile.gender ||
      draftProfile.occupation !== profile.occupation ||
      draftProfile.annualIncome !== profile.annualIncome ||
      draftProfile.landHoldingHectares !== profile.landHoldingHectares ||
      draftProfile.category !== profile.category ||
      draftProfile.maritalStatus !== profile.maritalStatus ||
      draftProfile.isBPL !== profile.isBPL ||
      draftProfile.hasDisability !== profile.hasDisability ||
      draftProfile.isMpDomicile !== profile.isMpDomicile
    );
  }, [draftProfile, profile]);

  const clampAge = (val: number) => Math.max(AGE_MIN, Math.min(AGE_MAX, Math.round(val)));
  const clampIncome = (val: number) => Math.max(INCOME_MIN, Math.min(INCOME_MAX, Math.round(val)));

  const handleAgeInputChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 3);
    setAgeInputText(digitsOnly);
    if (digitsOnly === '') {
      setDraftProfile(p => ({ ...p, age: 0 }));
      return;
    }
    const clamped = clampAge(Number(digitsOnly));
    setDraftProfile(p => ({ ...p, age: clamped }));
  };

  const handleAgeBlur = () => {
    const normalized = clampAge(Number(ageInputText) || 0);
    setAgeInputText(String(normalized));
    setDraftProfile(p => ({ ...p, age: normalized }));
  };

  const adjustAge = (delta: number) => {
    setDraftProfile(p => {
      const next = clampAge((Number.isFinite(p.age) ? p.age : 0) + delta);
      setAgeInputText(String(next));
      return { ...p, age: next };
    });
  };

  const handleIncomeInputChange = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 8);
    setIncomeInputText(digitsOnly);
    if (digitsOnly === '') {
      setDraftProfile(p => ({ ...p, annualIncome: 0 }));
      return;
    }
    const clamped = clampIncome(Number(digitsOnly));
    setDraftProfile(p => ({ ...p, annualIncome: clamped }));
  };

  const handleIncomeBlur = () => {
    const normalized = clampIncome(Number(incomeInputText) || 0);
    setIncomeInputText(String(normalized));
    setDraftProfile(p => ({ ...p, annualIncome: normalized }));
  };

  const adjustIncome = (delta: number) => {
    setDraftProfile(p => {
      const next = clampIncome((Number.isFinite(p.annualIncome) ? p.annualIncome : 0) + delta);
      setIncomeInputText(String(next));
      return { ...p, annualIncome: next };
    });
  };

  const setIncomePreset = (val: number) => {
    const clamped = clampIncome(val);
    setIncomeInputText(String(clamped));
    setDraftProfile(p => ({ ...p, annualIncome: clamped }));
  };

  const handleApplyFilterClick = (e: React.FormEvent) => {
    e.preventDefault();
    const committed: CitizenProfile = {
      ...draftProfile,
      age: clampAge(Number(ageInputText) || 0),
      annualIncome: clampIncome(Number(incomeInputText) || 0),
    };
    setAgeInputText(String(committed.age));
    setIncomeInputText(String(committed.annualIncome));
    setDraftProfile(committed);
    setProfile(committed);
    setFilterTab('matching');
    onApplyProfileFilter?.(committed);

    const resultsEl = document.getElementById('scheme-results-list');
    if (resultsEl && window.innerWidth < 1024) {
      resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleResetFilterClick = () => {
    setFilterTab('all');
    onClearProfileFilter?.();
  };

  const handleOpenDigiLockerForDoc = (docId: string) => {
    const label = getDocumentLabel(docId, currentLanguage);
    setResolvedDocToast({
      type: 'success',
      text: t(
        `Connect Official DigiLocker to verify ${label}.`,
        `${label} सत्यापित करने के लिए आधिकारिक डिजिलॉकर जोड़ें।`,
        `${label} पक्को करावण खातर सरकारी डिजिलॉकर जोड़ो।`
      ),
    });
    onNavigateToDigilocker();
  };

  // Evaluate schemes against the APPLIED profile (committed via Apply Filter)
  const eligibilityResults = useMemo(() => {
    return rankSchemesForCitizen(profile, schemes);
  }, [profile, schemes]);

  const counts = useMemo(() => {
    const eligible = eligibilityResults.filter(r => r.status === 'eligible').length;
    const likely = eligibilityResults.filter(r => r.status === 'likely').length;
    const not_eligible = eligibilityResults.filter(r => r.status === 'not_eligible').length;
    return {
      matching: eligible + likely,
      all: eligibilityResults.length,
      eligible,
      likely,
      not_eligible,
    };
  }, [eligibilityResults]);

  const displayedResults = useMemo(() => {
    if (filterTab === 'matching') {
      return eligibilityResults.filter(r => r.status === 'eligible' || r.status === 'likely');
    }
    if (filterTab === 'all') return eligibilityResults;
    return eligibilityResults.filter(r => r.status === filterTab);
  }, [eligibilityResults, filterTab]);

  const realtimeCopy = getRealtimeReportText(schemesRealtimeReport, currentLanguage);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Live Schemes Real-Time Verification Status Strip */}
      <div className="mb-6 bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-start space-x-3">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              schemesRealtimeReport?.verdict === 'live_verified'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : schemesRealtimeReport?.verdict === 'partially_verified'
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <Globe className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-xs font-black text-slate-900">
                {t('Schemes Data Real-Time Status:', 'योजना डेटा रीयल-टाइम स्थिति:', 'योजना जानकारी री ताजा स्थिति:')}
              </span>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  schemesRealtimeReport?.verdict === 'live_verified'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : schemesRealtimeReport?.verdict === 'partially_verified'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {realtimeCopy.label}
              </span>
            </div>
            <p className="text-xs text-slate-500">{realtimeCopy.detail}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!profile.samagraMemberId && (
            <button
              type="button"
              onClick={onNavigateToSamagra}
              className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition cursor-pointer whitespace-nowrap"
            >
              {t('Link Samagra ID', 'समग्र आईडी जोड़ें', 'समग्र नंबर जोड़ो')}
            </button>
          )}
          <button
            type="button"
            disabled={isCheckingRealtime}
            onClick={onRunSchemesRealtimeCheck}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
          >
            {isCheckingRealtime ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>
              {isCheckingRealtime
                ? t('Checking Official Portals...', 'आधिकारिक पोर्टल जांचे जा रहे हैं...', 'सरकारी पोर्टल री जांच चाल री छे...')
                : t('Verify Official Portals Live', 'आधिकारिक पोर्टल लाइव जांचें', 'सरकारी पोर्टल लाइव जांचो')}
            </span>
          </button>
        </div>
      </div>

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
              {t('Real-Time JSON Rules Engine', 'रीयल-टाइम नियम इंजन', 'सीधो पात्रता जांच इंजन')}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {t(
              'Find My Schemes & Entitlement Calculator',
              'योजना पात्रता कैलकुलेटर (मेरी योजनाएं खोजें)',
              'म्हारी पात्रता जांचो अने योजना खोजो'
            )}
          </h2>
          <p className="text-sm text-slate-500">
            {profile.samagraMemberId
              ? t(
                  `Active Live Profile: ${profile.fullName || 'Citizen'} (Samagra Member ID: ${profile.samagraMemberId})`,
                  `सक्रिय लाइव प्रोफ़ाइल: ${profile.fullName || 'नागरिक'} (समग्र सदस्य आईडी: ${profile.samagraMemberId})`,
                  `चालू प्रोफ़ाइल: ${profile.fullName || 'नागरिक'} (समग्र सदस्य नंबर: ${profile.samagraMemberId})`
                )
              : t(
                  'Fill your Citizen Profile Parameters below and click "Apply Filter" to display all schemes matching your criteria.',
                  'नीचे नागरिक प्रोफ़ाइल मापदंड भरें और अपने अनुसार सभी योजनाएं देखने के लिए "फ़िल्टर लागू करें" पर क्लिक करें।',
                  'नीचे थारी जानकारी भरो अने "फ़िल्टर लगावो" बटन दबावो, पूरा पेज पर थारी पात्र योजना दिख जावेगा।'
                )}
          </p>
        </div>

        {/* Status Counter Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isProfileFilterApplied && (
            <button
              type="button"
              onClick={() => setFilterTab('matching')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                filterTab === 'matching'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>
                {t(`Matching Criteria: ${counts.matching}`, `मापदंड अनुसार: ${counts.matching}`, `थारे खातर पात्र: ${counts.matching}`)}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setFilterTab('eligible')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              filterTab === 'eligible'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-500 fill-current" />
            <span>{t(`Eligible: ${counts.eligible}`, `पात्र: ${counts.eligible}`, `पक्का पात्र: ${counts.eligible}`)}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab('likely')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
              filterTab === 'likely'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>{t(`Likely: ${counts.likely}`, `संभावित: ${counts.likely}`, `पात्र हो सको: ${counts.likely}`)}</span>
          </button>

          {!isProfileFilterApplied && (
            <>
              <button
                type="button"
                onClick={() => setFilterTab('not_eligible')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  filterTab === 'not_eligible'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <XCircle className="w-4 h-4 text-slate-400" />
                <span>
                  {t(`Not Eligible: ${counts.not_eligible}`, `अपात्र: ${counts.not_eligible}`, `पात्र नी: ${counts.not_eligible}`)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  filterTab === 'all'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t(`All: ${counts.all}`, `सभी: ${counts.all}`, `सगळी: ${counts.all}`)}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* LEFT COLUMN: Citizen Profile Parameters Form (4 cols on lg, sticky on desktop) */}
        <form
          id="citizen-profile-form"
          onSubmit={handleApplyFilterClick}
          className="lg:col-span-4 lg:sticky lg:top-20 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-5"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-600 shrink-0" />
              <h3 className="font-bold text-slate-900 text-sm">
                {t('Citizen Profile Parameters', 'नागरिक प्रोफ़ाइल मापदंड', 'नागरिक री जानकारी भरो')}
              </h3>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
                hasPendingChanges
                  ? 'text-amber-800 bg-amber-50 border-amber-300'
                  : isProfileFilterApplied
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-slate-600 bg-slate-50 border-slate-200'
              }`}
            >
              {hasPendingChanges
                ? t('Click Apply Filter', 'फ़िल्टर लागू करें', 'फ़िल्टर लगावो')
                : isProfileFilterApplied
                ? t('Filter Active', 'फ़िल्टर सक्रिय', 'फ़िल्टर लागू छे')
                : t('Ready', 'तैयार', 'तैयार छे')}
            </span>
          </div>

          {/* 1. Area Type Toggle: Urban IMC vs Rural Janpad */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t('1. Area of Residence:', '1. निवास क्षेत्र प्रकार:', '1. थारो रहण रो क्षेत्र चुनो:')}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDraftProfile(p => ({ ...p, areaType: 'urban', wardNumber: p.wardNumber || 72 }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  draftProfile.areaType === 'urban'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t('IMC Urban (Wards 1-85)', 'शहरी निगम (वार्ड 1-85)', 'शहर निगम (वार्ड 1-85)')}
              </button>
              <button
                type="button"
                onClick={() => setDraftProfile(p => ({ ...p, areaType: 'rural', blockName: p.blockName || 'Depalpur' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                  draftProfile.areaType === 'rural'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t('Rural Janpad (4 Blocks)', 'ग्रामीण जनपद (4 ब्लॉक)', 'गाँव जनपद (4 ब्लॉक)')}
              </button>
            </div>
          </div>

          {/* Ward Selector (if urban) or Janpad Block (if rural) */}
          {draftProfile.areaType === 'urban' ? (
            <div>
              <label htmlFor="wardSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Indore Municipal Ward (1 to 85):', 'इंदौर नगर निगम वार्ड (1 से 85):', 'इंदौर नगर निगम वार्ड (1 सूं 85):')}
              </label>
              <select
                id="wardSelect"
                value={draftProfile.wardNumber || 72}
                onChange={e => setDraftProfile(p => ({ ...p, wardNumber: Number(e.target.value) }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {IMC_WARDS.map(w => (
                  <option key={w.number} value={w.number}>
                    {t(`Ward ${w.number}`, `वार्ड ${w.number}`, `वार्ड ${w.number}`)}: {w.name} ({t(`Zone ${w.zone}`, `ज़ोन ${w.zone}`, `ज़ोन ${w.zone}`)})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label htmlFor="janpadSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  {t('Janpad Block:', 'जनपद पंचायत ब्लॉक:', 'गाँव जनपद पंचायत:')}
                </label>
                <select
                  id="janpadSelect"
                  value={draftProfile.blockName || 'Depalpur'}
                  onChange={e => setDraftProfile(p => ({ ...p, blockName: e.target.value as JanpadBlock }))}
                  className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {JANPAD_BLOCKS.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.panchayatCount} {t('Panchayats', 'पंचायतें', 'पंचायत')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500">
                  {t('Gram Panchayats in Block:', 'ब्लॉक की ग्राम पंचायतें:', 'ई जनपद री ग्राम पंचायत:')}
                </label>
                <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                  {JANPAD_BLOCKS.find(b => b.name === (draftProfile.blockName || 'Depalpur'))?.popularPanchayats.join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Age Stepper Input (Enter Age + "-" & "+" buttons) */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="ageInput" className="text-xs font-semibold text-slate-700">
                  {t('Age (Enter Age in Years):', 'आयु (वर्षों में दर्ज करें):', 'थारी उमर लिखो (साल मां):')}
                </label>
                <span className="text-xs font-bold text-amber-700 font-mono">
                  {draftProfile.age} {t('yrs', 'वर्ष', 'साल')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => adjustAge(-1)}
                  disabled={draftProfile.age <= AGE_MIN}
                  aria-label={t('Decrease age', 'आयु घटाएं', 'उमर कम करो')}
                  title={t('Decrease by 1 year', '1 वर्ष घटाएं', '1 साल कम करो')}
                  className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl border border-slate-300 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 active:scale-95 disabled:opacity-40 text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  id="ageInput"
                  type="text"
                  inputMode="numeric"
                  value={ageInputText}
                  onChange={e => handleAgeInputChange(e.target.value)}
                  onBlur={handleAgeBlur}
                  placeholder={t('Enter your age...', 'अपनी आयु लिखें...', 'थारी उमर लिखो...')}
                  className="flex-1 min-w-0 h-11 sm:h-9 px-3 text-center text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => adjustAge(1)}
                  disabled={draftProfile.age >= AGE_MAX}
                  aria-label={t('Increase age', 'आयु बढ़ाएं', 'उमर बढ़ावो')}
                  title={t('Increase by 1 year', '1 वर्ष बढ़ाएं', '1 साल बढ़ावो')}
                  className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl border border-slate-300 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 active:scale-95 disabled:opacity-40 text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="genderSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Gender:', 'लिंग:', 'लिंग चुनो:')}
              </label>
              <select
                id="genderSelect"
                value={draftProfile.gender}
                onChange={e => setDraftProfile(p => ({ ...p, gender: e.target.value as Gender }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="female">{getGenderLabel('female', currentLanguage)}</option>
                <option value="male">{getGenderLabel('male', currentLanguage)}</option>
                <option value="transgender">{getGenderLabel('transgender', currentLanguage)}</option>
              </select>
            </div>
          </div>

          {/* Occupation */}
          <div>
            <label htmlFor="occupationSelect" className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Occupation / Profession:', 'पेशा / व्यवसाय:', 'थारो कामकाज / धंधो:')}
            </label>
            <select
              id="occupationSelect"
              value={draftProfile.occupation}
              onChange={e => setDraftProfile(p => ({ ...p, occupation: e.target.value as OccupationType }))}
              className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              {OCCUPATION_OPTIONS.map(occ => (
                <option key={occ} value={occ}>
                  {getOccupationLabel(occ, currentLanguage)}
                </option>
              ))}
            </select>
          </div>

          {/* Annual Family Income Stepper Input (Enter Income + "-" & "+" buttons) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="incomeInput" className="text-xs font-semibold text-slate-700">
                {t('Annual Family Income (₹):', 'वार्षिक पारिवारिक आय (₹):', 'कुटुंब री साल री कमाई (₹):')}
              </label>
              <span className="text-xs font-bold text-amber-700 font-mono">
                ₹{draftProfile.annualIncome.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => adjustIncome(-INCOME_STEP)}
                disabled={draftProfile.annualIncome <= INCOME_MIN}
                aria-label={t('Decrease annual income by ₹10,000', 'वार्षिक आय ₹10,000 घटाएं', 'साल री कमाई ₹10,000 कम करो')}
                title={t('Decrease by ₹10,000', '₹10,000 घटाएं', '₹10,000 कम करो')}
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl border border-slate-300 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 active:scale-95 disabled:opacity-40 text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="relative flex-1 min-w-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                  ₹
                </span>
                <input
                  id="incomeInput"
                  type="text"
                  inputMode="numeric"
                  value={incomeInputText}
                  onChange={e => handleIncomeInputChange(e.target.value)}
                  onBlur={handleIncomeBlur}
                  placeholder={t('Enter annual family income...', 'वार्षिक आय लिखें...', 'साल री कमाई लिखो...')}
                  className="w-full h-11 sm:h-9 pl-7 pr-3 text-center text-sm font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() => adjustIncome(INCOME_STEP)}
                disabled={draftProfile.annualIncome >= INCOME_MAX}
                aria-label={t('Increase annual income by ₹10,000', 'वार्षिक आय ₹10,000 बढ़ाएं', 'साल री कमाई ₹10,000 बढ़ावो')}
                title={t('Increase by ₹10,000', '₹10,000 बढ़ाएं', '₹10,000 बढ़ावो')}
                className="w-11 h-11 sm:w-9 sm:h-9 rounded-xl border border-slate-300 bg-slate-50 hover:bg-amber-50 hover:border-amber-400 active:scale-95 disabled:opacity-40 text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {t(
                'Type amount directly or use - / + buttons (±₹10,000 step)',
                'सीधे राशि लिखें या - / + बटन उपयोग करें (±₹10,000)',
                'सीधा रुपया लिखो या - / + बटन सूं ₹10,000 कम-ज्यादा करो'
              )}
            </p>
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {[
                { label: t('₹0 (BPL)', '₹0 (बीपीएल)', '₹0 (बीपीएल)'), val: 0 },
                { label: t('₹1.2L', '₹1.2 लाख', '₹1.2 लाख'), val: 120000 },
                { label: t('₹2.5L', '₹2.5 लाख', '₹2.5 लाख'), val: 250000 },
                { label: t('₹5L', '₹5 लाख', '₹5 लाख'), val: 500000 },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setIncomePreset(preset.val)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition cursor-pointer ${
                    draftProfile.annualIncome === preset.val
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Agricultural Landholding */}
          <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex justify-between items-center gap-2">
              <label htmlFor="landholdingInput" className="text-xs font-semibold text-emerald-950">
                {t('Agricultural Land (Hectares):', 'कृषि भूमि (खसरा हेक्टेयर):', 'खेती री जमीन (हेक्टेयर):')}
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={draftProfile.landHoldingHectares}
                  onChange={e =>
                    setDraftProfile(p => ({ ...p, landHoldingHectares: Math.max(0, Number(e.target.value)) }))
                  }
                  className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-900 bg-white border border-emerald-300 rounded text-right"
                />
                <span className="text-xs font-bold text-emerald-800">{t('Ha', 'हे.', 'हे.')}</span>
              </div>
            </div>

            <input
              id="landholdingInput"
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={draftProfile.landHoldingHectares}
              onChange={e => setDraftProfile(p => ({ ...p, landHoldingHectares: Number(e.target.value) }))}
              className="w-full accent-emerald-600 cursor-pointer"
            />

            <div className="flex flex-wrap gap-1 pt-0.5">
              {[
                { label: t('0 Ha (Landless)', '0 हे. (भूमिहीन)', '0 हे. (बिना जमीन)'), val: 0 },
                { label: t('0.5 Ha', '0.5 हे.', '0.5 हे.'), val: 0.5 },
                { label: t('1.5 Ha (Small)', '1.5 हे. (लघु)', '1.5 हे. (छोटो किसान)'), val: 1.5 },
                { label: t('2.5 Ha', '2.5 हे.', '2.5 हे.'), val: 2.5 },
                { label: t('5.0 Ha', '5.0 हे.', '5.0 हे.'), val: 5.0 },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setDraftProfile(p => ({ ...p, landHoldingHectares: preset.val }))}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer border ${
                    draftProfile.landHoldingHectares === preset.val
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {draftProfile.landHoldingHectares > 0 && (
              <div className="text-[10px] text-emerald-800 font-medium flex items-center space-x-1 pt-1 border-t border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>
                  {t(
                    'Qualifies for PM-KISAN, PMFBY, PM-KUSUM & MP Kisan Kalyan',
                    'पीएम-किसान, फसल बीमा, कुसुम एवं म.प्र. किसान कल्याण हेतु पात्र',
                    'पीएम-किसान, फसल बीमा, सोलर पंप अने म.प्र. किसान कल्याण खातर पात्र'
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Social Category & Marital Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="categorySelect" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Social Category:', 'सामाजिक वर्ग:', 'जाति वर्ग:')}
              </label>
              <select
                id="categorySelect"
                value={draftProfile.category}
                onChange={e => setDraftProfile(p => ({ ...p, category: e.target.value as Category }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-slate-800"
              >
                {CATEGORY_OPTIONS.map(cat => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat, currentLanguage)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="maritalSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Marital Status:', 'वैवाहिक स्थिति:', 'ब्याह री स्थिति:')}
              </label>
              <select
                id="maritalSelect"
                value={draftProfile.maritalStatus}
                onChange={e => setDraftProfile(p => ({ ...p, maritalStatus: e.target.value as MaritalStatus }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800"
              >
                {MARITAL_OPTIONS.map(ms => (
                  <option key={ms} value={ms}>
                    {getMaritalLabel(ms, currentLanguage)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Checkboxes: BPL, Disability, MP Domicile */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftProfile.isBPL}
                onChange={e => setDraftProfile(p => ({ ...p, isBPL: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">
                {t('BPL / Antyodaya Ration Card Holder', 'बीपीएल / अंत्योदय राशन कार्ड धारक', 'बीपीएल / पीलो राशन कार्ड धारक')}
              </span>
            </label>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftProfile.hasDisability}
                onChange={e =>
                  setDraftProfile(p => ({
                    ...p,
                    hasDisability: e.target.checked,
                    disabilityPercent: e.target.checked ? 45 : 0,
                  }))
                }
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">
                {t('Divyangjan / Disability (40%+)', 'दिव्यांगजन (40% या अधिक)', 'दिव्यांग भाई-बहन (40% सूं ज्यादा)')}
              </span>
            </label>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={draftProfile.isMpDomicile}
                onChange={e => setDraftProfile(p => ({ ...p, isMpDomicile: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">
                {t('Resident of Madhya Pradesh (Domicile)', 'मध्य प्रदेश का मूल निवासी', 'मध्य प्रदेश रो मूल निवासी छे')}
              </span>
            </label>
          </div>

          {/* APPLY FILTER CTA BENEATH CITIZEN PROFILE PARAMETERS */}
          <div className="pt-3 border-t border-slate-200 space-y-2">
            <button
              type="submit"
              data-testid="apply-profile-filter-btn"
              className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Filter className="w-4 h-4" />
              <span>
                {t(
                  'Apply Filter & Show Matching Schemes',
                  'फ़िल्टर लागू करें व पात्र योजनाएं देखें',
                  'फ़िल्टर लगावो — म्हारी योजना दिखावो'
                )}
              </span>
            </button>

            {isProfileFilterApplied && (
              <button
                type="button"
                onClick={handleResetFilterClick}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {t('Clear Filter (Show All Schemes)', 'फ़िल्टर हटाएं (सभी योजनाएं दिखाएं)', 'फ़िल्टर हटावो (सगळी योजना दिखावो)')}
                </span>
              </button>
            )}
          </div>
        </form>

        {/* RIGHT COLUMN: Scheme Results Cards (8 cols on lg) */}
        <div id="scheme-results-list" className="lg:col-span-8 space-y-4">
          {resolvedDocToast && (
            <div
              role={resolvedDocToast.type === 'error' ? 'alert' : 'status'}
              className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-md ${
                resolvedDocToast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0 bg-white/20 p-0.5 rounded-full" />
                <span>{resolvedDocToast.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setResolvedDocToast(null)}
                aria-label={t('Dismiss notification', 'सूचना बंद करें', 'सूचना बंद करो')}
                className="text-white/80 hover:text-white font-bold ml-2 text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pb-2 border-b border-slate-200">
            <span>
              {isProfileFilterApplied
                ? t(
                    `Showing ${displayedResults.length} scheme${displayedResults.length === 1 ? '' : 's'} matching your applied criteria`,
                    `आपके लागू मापदंड के अनुसार ${displayedResults.length} योजनाएं दिख रही हैं`,
                    `थारी जानकारी मुजब ${displayedResults.length} पात्र योजना दिख री छे`
                  )
                : t(
                    `Showing ${displayedResults.length} scheme${displayedResults.length === 1 ? '' : 's'}`,
                    `${displayedResults.length} योजनाएं दिख रही हैं`,
                    `${displayedResults.length} योजना दिख री छे`
                  )}
            </span>
            <button
              type="button"
              onClick={onNavigateToDigilocker}
              className="text-amber-700 hover:text-amber-900 font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>
                {t('View DigiLocker Verified Docs', 'डिजिलॉकर सत्यापित दस्तावेज़ देखें', 'डिजिलॉकर रा पक्का कागद देखो')}
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {displayedResults.length === 0 ? (
            <div
              role="status"
              data-testid="no-matching-schemes-empty-state"
              className="bg-white rounded-2xl border border-dashed border-amber-300 p-6 sm:p-10 text-center space-y-3 shadow-xs"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Info className="w-6 h-6" />
              </div>
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                {t(
                  'Modify your search criteria',
                  'Modify your search criteria — अपने खोज मापदंड बदलें',
                  'Modify your search criteria — थारा खोज रा नियम बदलो'
                )}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                {t(
                  'Modify your search criteria to discover eligible Indore & MP government schemes. No schemes matched your current keyword, governance tier, or citizen profile parameters.',
                  'कोई भी योजना आपके वर्तमान खोज शब्द, शासन स्तर या नागरिक प्रोफ़ाइल मापदंडों से मेल नहीं खाई। कृपया अपने खोज मापदंड बदलकर पुनः खोज शुरू करें।',
                  'थारी लिखी खोज, सरकार स्तर या नागरिक जानकारी सूं कोई योजना नी मिली। कृपया खोज रा नियम बदल ने पाछी जांच शुरू करो।'
                )}
              </p>
              {(searchQuery.trim() || selectedLevel !== 'all' || isProfileFilterApplied) && (
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
                  {searchQuery.trim() && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-medium">
                      {t('Search:', 'खोज:', 'खोज:')} &ldquo;{searchQuery.trim()}&rdquo;
                    </span>
                  )}
                  {selectedLevel !== 'all' && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 font-medium">
                      {t('Tier:', 'स्तर:', 'स्तर:')} {selectedLevel}
                    </span>
                  )}
                  {isProfileFilterApplied && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                      {t('Profile Filter Active', 'प्रोफ़ाइल फ़िल्टर सक्रिय', 'प्रोफ़ाइल फ़िल्टर चालू छे')}
                    </span>
                  )}
                </div>
              )}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleRestartCriteria}
                  data-testid="modify-search-criteria-btn"
                  className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {t(
                      'Modify Your Search Criteria & Restart',
                      'खोज मापदंड बदलें व पुनः शुरू करें',
                      'खोज रा नियम बदलो अने पाछो शुरू करो'
                    )}
                  </span>
                </button>
                {filterTab !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterTab('all')}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer"
                  >
                    {t('Show All Statuses', 'सभी स्थितियां दिखाएं', 'सगळी योजना दिखावो')}
                  </button>
                )}
              </div>
            </div>
          ) : (
            displayedResults.map(result => {
              const { scheme, status, matchScore, ruleEvaluations, missingDocuments } = result;

              const statusBadgeConfig = {
                eligible: {
                  label: t('ELIGIBLE', 'पात्र', 'पक्का पात्र'),
                  bg: 'bg-emerald-500 text-white',
                  cardBorder: 'border-emerald-300 shadow-emerald-50',
                  icon: CheckCircle,
                },
                likely: {
                  label: t('LIKELY', 'संभावित', 'पात्र हो सको'),
                  bg: 'bg-amber-500 text-white',
                  cardBorder: 'border-amber-300 shadow-amber-50',
                  icon: AlertTriangle,
                },
                not_eligible: {
                  label: t('NOT ELIGIBLE', 'अपात्र', 'पात्र नी'),
                  bg: 'bg-slate-400 text-white',
                  cardBorder: 'border-slate-200 opacity-80',
                  icon: XCircle,
                },
              }[status];

              const Icon = statusBadgeConfig.icon;
              const localizedPassing = ruleEvaluations
                .filter(ev => ev.passed)
                .map(ev =>
                  currentLanguage === 'malwi'
                    ? ev.reasonMalwi || ev.reasonHindi
                    : currentLanguage === 'hi'
                    ? ev.reasonHindi
                    : ev.reason
                );
              const localizedFailing = ruleEvaluations
                .filter(ev => !ev.passed)
                .map(ev =>
                  currentLanguage === 'malwi'
                    ? ev.reasonMalwi || ev.reasonHindi
                    : currentLanguage === 'hi'
                    ? ev.reasonHindi
                    : ev.reason
                );

              return (
                <div
                  key={scheme.id}
                  className={`bg-white rounded-2xl border p-5 transition shadow-xs hover:shadow-md ${statusBadgeConfig.cardBorder}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Top Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center space-x-1 ${statusBadgeConfig.bg}`}
                        >
                          <Icon className="w-3 h-3 mr-0.5" />
                          <span>{statusBadgeConfig.label}</span>
                          <span>• {matchScore}%</span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {getGovernanceLevelLabel(scheme.governanceLevel, currentLanguage)}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 font-semibold">
                          {scheme.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {getSchemeTitle(scheme, currentLanguage)}
                      </h4>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {getSchemeDescription(scheme, currentLanguage)}
                      </p>
                    </div>

                    {/* Financial Benefit Badge */}
                    <div className="sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                      <div className="text-[11px] font-medium text-slate-500">
                        {t('Financial Benefit', 'आर्थिक लाभ', 'मदद रा रुपया')}
                      </div>
                      <div className="text-lg font-black text-amber-600 font-mono">
                        {scheme.financialEntitlement.frequency === 'In-Kind / Service'
                          ? t('In-Kind / Grant', 'सामग्री / सेवा लाभ', 'सामान / सुविधा मदद')
                          : `₹${scheme.financialEntitlement.amount.toLocaleString('en-IN')}`}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        {getFrequencyLabel(scheme.financialEntitlement.frequency, currentLanguage)}
                      </div>
                    </div>
                  </div>

                  {/* Reasons Section */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    {localizedPassing.length > 0 && (
                      <div className="flex items-start space-x-2 text-xs text-emerald-800">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>{t('Qualifies:', 'पात्रता मेल:', 'शर्त पूरी:')}</strong>{' '}
                          {localizedPassing.slice(0, 2).join(' • ')}
                        </span>
                      </div>
                    )}

                    {localizedFailing.length > 0 && (
                      <div className="flex items-start space-x-2 text-xs text-rose-800">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>{t('Does not match:', 'अपात्र कारण:', 'शर्त नी मिली:')}</strong>{' '}
                          {localizedFailing.join(' • ')}
                        </span>
                      </div>
                    )}

                    {/* Missing Documents Interactive Resolution */}
                    {missingDocuments.length > 0 && status !== 'not_eligible' && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {t(
                                `${missingDocuments.length} Pending Document${missingDocuments.length > 1 ? 's' : ''} to reach 100% Eligible:`,
                                `100% पात्रता हेतु ${missingDocuments.length} लंबित दस्तावेज़:`,
                                `100% पक्की पात्रता खातर ${missingDocuments.length} कागद बाकी छे:`
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={onNavigateToDigilocker}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center space-x-1 cursor-pointer"
                          >
                            <span>{t('Open DigiLocker Wallet', 'डिजिलॉकर वॉलेट खोलें', 'कागजात लॉकर खोलो')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {missingDocuments.map(docId => {
                            const label = getDocumentLabel(docId, currentLanguage);
                            return (
                              <button
                                key={docId}
                                type="button"
                                onClick={() => handleOpenDigiLockerForDoc(docId)}
                                className="group inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-900 border border-amber-300 hover:border-blue-400 shadow-2xs transition cursor-pointer"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 group-hover:bg-blue-500"></span>
                                <span className="font-semibold">{label}</span>
                                <span className="ml-1 text-[10px] font-bold bg-amber-100 group-hover:bg-blue-100 text-amber-900 group-hover:text-blue-900 px-1 rounded">
                                  {t('Verify in DigiLocker →', 'डिजिलॉकर में सत्यापित करें →', 'लॉकर मां पक्को करो →')}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Verified Official Portal & Step-by-Step Application Procedure */}
                  {(() => {
                    const procedure = getSchemeApplicationProcedure(scheme, currentLanguage);
                    const isProcExpanded = Boolean(expandedProcedureIds[scheme.id]);
                    return (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        {/* Official Verified Portal Bar + Procedure Toggle */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 px-3 py-2.5 rounded-xl border border-slate-200">
                          <div className="flex items-center gap-2 min-w-0">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="min-w-0 text-xs">
                              <span className="font-bold text-slate-700 mr-1.5">
                                {t('Official Verified Portal:', 'आधिकारिक सत्यापित पोर्टल:', 'पक्की सरकारी वेबसाइट:')}
                              </span>
                              <a
                                href={procedure.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono font-bold text-amber-700 hover:text-amber-900 hover:underline break-all"
                              >
                                <span>{procedure.portalHost}</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleProcedure(scheme.id)}
                            aria-expanded={isProcExpanded}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-bold border transition cursor-pointer shrink-0 ${
                              isProcExpanded
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-800 border-slate-300 hover:border-amber-400 hover:bg-amber-50'
                            }`}
                          >
                            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {isProcExpanded
                                ? t('Hide Application Procedure', 'आवेदन प्रक्रिया छुपाएं', 'अर्जी तरीका छुपावो')
                                : t('Application Procedure', 'आवेदन प्रक्रिया देखें', 'अर्जी लगावण रो तरीको')}
                            </span>
                            {isProcExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            )}
                          </button>
                        </div>

                        {/* Collapsible Step-by-Step Application Procedure */}
                        {isProcExpanded && (
                          <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <ClipboardList className="w-4 h-4 text-amber-700 shrink-0" />
                                <span>
                                  {t(
                                    'Step-by-Step Application Procedure',
                                    'चरण-दर-चरण आवेदन प्रक्रिया',
                                    'स्टेप-बाय-स्टेप अर्जी लगावण रो पूरो तरीको'
                                  )}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 font-semibold">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  {procedure.estimatedTime}
                                </span>
                                <span className="inline-flex items-center gap-1 font-mono font-semibold">
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                                  {procedure.helpline}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-slate-700 bg-white px-3 py-2 rounded-lg border border-amber-200/70">
                              <strong>{t('Application Mode:', 'आवेदन माध्यम:', 'अर्जी माध्यम:')}</strong> {procedure.mode}
                            </div>

                            <ol className="space-y-2 text-xs text-slate-800">
                              {procedure.steps.map((step, sIdx) => (
                                <li key={sIdx} className="flex items-start gap-2.5">
                                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                                    {sIdx + 1}
                                  </span>
                                  <span className="leading-relaxed">{step}</span>
                                </li>
                              ))}
                            </ol>

                            <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center justify-between gap-2">
                              <a
                                href={procedure.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition"
                              >
                                <Globe className="w-3.5 h-3.5" />
                                <span>
                                  {t(
                                    `Visit Official Portal (${procedure.portalHost})`,
                                    `आधिकारिक पोर्टल खोलें (${procedure.portalHost})`,
                                    `सरकारी वेबसाइट खोलो (${procedure.portalHost})`
                                  )}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <span className="text-[11px] text-slate-600">
                                <strong>{t('Nodal Office:', 'नोडल कार्यालय:', 'दफ्तर:')}</strong> {procedure.nodalOffice}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Actions Row */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500 flex items-start sm:items-center space-x-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span className="line-clamp-2 sm:truncate sm:max-w-[280px]">
                        {t('Nodal Office:', 'नोडल कार्यालय:', 'दफ्तर रो पतो:')} {scheme.nodalOfficeIndore}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {onToggleSaveScheme && (
                        <button
                          type="button"
                          onClick={() => onToggleSaveScheme(scheme)}
                          className={`min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs transition cursor-pointer flex items-center space-x-1 ${
                            savedSchemeIds.includes(scheme.id)
                              ? 'bg-amber-100 border-amber-300 text-amber-800 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-amber-700 hover:border-amber-300'
                          }`}
                          title={
                            savedSchemeIds.includes(scheme.id)
                              ? t('Saved in profile (Click to remove)', 'सहेजी गई (हटाने हेतु क्लिक करें)', 'संभाली हुई (हटावण खातर दबावो)')
                              : t('Save scheme', 'योजना सहेजें', 'योजना संभालो')
                          }
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${
                              savedSchemeIds.includes(scheme.id) ? 'fill-amber-600 text-amber-600' : ''
                            }`}
                          />
                          <span className="text-[11px]">
                            {savedSchemeIds.includes(scheme.id)
                              ? t('Saved', 'सहेजी गई', 'संभाली')
                              : t('Save', 'सहेजें', 'संभालो')}
                          </span>
                        </button>
                      )}

                      <a
                        href={resolveSchemePortalUrl(scheme)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition inline-flex items-center gap-1"
                        title={resolveSchemePortalUrl(scheme)}
                      >
                        <span>{t('Official Portal', 'आधिकारिक पोर्टल', 'सरकारी पोर्टल')}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>

                      <button
                        type="button"
                        onClick={() => setSelectedSchemeDetail(result)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                      >
                        {t('Rules & Steps', 'नियम व प्रक्रिया', 'नियम व तरीको')}
                      </button>

                      <button
                        type="button"
                        onClick={() => onApplyScheme(scheme, profile)}
                        className="w-full sm:w-auto min-h-[40px] px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center justify-center space-x-1 shadow-xs cursor-pointer"
                      >
                        <span>{t('Apply / Register', 'आवेदन करें', 'अर्जी लगावो')}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Rules Breakdown & Application Procedure Detail Modal */}
      {selectedSchemeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="min-w-0">
                <span className="text-xs font-bold text-amber-700 uppercase">
                  {getGovernanceLevelLabel(selectedSchemeDetail.scheme.governanceLevel, currentLanguage)}
                </span>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
                  {getSchemeTitle(selectedSchemeDetail.scheme, currentLanguage)}
                </h3>
                {currentLanguage === 'en' && (
                  <p className="text-xs text-slate-500 font-devanagari font-bold mt-0.5">
                    {selectedSchemeDetail.scheme.titleHindi}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchemeDetail(null)}
                aria-label={t('Close modal', 'बंद करें', 'बंद करो')}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div>
                  <strong>{t('Department:', 'विभाग:', 'विभाग:')}</strong> {selectedSchemeDetail.scheme.department}
                </div>
                <div>
                  <strong>{t('Nodal Office in Indore:', 'इंदौर नोडल कार्यालय:', 'इंदौर दफ्तर रो पतो:')}</strong>{' '}
                  {selectedSchemeDetail.scheme.nodalOfficeIndore}
                </div>
                <div>
                  <strong>{t('District Helpline:', 'जिला हेल्पलाइन:', 'जिला मदद नंबर:')}</strong>{' '}
                  {selectedSchemeDetail.scheme.helpline}
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="break-all">
                      <strong>{t('Verified Official Portal:', 'सत्यापित आधिकारिक पोर्टल:', 'पक्की सरकारी वेबसाइट:')}</strong>{' '}
                      <a
                        href={resolveSchemePortalUrl(selectedSchemeDetail.scheme)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 hover:underline font-mono font-bold inline-flex items-center gap-1"
                      >
                        <span>{resolveSchemePortalUrl(selectedSchemeDetail.scheme)}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 uppercase shrink-0">
                    {t('Official Govt Link', 'आधिकारिक सरकारी लिंक', 'सरकारी लिंक')}
                  </span>
                </div>
              </div>

              {/* Step-by-Step Application Procedure inside Modal */}
              {(() => {
                const modalProc = getSchemeApplicationProcedure(selectedSchemeDetail.scheme, currentLanguage);
                return (
                  <div className="p-3.5 sm:p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-amber-700" />
                        <span>
                          {t(
                            'Application Procedure (How to Apply)',
                            'आवेदन प्रक्रिया (आवेदन कैसे करें)',
                            'अर्जी लगावण री पूरी प्रक्रिया'
                          )}
                        </span>
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-600 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        {modalProc.estimatedTime}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700">
                      <strong>{t('Mode:', 'माध्यम:', 'माध्यम:')}</strong> {modalProc.mode}
                    </p>
                    <ol className="space-y-1.5 text-xs text-slate-800">
                      {modalProc.steps.map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })()}

              {/* Individual Rules Evaluation Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {t(
                    `Rule Evaluations (${selectedSchemeDetail.ruleEvaluations.length} Rules Checked):`,
                    `पात्रता नियम जांच (${selectedSchemeDetail.ruleEvaluations.length} नियम जांचे गए):`,
                    `पात्रता नियम री जांच (${selectedSchemeDetail.ruleEvaluations.length} शर्त जांची गई):`
                  )}
                </h4>
                <div className="space-y-1.5">
                  {selectedSchemeDetail.ruleEvaluations.map((evalItem, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl text-xs flex items-start space-x-2 border ${
                        evalItem.passed
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                          : 'bg-rose-50 text-rose-900 border-rose-200'
                      }`}
                    >
                      {evalItem.passed ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold">
                          {currentLanguage === 'malwi'
                            ? evalItem.reasonMalwi || evalItem.reasonHindi
                            : currentLanguage === 'hi'
                            ? evalItem.reasonHindi
                            : evalItem.ruleName}
                        </div>
                        {currentLanguage === 'en' && (
                          <>
                            <div className="text-[11px] opacity-90">{evalItem.reason}</div>
                            <div className="text-[11px] opacity-75 font-devanagari">{evalItem.reasonHindi}</div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Documents Checklist */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  {t(
                    'Required Documents Checklist & DigiLocker Status:',
                    'आवश्यक दस्तावेज़ सूची व डिजिलॉकर स्थिति:',
                    'जरूरी कागजात री सूची अने लॉकर स्थिति:'
                  )}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSchemeDetail.scheme.requiredDocuments.map(docId => {
                    const isVerified = profile.verifiedDocuments?.[docId]?.verified;
                    const docLabel = getDocumentLabel(docId, currentLanguage);
                    return (
                      <div
                        key={docId}
                        className={`p-2.5 rounded-xl text-xs border flex items-center justify-between gap-2 ${
                          isVerified
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          {isVerified ? (
                            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <div className="truncate font-bold">{docLabel}</div>
                        </div>

                        {isVerified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            ✓ {t('Verified', 'सत्यापित', 'पक्को')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSchemeDetail(null);
                              handleOpenDigiLockerForDoc(docId);
                            }}
                            className="text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded-lg border border-amber-300 transition whitespace-nowrap cursor-pointer"
                          >
                            {t('+ Verify Now', '+ सत्यापित करें', '+ लॉकर सूं जोड़ो')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
              <a
                href={resolveSchemePortalUrl(selectedSchemeDetail.scheme)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-4 py-2 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl inline-flex items-center justify-center gap-1.5 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {t(
                    `Open ${getOfficialPortalDisplayHost(selectedSchemeDetail.scheme)}`,
                    `${getOfficialPortalDisplayHost(selectedSchemeDetail.scheme)} खोलें`,
                    `${getOfficialPortalDisplayHost(selectedSchemeDetail.scheme)} खोलो`
                  )}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSchemeDetail(null)}
                  className="min-h-[42px] px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer"
                >
                  {t('Close', 'बंद करें', 'बंद करो')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const s = selectedSchemeDetail.scheme;
                    setSelectedSchemeDetail(null);
                    onApplyScheme(s, profile);
                  }}
                  className="min-h-[42px] px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs cursor-pointer"
                >
                  {t('Proceed to Online Intake', 'ऑनलाइन आवेदन के लिए आगे बढ़ें', 'ऑनलाइन अर्जी भरवा आगे बढ़ो')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
