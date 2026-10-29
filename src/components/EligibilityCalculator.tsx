import React, { useState, useMemo } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  FileText, 
  ArrowRight, 
  Sparkles, 
  Sliders, 
  MapPin, 
  Briefcase, 
  Users, 
  IndianRupee, 
  ExternalLink,
  ShieldAlert,
  Info,
  Bookmark,
  Check,
  Plus
} from 'lucide-react';
import { 
  CitizenProfile, 
  Scheme, 
  SchemeEligibilityResult, 
  SupportedLanguage,
  JanpadBlock,
  Category,
  Gender,
  OccupationType,
  MaritalStatus
} from '../types';
import { IMC_WARDS, JANPAD_BLOCKS, GOVERNANCE_LEVEL_NAMES } from '../data/indoreGovernance';
import { evaluateSchemeEligibility, rankSchemesForCitizen } from '../utils/rulesEngine';

export const DOCUMENT_NAMES: Record<string, { en: string; hi: string; sampleNumber: string }> = {
  aadhaar: { en: 'Aadhaar Card', hi: 'आधार कार्ड', sampleNumber: 'UID-XXXX-XXXX-8192' },
  samagra_member: { en: 'Samagra Member ID', hi: 'समग्र सदस्य आईडी', sampleNumber: 'SPR-109283742' },
  samagra_family: { en: 'Samagra Family ID', hi: 'समग्र परिवार आईडी', sampleNumber: 'SPR-48921840' },
  mp_domicile: { en: 'MP Domicile Certificate', hi: 'म.प्र. मूल निवासी प्रमाण पत्र', sampleNumber: 'MP-DOM-2024-912' },
  income_cert: { en: 'Income Certificate', hi: 'आय प्रमाण पत्र', sampleNumber: 'MP-INC-2026-4421' },
  khasra_b1: { en: 'Land Record Khasra B-1', hi: 'खसरा / बी-1 खतौनी', sampleNumber: 'BHULEKH-IND-8819' },
  caste_cert: { en: 'Caste Certificate', hi: 'जाति प्रमाण पत्र', sampleNumber: 'MP-CST-2025-1029' },
  bank_dbt: { en: 'Bank Passbook (DBT Active)', hi: 'बैंक खाता डीबीटी पासबुक', sampleNumber: 'NPCI-BOI-8192' },
  udid_card: { en: 'UDID Disability Card', hi: 'यूडीआईडी दिव्यांग प्रमाण पत्र', sampleNumber: 'MP-DIS-2023-401' },
  vendor_id: { en: 'Street Vendor ID / LOR', hi: 'स्ट्रीट वेंडर पहचान पत्र', sampleNumber: 'IMC-SV-2026-771' },
  bpl_ration: { en: 'BPL Ration Card', hi: 'बीपीएल राशन कार्ड', sampleNumber: 'NFSA-MP-49120' },
  sambal_card: { en: 'Sambal 2.0 Card', hi: 'संबल 2.0 कार्ड', sampleNumber: 'SAMBAL-2026-993' },
  elec_bill: { en: 'Electricity Bill', hi: 'विद्युत बिल', sampleNumber: 'MPPKVVCL-99214' },
  birth_cert: { en: 'Birth Certificate', hi: 'जन्म प्रमाण पत्र', sampleNumber: 'IMC-BIRTH-2022-09' },
};

interface EligibilityCalculatorProps {
  schemes: Scheme[];
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  setProfile: React.Dispatch<React.SetStateAction<CitizenProfile>>;
  onApplyScheme: (scheme: Scheme, profile: CitizenProfile) => void;
  onNavigateToDigilocker: () => void;
  savedSchemeIds?: string[];
  onToggleSaveScheme?: (scheme: Scheme) => void;
}

export const EligibilityCalculator: React.FC<EligibilityCalculatorProps> = ({
  schemes,
  currentLanguage,
  profile,
  setProfile,
  onApplyScheme,
  onNavigateToDigilocker,
  savedSchemeIds = [],
  onToggleSaveScheme,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'eligible' | 'likely' | 'not_eligible'>('all');
  const [selectedSchemeDetail, setSelectedSchemeDetail] = useState<SchemeEligibilityResult | null>(null);
  const [resolvedDocToast, setResolvedDocToast] = useState<string | null>(null);

  const handleQuickVerifyDoc = (docId: string) => {
    const meta = DOCUMENT_NAMES[docId] || { en: docId, hi: docId, sampleNumber: `DL-${docId.toUpperCase()}` };
    setProfile(p => ({
      ...p,
      verifiedDocuments: {
        ...(p.verifiedDocuments || {}),
        [docId]: {
          verified: true,
          source: 'digilocker',
          docNumber: meta.sampleNumber,
          verifiedAt: new Date().toISOString(),
        },
      },
    }));
    setResolvedDocToast(`${meta.en} (${meta.hi}) verified in DigiLocker! Recalculating eligibility to 100% Eligible.`);
    setTimeout(() => setResolvedDocToast(null), 4000);
  };

  // Real-time evaluation of all schemes
  const eligibilityResults = useMemo(() => {
    return rankSchemesForCitizen(profile, schemes);
  }, [profile, schemes]);

  const counts = useMemo(() => {
    return {
      all: eligibilityResults.length,
      eligible: eligibilityResults.filter(r => r.status === 'eligible').length,
      likely: eligibilityResults.filter(r => r.status === 'likely').length,
      not_eligible: eligibilityResults.filter(r => r.status === 'not_eligible').length,
    };
  }, [eligibilityResults]);

  const displayedResults = useMemo(() => {
    if (filterTab === 'all') return eligibilityResults;
    return eligibilityResults.filter(r => r.status === filterTab);
  }, [eligibilityResults, filterTab]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
              {currentLanguage === 'hi' ? 'रीयल-टाइम नियम इंजन' : currentLanguage === 'malwi' ? 'सीधा पात्रता कैलकुलेटर' : 'Real-Time JSON Rules Engine'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'योजना पात्रता कैलकुलेटर (Find My Schemes)'
              : currentLanguage === 'malwi'
              ? 'म्हारी पात्रता जांचो (Find My Schemes)'
              : 'Find My Schemes & Entitlement Calculator'}
          </h2>
          <p className="text-sm text-slate-500">
            {currentLanguage === 'hi'
              ? 'अपनी जानकारी दर्ज कीजिए — नियम इंजन तुरंत आपकी पात्रता, कारण एवं आवश्यक दस्तावेज दिखाएगा।'
              : 'Adjust your citizen profile below. The declarative rule engine recomputes eligibility instantly.'}
          </p>
        </div>

        {/* Status Counter Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterTab('eligible')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterTab === 'eligible'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle className="w-4 h-4 text-emerald-500 fill-current" />
            <span>Eligible: {counts.eligible}</span>
          </button>

          <button
            onClick={() => setFilterTab('likely')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterTab === 'likely'
                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Likely: {counts.likely}</span>
          </button>

          <button
            onClick={() => setFilterTab('not_eligible')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterTab === 'not_eligible'
                ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
            }`}
          >
            <XCircle className="w-4 h-4 text-slate-400" />
            <span>Not Eligible: {counts.not_eligible}</span>
          </button>

          <button
            onClick={() => setFilterTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filterTab === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All: {counts.all}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: Reactive Profile Form (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900 text-sm">Citizen Profile Parameters</h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Reactive Live Engine
            </span>
          </div>

          {/* Area Type Toggle: Urban IMC vs Rural Janpad */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              1. Area of Residence (क्षेत्र प्रकार):
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProfile(p => ({ ...p, areaType: 'urban', wardNumber: p.wardNumber || 72 }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                  profile.areaType === 'urban'
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                IMC Urban (वार्ड 1-85)
              </button>
              <button
                type="button"
                onClick={() => setProfile(p => ({ ...p, areaType: 'rural', blockName: p.blockName || 'Depalpur' }))}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                  profile.areaType === 'rural'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Rural Janpad (4 ब्लॉक)
              </button>
            </div>
          </div>

          {/* Ward Selector (if urban) or Janpad Block (if rural) */}
          {profile.areaType === 'urban' ? (
            <div>
              <label htmlFor="wardSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                Indore Municipal Ward (वार्ड 1 से 85):
              </label>
              <select
                id="wardSelect"
                value={profile.wardNumber || 72}
                onChange={e => setProfile(p => ({ ...p, wardNumber: Number(e.target.value) }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                {IMC_WARDS.map(w => (
                  <option key={w.number} value={w.number}>
                    Ward {w.number}: {w.name} (Zone {w.zone})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label htmlFor="janpadSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                  Janpad Block (जनपद पंचायत):
                </label>
                <select
                  id="janpadSelect"
                  value={profile.blockName || 'Depalpur'}
                  onChange={e => setProfile(p => ({ ...p, blockName: e.target.value as JanpadBlock }))}
                  className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                >
                  {JANPAD_BLOCKS.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name} Block ({b.panchayatCount} Panchayats)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500">Gram Panchayat Sample:</label>
                <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                  {JANPAD_BLOCKS.find(b => b.name === (profile.blockName || 'Depalpur'))?.popularPanchayats.join(', ')}
                </div>
              </div>
            </div>
          )}

          {/* Age & Gender */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="ageInput" className="text-xs font-semibold text-slate-700">Age (आयु):</label>
                <span className="text-xs font-bold text-amber-700">{profile.age} yrs</span>
              </div>
              <input
                id="ageInput"
                type="range"
                min="0"
                max="85"
                value={profile.age}
                onChange={e => setProfile(p => ({ ...p, age: Number(e.target.value) }))}
                className="w-full accent-amber-600"
              />
            </div>

            <div>
              <label htmlFor="genderSelect" className="block text-xs font-semibold text-slate-700 mb-1">Gender (लिंग):</label>
              <select
                id="genderSelect"
                value={profile.gender}
                onChange={e => setProfile(p => ({ ...p, gender: e.target.value as Gender }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              >
                <option value="female">Female (महिला)</option>
                <option value="male">Male (पुरुष)</option>
                <option value="transgender">Transgender (तृतीय लिंग)</option>
              </select>
            </div>
          </div>

          {/* Occupation */}
          <div>
            <label htmlFor="occupationSelect" className="block text-xs font-semibold text-slate-700 mb-1">
              Occupation (पेशा / व्यवसाय):
            </label>
            <select
              id="occupationSelect"
              value={profile.occupation}
              onChange={e => setProfile(p => ({ ...p, occupation: e.target.value as OccupationType }))}
              className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              <option value="Farmer">Farmer (किसान / हलवा)</option>
              <option value="Street Vendor">Street Vendor (रेहड़ी-पटरी / ठेला व्यवसायी)</option>
              <option value="Homemaker">Homemaker (गृहिणी / घरेलू महिला)</option>
              <option value="Student">Student (विद्यार्थी / छात्र)</option>
              <option value="Construction Worker">Construction / Daily Laborer (मजदूर / हमाल)</option>
              <option value="Artisan / Handicraft">Artisan / Handicraft (शिल्पकार / विश्वकर्मा)</option>
              <option value="Gig Worker / Driver">Gig Worker / Driver (ऑटो/टैक्सी चालक / डिलीवरी)</option>
              <option value="Small Business">Small Business / Shopkeeper (लघु व्यापारी)</option>
              <option value="Unemployed">Unemployed Youth (बेरोजगार युवा)</option>
              <option value="Senior Citizen">Senior Citizen (वरिष्ठ नागरिक)</option>
              <option value="Other">Other (अन्य)</option>
            </select>
          </div>

          {/* Annual Family Income */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="incomeInput" className="text-xs font-semibold text-slate-700">Annual Family Income (वार्षिक आय):</label>
              <span className="text-xs font-bold text-amber-700 font-mono">
                ₹{profile.annualIncome.toLocaleString('en-IN')}
              </span>
            </div>
            <input
              id="incomeInput"
              type="range"
              min="0"
              max="1000000"
              step="10000"
              value={profile.annualIncome}
              onChange={e => setProfile(p => ({ ...p, annualIncome: Number(e.target.value) }))}
              className="w-full accent-amber-600"
            />
            {/* Quick Presets */}
            <div className="flex gap-1.5 mt-1">
              {[
                { label: '₹0 (BPL)', val: 0 },
                { label: '₹1.2L', val: 120000 },
                { label: '₹2.5L', val: 250000 },
                { label: '₹5L', val: 500000 },
              ].map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, annualIncome: preset.val }))}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 rounded"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Agricultural Landholding (Visible for farmers & rural/landowning citizens) */}
          <div className="p-3.5 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="landholdingInput" className="text-xs font-semibold text-emerald-950 flex items-center space-x-1">
                <span>🌾 Agricultural Land (खसरा कृषि भूमि):</span>
              </label>
              <div className="flex items-center space-x-1">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  value={profile.landHoldingHectares}
                  onChange={e => setProfile(p => ({ ...p, landHoldingHectares: Math.max(0, Number(e.target.value)) }))}
                  className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-900 bg-white border border-emerald-300 rounded text-right"
                />
                <span className="text-xs font-bold text-emerald-800">Ha</span>
              </div>
            </div>

            <input
              id="landholdingInput"
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={profile.landHoldingHectares}
              onChange={e => setProfile(p => ({ ...p, landHoldingHectares: Number(e.target.value) }))}
              className="w-full accent-emerald-600 cursor-pointer"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1 pt-0.5">
              {[
                { label: '0 Ha (Landless)', val: 0 },
                { label: '0.5 Ha', val: 0.5 },
                { label: '1.5 Ha (Small)', val: 1.5 },
                { label: '2.5 Ha', val: 2.5 },
                { label: '5.0 Ha', val: 5.0 },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setProfile(p => ({ ...p, landHoldingHectares: preset.val }))}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded transition cursor-pointer border ${
                    profile.landHoldingHectares === preset.val
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {profile.landHoldingHectares > 0 && (
              <div className="text-[10px] text-emerald-800 font-medium flex items-center space-x-1 pt-1 border-t border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                <span>Qualifies for PM-KISAN, PMFBY, PM-KUSUM & MP Kisan Kalyan</span>
              </div>
            )}
          </div>

          {/* Social Category & Marital Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="categorySelect" className="block text-xs font-semibold text-slate-700 mb-1">Social Category:</label>
              <select
                id="categorySelect"
                value={profile.category}
                onChange={e => setProfile(p => ({ ...p, category: e.target.value as Category }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800"
              >
                <option value="GEN">General (सामान्य)</option>
                <option value="OBC">OBC (अन्य पिछड़ा वर्ग)</option>
                <option value="SC">SC (अनुसूचित जाति)</option>
                <option value="ST">ST (अनुसूचित जनजाति)</option>
                <option value="EWS">EWS (आर्थिक कमजोर)</option>
              </select>
            </div>

            <div>
              <label htmlFor="maritalSelect" className="block text-xs font-semibold text-slate-700 mb-1">Marital Status:</label>
              <select
                id="maritalSelect"
                value={profile.maritalStatus}
                onChange={e => setProfile(p => ({ ...p, maritalStatus: e.target.value as MaritalStatus }))}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800"
              >
                <option value="Married">Married (विवाहित)</option>
                <option value="Unmarried">Unmarried (अविवाहित)</option>
                <option value="Widow">Widow (विधवा)</option>
                <option value="Divorced">Divorced (परित्यक्ता)</option>
              </select>
            </div>
          </div>

          {/* Checkboxes: BPL, Disability, MP Domicile */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.isBPL}
                onChange={e => setProfile(p => ({ ...p, isBPL: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">BPL / Antyodaya Ration Card Holder</span>
            </label>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.hasDisability}
                onChange={e => setProfile(p => ({ ...p, hasDisability: e.target.checked, disabilityPercent: e.target.checked ? 45 : 0 }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">Divyangjan / Disability (दिव्यांग 40%+)</span>
            </label>

            <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.isMpDomicile}
                onChange={e => setProfile(p => ({ ...p, isMpDomicile: e.target.checked }))}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-medium">Resident of Madhya Pradesh (मूल निवासी)</span>
            </label>
          </div>
        </div>

        {/* RIGHT COLUMN: Scheme Results Cards (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          {resolvedDocToast && (
            <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between shadow-md animate-fade-in">
              <div className="flex items-center space-x-2">
                <Check className="w-4 h-4 shrink-0 bg-white/20 p-0.5 rounded-full" />
                <span>{resolvedDocToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setResolvedDocToast(null)}
                className="text-white/80 hover:text-white font-bold ml-2 text-sm"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200">
            <span>
              Showing <strong className="text-slate-800">{displayedResults.length}</strong> matching schemes for profile
            </span>
            <button
              onClick={onNavigateToDigilocker}
              className="text-amber-700 hover:text-amber-900 font-semibold flex items-center space-x-1"
            >
              <span>View DigiLocker Verified Docs</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {displayedResults.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <Info className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800">No schemes in this filter tab</h4>
              <p className="text-xs text-slate-500 mt-1">Try selecting the "All" or "Eligible" tab above.</p>
            </div>
          ) : (
            displayedResults.map(result => {
              const { scheme, status, matchScore, passingReasons, failingReasons, missingDocuments } = result;

              const levelMeta = GOVERNANCE_LEVEL_NAMES[scheme.governanceLevel];

              const statusBadgeConfig = {
                eligible: {
                  label: 'ELIGIBLE',
                  labelHi: 'पात्र',
                  bg: 'bg-emerald-500 text-white',
                  cardBorder: 'border-emerald-300 shadow-emerald-50',
                  icon: CheckCircle,
                },
                likely: {
                  label: 'LIKELY',
                  labelHi: 'संभावित',
                  bg: 'bg-amber-500 text-white',
                  cardBorder: 'border-amber-300 shadow-amber-50',
                  icon: AlertTriangle,
                },
                not_eligible: {
                  label: 'NOT ELIGIBLE',
                  labelHi: 'अपात्र',
                  bg: 'bg-slate-400 text-white',
                  cardBorder: 'border-slate-200 opacity-80',
                  icon: XCircle,
                },
              }[status];

              const Icon = statusBadgeConfig.icon;

              return (
                <div
                  key={scheme.id}
                  className={`bg-white rounded-2xl border p-5 transition shadow-xs hover:shadow-md ${statusBadgeConfig.cardBorder}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Top Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center space-x-1 ${statusBadgeConfig.bg}`}>
                          <Icon className="w-3 h-3 mr-0.5" />
                          <span>{currentLanguage === 'hi' ? statusBadgeConfig.labelHi : statusBadgeConfig.label}</span>
                          <span>• {matchScore}%</span>
                        </span>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {levelMeta.en}
                        </span>

                        <span className="text-[10px] font-mono text-slate-400 font-semibold">
                          {scheme.code}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {currentLanguage === 'hi' ? scheme.titleHindi : currentLanguage === 'malwi' ? scheme.titleMalwi : scheme.title}
                      </h4>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        {currentLanguage === 'hi' ? scheme.descriptionHindi : scheme.description}
                      </p>
                    </div>

                    {/* Financial Benefit Badge */}
                    <div className="sm:text-right shrink-0 bg-slate-50 sm:bg-transparent p-2 sm:p-0 rounded-xl">
                      <div className="text-[11px] font-medium text-slate-500">Financial Benefit</div>
                      <div className="text-lg font-black text-amber-600 font-mono">
                        {scheme.financialEntitlement.frequency === 'In-Kind / Service' ? (
                          'In-Kind / Grant'
                        ) : (
                          `₹${scheme.financialEntitlement.amount.toLocaleString('en-IN')}`
                        )}
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">
                        {scheme.financialEntitlement.frequency}
                      </div>
                    </div>
                  </div>

                  {/* Reasons Section */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                    {/* Passing Reasons */}
                    {passingReasons.length > 0 && (
                      <div className="flex items-start space-x-2 text-xs text-emerald-800">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span><strong>Qualifies:</strong> {passingReasons.slice(0, 2).join(' • ')}</span>
                      </div>
                    )}

                    {/* Failing Reasons */}
                    {failingReasons.length > 0 && (
                      <div className="flex items-start space-x-2 text-xs text-rose-800">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span><strong>Does not match:</strong> {failingReasons.join(' • ')}</span>
                      </div>
                    )}

                    {/* Missing Documents Interactive Resolution */}
                    {missingDocuments.length > 0 && status !== 'not_eligible' && (
                      <div className="mt-3 p-3 rounded-xl bg-amber-50/90 border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              {missingDocuments.length} Pending Document{missingDocuments.length > 1 ? 's' : ''} to reach 100% Eligible:
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={onNavigateToDigilocker}
                            className="text-[11px] font-bold text-amber-800 hover:text-amber-950 underline flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Open DigiLocker Wallet</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Interactive Clickable Badges with English & Hindi */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {missingDocuments.map(docId => {
                            const docMeta = DOCUMENT_NAMES[docId] || { en: docId, hi: docId };
                            return (
                              <button
                                key={docId}
                                type="button"
                                onClick={() => handleQuickVerifyDoc(docId)}
                                className="group inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 border border-amber-300 hover:border-emerald-400 shadow-2xs transition cursor-pointer"
                                title={`Click to verify ${docMeta.en} (${docMeta.hi}) in DigiLocker to upgrade scheme to 100% Eligible`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 group-hover:bg-emerald-500"></span>
                                <span className="font-semibold">{docMeta.en}</span>
                                <span className="text-[10px] text-slate-500 group-hover:text-emerald-700">({docMeta.hi})</span>
                                <span className="ml-1 text-[10px] font-bold bg-amber-100 group-hover:bg-emerald-200 text-amber-900 group-hover:text-emerald-900 px-1 rounded">
                                  + Verify
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="truncate max-w-[280px]">Nodal Office: {scheme.nodalOfficeIndore}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {onToggleSaveScheme && (
                        <button
                          onClick={() => onToggleSaveScheme(scheme)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs transition cursor-pointer flex items-center space-x-1 ${
                            savedSchemeIds.includes(scheme.id)
                              ? 'bg-amber-100 border-amber-300 text-amber-800 font-bold'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-amber-700 hover:border-amber-300'
                          }`}
                          title={savedSchemeIds.includes(scheme.id) ? 'Saved in cloud profile (Click to remove)' : 'Save scheme to cloud profile'}
                        >
                          <Bookmark className={`w-3.5 h-3.5 ${savedSchemeIds.includes(scheme.id) ? 'fill-amber-600 text-amber-600' : ''}`} />
                          <span className="text-[11px] hidden sm:inline">{savedSchemeIds.includes(scheme.id) ? 'Saved' : 'Save'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => setSelectedSchemeDetail(result)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                      >
                        Rules Breakdown
                      </button>

                      <button
                        onClick={() => onApplyScheme(scheme, profile)}
                        className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 transition flex items-center space-x-1 shadow-xs cursor-pointer"
                      >
                        <span>Apply / Register</span>
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

      {/* Rules Breakdown Detail Modal */}
      {selectedSchemeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-amber-700 uppercase">
                  {GOVERNANCE_LEVEL_NAMES[selectedSchemeDetail.scheme.governanceLevel].en}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  {selectedSchemeDetail.scheme.title}
                </h3>
                <p className="text-xs text-slate-500 font-devanagari font-bold mt-0.5">
                  {selectedSchemeDetail.scheme.titleHindi}
                </p>
              </div>
              <button
                onClick={() => setSelectedSchemeDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Scheme Details */}
            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><strong>Department:</strong> {selectedSchemeDetail.scheme.department}</div>
                <div><strong>Nodal Office in Indore:</strong> {selectedSchemeDetail.scheme.nodalOfficeIndore}</div>
                <div><strong>District Helpline:</strong> {selectedSchemeDetail.scheme.helpline}</div>
              </div>

              {/* Individual Rules Evaluation Breakdown */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Declarative JSON Rule Evaluations ({selectedSchemeDetail.ruleEvaluations.length} Rules Checked):
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
                        <div className="font-bold">{evalItem.ruleName}</div>
                        <div className="text-[11px] opacity-90">{evalItem.reason}</div>
                        <div className="text-[11px] opacity-75 font-devanagari">{evalItem.reasonHindi}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Documents Checklist */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Required Documents Checklist & DigiLocker Status:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedSchemeDetail.scheme.requiredDocuments.map(docId => {
                    const isVerified = profile.verifiedDocuments?.[docId]?.verified;
                    const docMeta = DOCUMENT_NAMES[docId] || { en: docId, hi: docId };
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
                          <div className="truncate">
                            <div className="font-bold truncate">{docMeta.en}</div>
                            <div className="text-[10px] text-slate-500">{docMeta.hi}</div>
                          </div>
                        </div>

                        {isVerified ? (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                            ✓ Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuickVerifyDoc(docId)}
                            className="text-[10px] font-bold text-amber-900 bg-amber-100 hover:bg-emerald-600 hover:text-white px-2 py-1 rounded-lg border border-amber-300 transition whitespace-nowrap cursor-pointer"
                          >
                            + Verify Now
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end space-x-3">
              <button
                onClick={() => setSelectedSchemeDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const s = selectedSchemeDetail.scheme;
                  setSelectedSchemeDetail(null);
                  onApplyScheme(s, profile);
                }}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs"
              >
                Proceed to Online Intake
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
