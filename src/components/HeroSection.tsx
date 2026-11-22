import React from 'react';
import { Search, Filter, ArrowRight, X, CheckCircle2, RotateCcw } from 'lucide-react';
import { SupportedLanguage } from '../types';
import { pickText } from '../utils/i18n';

interface HeroSectionProps {
  currentLanguage: SupportedLanguage;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedLevel: string;
  setSelectedLevel: (lvl: string) => void;
  onOpenCalculator: () => void;
  onOpenEntitlementCard?: () => void;
  onOpenComparison?: () => void;
  totalSchemesCount: number;
  isProfileFilterApplied?: boolean;
  onClearProfileFilter?: () => void;
  onResetAllCriteria?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  currentLanguage,
  searchQuery,
  setSearchQuery,
  selectedLevel,
  setSelectedLevel,
  onOpenCalculator,
  onOpenEntitlementCard,
  onOpenComparison,
  totalSchemesCount,
  isProfileFilterApplied = false,
  onClearProfileFilter,
  onResetAllCriteria,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const malwiSuggestions = [
    {
      label: t('Ladli Behna (₹1,500/mo)', 'लाड़ली बहना (₹1,500/माह)', 'लाड़ली बहना (₹1,500/महीनो)'),
      query: 'लाडली बहना',
    },
    {
      label: t('Housing / Tapro (₹2.5L)', 'आवास / टापरो (₹2.5L)', 'टापरो / पक्को घर (₹2.5L)'),
      query: 'टापरो आवास',
    },
    {
      label: t('Farmer / Halwa (₹12,000/yr)', 'किसान / हलवा (₹12,000/वर्ष)', 'हलवा / किसान (₹12,000/साल)'),
      query: 'हलवा किसान',
    },
    {
      label: t('Street Vendor Loan', 'ठेला / स्वनिधि ऋण', 'ठेलो / स्वनिधि कर्जो'),
      query: 'ठेलो स्वनिधि',
    },
    {
      label: t('Ayushman Health Card', 'आयुष्मान स्वास्थ्य कार्ड', 'पीलो पत्तो / आयुष्मान इलाज'),
      query: 'आयुष्मान',
    },
    {
      label: t('Malwi Cow Dairy', 'मालवी गाय पालन', 'माळवी गाय पालन अनुदान'),
      query: 'मालवी गाय',
    },
    {
      label: t('Solar Panel Subsidy', 'सोलर पैनल अनुदान', 'सोलर पैनल छूट'),
      query: 'सोलर',
    },
    {
      label: t('Divyang Tricycle', 'दिव्यांग ट्राईसाइकिल', 'दिव्यांग ट्राईसाइकिल मदद'),
      query: 'दिव्यांग',
    },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-slate-50 to-white border-b border-slate-200 py-7 sm:py-12">
      {/* Subtle decorative background elements */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Kicker */}
          <p className="text-xs font-bold text-amber-800 tracking-wide mb-2.5">
            {t(
              'Indore District & MP State Unified Citizen Scheme Discovery',
              'इंदौर जिला एवं मध्य प्रदेश शासन का एकीकृत नागरिक पोर्टल',
              'आपणो इंदौर — 6 स्तर री सगळी सरकारी योजना एक ही जगह'
            )}
          </p>

          {/* Heading */}
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight font-heading text-balance">
            {currentLanguage === 'hi' ? (
              <>
                1,000+ सरकारी योजनाएं, <span className="text-amber-600">खोजिए वे चुनिंदा जो सचमुच आपकी हैं</span>
              </>
            ) : currentLanguage === 'malwi' ? (
              <>
                1,000+ सरकारी योजना, <span className="text-amber-600">खोजो वे गिणी-चुणी जो असल में थारी हैं</span>
              </>
            ) : (
              <>
                1,000+ government schemes, <span className="text-amber-600">find the handful that are truly yours</span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            {t(
              'Discover certified benefits across 6 Governance Levels: International, Central, MP State, Indore Collectorate, IMC Urban Wards 1-85, and Rural Janpad Blocks.',
              'अंतर्राष्ट्रीय (ADB), राष्ट्रीय, म.प्र. राज्य, कलेक्ट्रेट, नगर निगम वार्ड 1-85 एवं जनपद (इंदौर, महू, सांवेर, देपालपुर) की वास्तविक पात्रता जांचिए व सीधे आवेदन कीजिए।',
              'अंतर्राष्ट्रीय, केंद्र, म.प्र. सरकार, इंदौर कलेक्टर, नगर निगम रा 1-85 वार्ड अने चारों जनपद (इंदौर, महू, सांवेर, देपालपुर) री पक्की पात्रता जांचो अने सीधी अर्जी लगावो।'
            )}
          </p>

          {/* Quick Civic Action Buttons */}
          <div className="mt-5 flex flex-col sm:flex-row flex-wrap justify-center items-stretch sm:items-center gap-2.5">
            {onOpenEntitlementCard && (
              <button
                type="button"
                onClick={onOpenEntitlementCard}
                className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>
                  {t(
                    'Citizen Entitlement Certificate',
                    'नागरिक पात्रता प्रमाण-पत्र',
                    'म्हारो नागरिक पात्रता कागद'
                  )}
                </span>
              </button>
            )}
            {onOpenComparison && (
              <button
                type="button"
                onClick={onOpenComparison}
                className="min-h-[42px] inline-flex items-center justify-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <span>
                  {t(
                    'Compare Schemes (Side-by-Side)',
                    'योजना तुलना (Side-by-Side)',
                    'योजना री तुलना करो'
                  )}
                </span>
              </button>
            )}
          </div>

          {/* Responsive Search Bar (Stacks cleanly on mobile, inline on sm+) */}
          <div className="mt-6 sm:mt-8 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 shadow-lg shadow-slate-200/80 rounded-2xl bg-white border border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition p-2 sm:p-1.5">
              <div className="flex items-center flex-1 min-w-0">
                <div className="pl-2.5 sm:pl-3 text-slate-400 shrink-0">
                  <Search className="w-5 h-5 text-amber-600" />
                </div>
                <input
                  id="hero-scheme-search"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t(
                    'Search English, Hindi or Malwi (Tapro, Farmer, Ladli)...',
                    'योजना, व्यवसाय, वार्ड खोजें (लाड़ली बहना, किसान, आवास)...',
                    'माळवी या हिन्दी मां खोजो (टापरो, हलवा, बाईजी, ठेलो)...'
                  )}
                  className="w-full min-w-0 px-2.5 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden bg-transparent"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer shrink-0"
                  >
                    {t('Clear', 'हटाएं', 'हटावो')}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={onOpenCalculator}
                className="w-full sm:w-auto min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer shrink-0"
              >
                <span>{t('Check Eligibility', 'पात्रता जांचें', 'पात्रता जांचो')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zero-Match Quick Restart Notice */}
            {totalSchemesCount === 0 && (
              <div
                role="status"
                className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-left"
              >
                <span className="font-semibold">
                  {t(
                    'Modify your search criteria — no schemes matched your current query or filters.',
                    'Modify your search criteria — वर्तमान खोज या फ़िल्टर में कोई योजना नहीं मिली।',
                    'Modify your search criteria — अभी री खोज मां कोई योजना नी मिली।'
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (onResetAllCriteria) onResetAllCriteria();
                    else {
                      setSearchQuery('');
                      setSelectedLevel('all');
                      onClearProfileFilter?.();
                    }
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold whitespace-nowrap cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('Modify Your Search Criteria', 'खोज मापदंड बदलें', 'खोज बदलो')}</span>
                </button>
              </div>
            )}

            {/* Vernacular Malwi / Hindi Quick Search Buttons */}
            <div className="mt-3 flex items-center justify-start sm:justify-center overflow-x-auto sm:overflow-visible sm:flex-wrap gap-1.5 pb-1 sm:pb-0 text-xs no-scrollbar">
              <span className="text-slate-500 font-medium mr-1 whitespace-nowrap shrink-0">
                {t('Popular terms:', 'लोकप्रिय खोज:', 'जल्दी खोजो:')}
              </span>
              {malwiSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSearchQuery(item.query)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer whitespace-nowrap shrink-0 ${
                    searchQuery.toLowerCase().includes(item.query.toLowerCase())
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 6 Governance Levels Pill Row */}
        <div className="mt-10 pt-6 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {t(
                  'Filter by 6 Levels of Governance:',
                  'शासन के 6 स्तरों से फ़िल्टर करें:',
                  '6 सरकार स्तर सूं योजना छांटो:'
                )}
              </span>
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded border inline-flex items-center gap-1.5 ${
                  isProfileFilterApplied
                    ? 'text-emerald-900 bg-emerald-50 border-emerald-300'
                    : 'text-amber-800 bg-amber-50 border-amber-200'
                }`}
              >
                {isProfileFilterApplied && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {isProfileFilterApplied
                  ? t(
                      `${totalSchemesCount} Schemes Matching Your Criteria`,
                      `आपके मापदंड के अनुसार ${totalSchemesCount} योजनाएं`,
                      `थारी जानकारी मुजब ${totalSchemesCount} पात्र योजना मिल्या छे`
                    )
                  : t(
                      `${totalSchemesCount} Active District Schemes`,
                      `${totalSchemesCount} सक्रिय जिला योजनाएं`,
                      `${totalSchemesCount} चालू जिला योजना`
                    )}
              </span>
              {isProfileFilterApplied && onClearProfileFilter && (
                <button
                  type="button"
                  onClick={onClearProfileFilter}
                  className="text-[11px] font-bold px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>{t('Show All', 'सभी दिखाएं', 'सगळी दिखावो')}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <button
              type="button"
              onClick={() => setSelectedLevel('all')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[10px] opacity-75">
                {t('All Schemes', 'सभी योजनाएं', 'सगळी योजना')}
              </div>
              <div className="font-bold truncate">
                {t('All 6 Levels', 'सभी 6 स्तर', 'सगळा 6 स्तर')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('international')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'international'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'international' ? 'text-indigo-100' : 'text-indigo-500'}`}>
                {t('Level 1', 'स्तर 1', 'स्तर 1')}
              </div>
              <div className="font-bold truncate">
                {t('International / ADB', 'अंतर्राष्ट्रीय / ADB', 'अंतर्राष्ट्रीय / ADB')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('national')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'national'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'national' ? 'text-blue-100' : 'text-blue-500'}`}>
                {t('Level 2', 'स्तर 2', 'स्तर 2')}
              </div>
              <div className="font-bold truncate">
                {t('National (Centre)', 'राष्ट्रीय (केंद्र)', 'केंद्र सरकार')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('state_mp')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'state_mp'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'state_mp' ? 'text-emerald-100' : 'text-emerald-500'}`}>
                {t('Level 3', 'स्तर 3', 'स्तर 3')}
              </div>
              <div className="font-bold truncate">
                {t('MP State Govt', 'म.प्र. राज्य शासन', 'म.प्र. सरकार')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('district_indore')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'district_indore'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'district_indore' ? 'text-amber-100' : 'text-amber-500'}`}>
                {t('Level 4', 'स्तर 4', 'स्तर 4')}
              </div>
              <div className="font-bold truncate">
                {t('Indore Collectorate', 'इंदौर कलेक्ट्रेट', 'इंदौर कलेक्टर')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('urban_imc')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'urban_imc'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'urban_imc' ? 'text-teal-100' : 'text-teal-500'}`}>
                {t('Level 5', 'स्तर 5', 'स्तर 5')}
              </div>
              <div className="font-bold truncate">
                {t('IMC Wards 1-85', 'नगर निगम वार्ड 1-85', 'निगम वार्ड 1-85')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedLevel('rural_janpad')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border cursor-pointer ${
                selectedLevel === 'rural_janpad'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className={`text-[10px] font-bold ${selectedLevel === 'rural_janpad' ? 'text-rose-100' : 'text-rose-500'}`}>
                {t('Level 6', 'स्तर 6', 'स्तर 6')}
              </div>
              <div className="font-bold truncate">
                {t('Rural Janpads (4)', 'ग्रामीण जनपद (4)', 'गाँव जनपद (4)')}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
