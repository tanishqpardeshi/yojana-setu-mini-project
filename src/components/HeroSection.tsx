import React from 'react';
import { Search, Sparkles, Filter, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import { SupportedLanguage } from '../types';

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
}) => {
  const malwiSuggestions = [
    { label: 'लाडली बहना (₹1,500/माह)', query: 'लाडली बहना' },
    { label: 'टापरो / आवास (₹2.5L)', query: 'टापरो आवास' },
    { label: 'हलवा / किसान (₹12,000/वर्ष)', query: 'हलवा किसान' },
    { label: 'ठेलो / स्वनिधि ऋण', query: 'ठेलो स्वनिधि' },
    { label: 'पीलो पत्तो / आयुष्मान', query: 'आयुष्मान' },
    { label: 'मालवी गाय पालन', query: 'मालवी गाय' },
    { label: 'सोलर पैनल अनुदान', query: 'सोलर' },
    { label: 'दिव्यांग ट्राईसाइकिल', query: 'दिव्यांग' },
  ];

  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-slate-50 to-white border-b border-slate-200 py-10 sm:py-14">
      {/* Subtle decorative background elements */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 rounded-full bg-orange-400/10 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 bg-amber-100 text-amber-900 px-3 py-1 rounded-full text-xs font-semibold border border-amber-300 mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            <span>
              {currentLanguage === 'hi'
                ? 'इंदौर जिला एवं मध्य प्रदेश शासन का एकीकृत नागरिक पोर्टल'
                : currentLanguage === 'malwi'
                ? 'आपणो इंदौर - 6 स्तर की सगळी सरकारी योजना'
                : 'Indore District & MP State Unified Citizen Scheme Discovery'}
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight font-heading">
            {currentLanguage === 'hi' ? (
              <>
                इंदौर के प्रत्येक नागरिक हेतु <span className="text-amber-600">अधिकार व सरकारी योजना</span> सेतु
              </>
            ) : currentLanguage === 'malwi' ? (
              <>
                इंदौर जिला का सगळा भाई-बहनों खातर <span className="text-amber-600">योजना सेतु</span>
              </>
            ) : (
              <>
                Real-Time Entitlement Discovery for <span className="text-amber-600">Citizens of Indore District</span>
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            {currentLanguage === 'hi'
              ? 'अंतर्राष्ट्रीय (ADB), राष्ट्रीय, म.प्र. राज्य, कलेक्ट्रेट, नगर निगम वार्ड 1-85 एवं जनपद (इंदौर, महू, सांवेर, देपालपुर) की वास्तविक पात्रता जांचिए व सीधे आवेदन कीजिए।'
              : currentLanguage === 'malwi'
              ? 'अंतर्राष्ट्रीय, केंद्र, म.प्र. शासन, इंदौर कलेक्टर, निगम का 1-85 वार्ड व चारों जनपद (इंदौर, महू, सांवेर, देपालपुर) का हक व पावती पावो।'
              : 'Discover certified benefits across 6 Governance Levels: International, Central, MP State, Indore Collectorate, IMC Urban Wards 1-85, and Rural Janpad Blocks.'}
          </p>

          {/* Quick Civic Action Badges */}
          <div className="mt-5 flex flex-wrap justify-center items-center gap-2.5">
            {onOpenEntitlementCard && (
              <button
                onClick={onOpenEntitlementCard}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>📜 नागरिक पात्रता प्रमाण-पत्र</span>
              </button>
            )}
            {onOpenComparison && (
              <button
                onClick={onOpenComparison}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <span>⚖️ योजना तुलना (Side-by-Side)</span>
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-8 max-w-2xl mx-auto">
            <div className="relative flex items-center shadow-lg shadow-slate-200/80 rounded-2xl bg-white border border-slate-300 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition p-1.5">
              <div className="pl-3.5 text-slate-400">
                <Search className="w-5 h-5 text-amber-600" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  currentLanguage === 'hi'
                    ? 'योजना, व्यवसाय, वार्ड या कीवर्ड खोजें (उदा: लाड़ली बहना, किसान, आवास)...'
                    : currentLanguage === 'malwi'
                    ? 'माळवी या हिन्दी में खोजो (उदा: टापरो, हलवा, बाईजी, ठेलो, गाय)...'
                    : 'Search by keyword, English, Hindi or Malwi (e.g. Tapro, Farmer, Ladli, Vendor)...'
                }
                className="w-full px-3 py-2.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-hidden bg-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-2 py-1 text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onOpenCalculator}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 rounded-xl shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap"
              >
                <span>{currentLanguage === 'hi' ? 'पात्रता जांचें' : 'Check Eligibility'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Vernacular Malwi / Hindi Quick Search Chips */}
            <div className="mt-3 flex items-center justify-center flex-wrap gap-1.5 text-xs">
              <span className="text-slate-500 font-medium mr-1 flex items-center">
                <Sparkles className="w-3 h-3 text-amber-500 mr-1" />
                {currentLanguage === 'malwi' ? 'जल्दी खोज:' : 'Popular terms:'}
              </span>
              {malwiSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchQuery(item.query)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter by 6 Levels of Governance:</span>
            </span>
            <span className="text-xs text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {totalSchemesCount} Active District Schemes
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
            <button
              onClick={() => setSelectedLevel('all')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-[10px] opacity-75">All Schemes</div>
              <div className="font-bold truncate">All 6 Levels</div>
            </button>

            <button
              onClick={() => setSelectedLevel('international')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'international'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
            >
              <div className="text-[10px] text-indigo-500 font-bold">Level 1</div>
              <div className="font-bold truncate">International / ADB</div>
            </button>

            <button
              onClick={() => setSelectedLevel('national')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'national'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="text-[10px] text-blue-500 font-bold">Level 2</div>
              <div className="font-bold truncate">National (Centre)</div>
            </button>

            <button
              onClick={() => setSelectedLevel('state_mp')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'state_mp'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
              }`}
            >
              <div className="text-[10px] text-emerald-500 font-bold">Level 3</div>
              <div className="font-bold truncate">MP State Govt</div>
            </button>

            <button
              onClick={() => setSelectedLevel('district_indore')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'district_indore'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
              }`}
            >
              <div className="text-[10px] text-amber-500 font-bold">Level 4</div>
              <div className="font-bold truncate">Indore Collectorate</div>
            </button>

            <button
              onClick={() => setSelectedLevel('urban_imc')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'urban_imc'
                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300'
              }`}
            >
              <div className="text-[10px] text-teal-500 font-bold">Level 5</div>
              <div className="font-bold truncate">IMC Wards 1-85</div>
            </button>

            <button
              onClick={() => setSelectedLevel('rural_janpad')}
              className={`p-2.5 rounded-xl text-xs font-semibold transition text-left border ${
                selectedLevel === 'rural_janpad'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300'
              }`}
            >
              <div className="text-[10px] text-rose-500 font-bold">Level 6</div>
              <div className="font-bold truncate">Rural Janpads (4)</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
