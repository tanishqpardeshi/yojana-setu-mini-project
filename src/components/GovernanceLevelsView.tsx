import React from 'react';
import { 
  Globe2, 
  Flag, 
  Landmark, 
  ShieldCheck, 
  Building, 
  Tractor, 
  ArrowRight, 
  MapPin, 
  PhoneCall, 
  ExternalLink 
} from 'lucide-react';
import { GovernanceLevel, SupportedLanguage, Scheme } from '../types';
import { IMC_WARDS, JANPAD_BLOCKS } from '../data/indoreGovernance';

interface GovernanceLevelsViewProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  onSelectLevel: (level: GovernanceLevel) => void;
}

export const GovernanceLevelsView: React.FC<GovernanceLevelsViewProps> = ({
  currentLanguage,
  schemes,
  onSelectLevel,
}) => {
  const levels = [
    {
      key: 'international' as GovernanceLevel,
      number: '1',
      title: 'International & Multilateral',
      titleHindi: 'स्तर 1: अंतर्राष्ट्रीय व बहुपक्षीय',
      icon: Globe2,
      color: 'indigo',
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      heroBorder: 'border-indigo-200 hover:border-indigo-400',
      agencies: 'Asian Development Bank (ADB) • World Bank • Global Green Climate Fund',
      nodalOffice: 'MP Urban Services & MPRRDA Project Implementation Unit, Indore',
      description: 'Finances large-scale civic infra including 24x7 pressurized tap water connections in underserved IMC wards and farm-to-mandi link corridors across Indore Janpad blocks.',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'international'),
      budget: '₹80.7 Cr',
    },
    {
      key: 'national' as GovernanceLevel,
      number: '2',
      title: 'National (Central Government)',
      titleHindi: 'स्तर 2: राष्ट्रीय (केंद्र सरकार)',
      icon: Flag,
      color: 'blue',
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      heroBorder: 'border-blue-200 hover:border-blue-400',
      agencies: 'Ministry of Agriculture, MoHUA, MoHFW, Ministry of MSME',
      nodalOffice: 'District Agriculture Office Krishi Bhawan, CMHO Indore, DIC Polo Ground',
      description: 'Central flagship social safety nets implemented through district machinery: PM-KISAN (₹6,000/yr), PMAY Housing, Ayushman Bharat (₹5 Lakh free health cover), PM SVANidhi, PM Vishwakarma.',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'national'),
      budget: '₹811.0 Cr',
    },
    {
      key: 'state_mp' as GovernanceLevel,
      number: '3',
      title: 'Madhya Pradesh State Government',
      titleHindi: 'स्तर 3: मध्य प्रदेश राज्य शासन',
      icon: Landmark,
      color: 'emerald',
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      heroBorder: 'border-emerald-200 hover:border-emerald-400',
      agencies: 'Women & Child Development, Farmer Welfare, Technical Education, Labour Dept MP',
      nodalOffice: 'WCD Indore, Dy Labour Commissioner Residency, Employment Exchange Nanda Nagar',
      description: 'Madhya Pradesh flagship citizen benefits: Mukhyamantri Ladli Behna (₹1,250/mo), MP Kisan Kalyan (₹6,000 extra bonus to farmers), Sambal 2.0 unorganized worker safety, MMSKY Seekho Kamao.',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'state_mp'),
      budget: '₹1,343.0 Cr',
    },
    {
      key: 'district_indore' as GovernanceLevel,
      number: '4',
      title: 'Indore Collectorate (District Admin)',
      titleHindi: 'स्तर 4: इंदौर कलेक्ट्रेट (जिला प्रशासन)',
      icon: ShieldCheck,
      color: 'amber',
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      heroBorder: 'border-amber-200 hover:border-amber-400',
      agencies: 'Office of District Collector Indore, Indian Red Cross Society, Social Justice Dept',
      nodalOffice: 'Collectorate Campus, Moti Tabela, Indore (Tel: 0731-2433833)',
      description: 'Discretionary emergency welfare for Indore district residents: Red Cross Arogya Nidhi (instant ₹1 Lakh surgical aid at MY Hospital), Ahilya Divyang Swavalamban Kosh, Jal-Hath recharge pits.',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'district_indore'),
      budget: '₹34.5 Cr',
    },
    {
      key: 'urban_imc' as GovernanceLevel,
      number: '5',
      title: 'Indore Municipal Corporation (IMC Wards 1-85)',
      titleHindi: 'स्तर 5: इंदौर नगर निगम वार्ड 1-85',
      icon: Building,
      color: 'teal',
      badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
      heroBorder: 'border-teal-200 hover:border-teal-400',
      agencies: 'IMC Health & Sanitation, Renewable Energy Cell, Town Vending Committee (TVC)',
      nodalOffice: 'IMC Head Office, Narayan Singla Marg, Indore & 19 Zonal Offices',
      description: 'Municipal initiatives powering India’s Cleanest City: Swachhata Mitr Kalyan, Solar City ₹10,000 top-up + 10% property tax rebate, Women Street Vendor Pink Zone allotments at 56 Dukan & Rajwada.',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'urban_imc'),
      budget: '₹49.2 Cr',
    },
    {
      key: 'rural_janpad' as GovernanceLevel,
      number: '6',
      title: 'Rural Janpad Panchayats (4 Blocks)',
      titleHindi: 'स्तर 6: ग्रामीण जनपद पंचायतें (4 ब्लॉक)',
      icon: Tractor,
      color: 'rose',
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
      heroBorder: 'border-rose-200 hover:border-rose-400',
      agencies: 'Janpad Panchayats: Indore, Mhow, Sanwer, Depalpur & Zila Panchayat Indore',
      nodalOffice: 'Block Karyalayas: Betma/Depalpur, Ujjain Rd Sanwer, Mhowgaon Mhow, Collectorate Annexe',
      description: 'Grassroots rural livelihoods across 320 Gram Panchayats: Depalpur & Sanwer Malwi Desi Cow dairy subsidy (₹40,000), Mhow Tribal Bamboo cooperative, Sanwer Onion-Garlic cold storage (₹87,500).',
      activeSchemes: schemes.filter(s => s.governanceLevel === 'rural_janpad'),
      budget: '₹37.3 Cr',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
          Integrated Governance Architecture
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2 font-heading">
          {currentLanguage === 'hi'
            ? 'शासन के 6 स्तर — अंतर्राष्ट्रीय से ग्रामीण वार्ड तक'
            : currentLanguage === 'malwi'
            ? '6 सरकार स्तर — अंतर्राष्ट्रीय से गाँव की चौपाल तक'
            : '6 Levels of Governance in Indore District'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Unlike fragmented portals, YojanaSetu maps policies across all six administrative tiers directly to the citizen's doorstep in Indore.
        </p>
      </div>

      {/* Grid of 6 Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {levels.map(lvl => {
          const Icon = lvl.icon;

          return (
            <div
              key={lvl.key}
              className={`bg-white rounded-2xl border p-6 flex flex-col justify-between shadow-xs transition hover:shadow-lg ${lvl.heroBorder}`}
            >
              <div>
                {/* Top Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 rounded-xl bg-slate-50 border border-slate-200`}>
                    <Icon className="w-5 h-5 text-slate-800" />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${lvl.badgeBg}`}>
                    Level {lvl.number}
                  </span>
                </div>

                {/* Level Title */}
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {lvl.title}
                </h3>
                <p className="text-xs font-devanagari font-bold text-slate-500 mt-0.5">
                  {lvl.titleHindi}
                </p>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {lvl.description}
                </p>

                {/* Agencies & Nodal Contacts */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Departments: </span>
                    <span className="text-slate-500">{lvl.agencies}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Indore Nodal HQ: </span>
                    <span className="text-slate-500">{lvl.nodalOffice}</span>
                  </div>
                </div>

                {/* Schemes in this level */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
                    <span>Active Schemes ({lvl.activeSchemes.length}):</span>
                    <span className="text-amber-700 font-mono font-bold">Est. Budget: {lvl.budget}</span>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {lvl.activeSchemes.slice(0, 3).map(s => (
                      <li key={s.id} className="text-slate-600 truncate flex items-center space-x-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span className="truncate">{s.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onSelectLevel(lvl.key)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition flex items-center justify-center space-x-1.5"
                >
                  <span>Explore Level {lvl.number} Schemes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Urban Wards & Rural Janpads Deep Dive Info Banner */}
      <div className="mt-12 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div>
            <div className="inline-flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase mb-2">
              <MapPin className="w-4 h-4" />
              <span>Hyper-Local Administrative Granularity</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black font-heading">
              IMC Wards 1 to 85 + 4 Rural Janpad Blocks
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Indore District spans 85 Municipal Corporation wards divided into 19 Administrative Zones (from Rajwada and Sarafa to Vijay Nagar and Khajrana) alongside 4 Janpad Panchayats (Indore, Mhow, Sanwer, Depalpur) encompassing 320 Gram Panchayats. YojanaSetu automatically routes applications to the corresponding Zonal Officer or Janpad Panchayat CEO.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-amber-400 font-mono">85</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">IMC Wards</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-cyan-400 font-mono">19</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">IMC Zones</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-rose-400 font-mono">4</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">Janpad Blocks</div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-emerald-400 font-mono">320</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">Gram Panchayats</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
