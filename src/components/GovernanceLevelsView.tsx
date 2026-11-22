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
  Filter,
  RotateCcw,
  ExternalLink,
  Info,
} from 'lucide-react';
import { GovernanceLevel, SupportedLanguage, Scheme } from '../types';
import { getSchemeTitle, pickText } from '../utils/i18n';
import { getOfficialPortalDisplayHost, resolveSchemePortalUrl } from '../utils/liveDataEngine';

interface GovernanceLevelsViewProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  onSelectLevel: (level: GovernanceLevel) => void;
  isProfileFilterApplied?: boolean;
  onClearProfileFilter?: () => void;
}

export const GovernanceLevelsView: React.FC<GovernanceLevelsViewProps> = ({
  currentLanguage,
  schemes,
  onSelectLevel,
  isProfileFilterApplied = false,
  onClearProfileFilter,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const levels = [
    {
      key: 'international' as GovernanceLevel,
      number: '1',
      title: t(
        'International & Multilateral',
        'अंतर्राष्ट्रीय व बहुपक्षीय सहायता',
        'अंतर्राष्ट्रीय व बड़ी मदद री योजना'
      ),
      subtitle: t(
        'स्तर 1: अंतर्राष्ट्रीय व बहुपक्षीय',
        'Level 1: International & Multilateral',
        'स्तर 1: अंतर्राष्ट्रीय व बड़ी मदद'
      ),
      icon: Globe2,
      badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300',
      heroBorder: 'border-indigo-200 hover:border-indigo-400',
      agencies: t(
        'Asian Development Bank (ADB) • World Bank • Global Green Climate Fund',
        'एशियाई विकास बैंक (ADB) • विश्व बैंक • हरित जलवायु कोष',
        'एशियाई विकास बैंक (ADB) • वर्ल्ड बैंक • हरित जलवायु फंड'
      ),
      nodalOffice: t(
        'MP Urban Services & MPRRDA Project Implementation Unit, Indore',
        'म.प्र. शहरी सेवाएं एवं एमपीआरआरडीए परियोजना इकाई, इंदौर',
        'म.प्र. शहरी सेवा व सड़क परियोजना दफ्तर, इंदौर'
      ),
      description: t(
        'Finances large-scale civic infra including 24x7 pressurized tap water connections in underserved IMC wards and farm-to-mandi link corridors across Indore Janpad blocks.',
        'इंदौर नगर निगम वार्डों में 24x7 नल जल कनेक्शन और जनपद ब्लॉकों में खेत-से-मंडी लिंक सड़कों जैसी बड़ी नागरिक परियोजनाओं का वित्तपोषण करता है।',
        'इंदौर नगर निगम रा वार्ड मां 24 घंटा नल जल कनेक्शन अने गाँव रा खेत सूं मंडी तक सड़क खातर बड़ी मदद देवे छे।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'international'),
      budget: t('₹80.7 Cr', '₹80.7 करोड़', '₹80.7 करोड़'),
    },
    {
      key: 'national' as GovernanceLevel,
      number: '2',
      title: t(
        'National (Central Government)',
        'राष्ट्रीय (केंद्र सरकार)',
        'केंद्र सरकार री योजना'
      ),
      subtitle: t(
        'स्तर 2: राष्ट्रीय (केंद्र सरकार)',
        'Level 2: Central Government',
        'स्तर 2: केंद्र सरकार'
      ),
      icon: Flag,
      badgeBg: 'bg-blue-100 text-blue-900 border-blue-300',
      heroBorder: 'border-blue-200 hover:border-blue-400',
      agencies: t(
        'Ministry of Agriculture, MoHUA, MoHFW, Ministry of MSME',
        'कृषि मंत्रालय, आवास एवं शहरी कार्य, स्वास्थ्य, एमएसएमई मंत्रालय',
        'खेती, आवास, स्वास्थ्य अने छोटो उद्योग मंत्रालय (भारत सरकार)'
      ),
      nodalOffice: t(
        'District Agriculture Office Krishi Bhawan, CMHO Indore, DIC Polo Ground',
        'जिला कृषि कार्यालय कृषि भवन, सीएमएचओ इंदौर, डीआईसी पोलो ग्राउंड',
        'कृषि भवन इंदौर, सीएमएचओ दफ्तर, डीआईसी पोलो ग्राउंड'
      ),
      description: t(
        'Central flagship social safety nets implemented through district machinery: PM-KISAN (₹6,000/yr), PMAY Housing, Ayushman Bharat (₹5 Lakh free health cover), PM SVANidhi, PM Vishwakarma.',
        'जिला प्रशासन द्वारा संचालित प्रमुख केंद्रीय योजनाएं: पीएम-किसान (₹6,000/वर्ष), पीएम आवास, आयुष्मान भारत (₹5 लाख मुफ्त इलाज), पीएम स्वनिधि, पीएम विश्वकर्मा।',
        'जिला प्रशासन सूं चालण वाली केंद्र सरकार री बड़ी योजना: पीएम-किसान (₹6,000 साल), पीएम आवास, आयुष्मान (₹5 लाख मुफ्त इलाज), स्वनिधि, विश्वकर्मा।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'national'),
      budget: t('₹811.0 Cr', '₹811.0 करोड़', '₹811.0 करोड़'),
    },
    {
      key: 'state_mp' as GovernanceLevel,
      number: '3',
      title: t(
        'Madhya Pradesh State Government',
        'मध्य प्रदेश राज्य शासन',
        'मध्य प्रदेश सरकार री योजना'
      ),
      subtitle: t(
        'स्तर 3: मध्य प्रदेश राज्य शासन',
        'Level 3: MP State Government',
        'स्तर 3: म.प्र. राज्य शासन'
      ),
      icon: Landmark,
      badgeBg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      heroBorder: 'border-emerald-200 hover:border-emerald-400',
      agencies: t(
        'Women & Child Development, Farmer Welfare, Technical Education, Labour Dept MP',
        'महिला एवं बाल विकास, किसान कल्याण, तकनीकी शिक्षा, श्रम विभाग म.प्र.',
        'महिला-बाल विकास, किसान कल्याण, शिक्षा अने श्रम विभाग म.प्र.'
      ),
      nodalOffice: t(
        'WCD Indore, Dy Labour Commissioner Residency, Employment Exchange Nanda Nagar',
        'महिला एवं बाल विकास इंदौर, श्रम आयुक्त रेसीडेंसी, रोजगार कार्यालय नंदा नगर',
        'महिला-बाल विकास इंदौर, श्रम दफ्तर रेसीडेंसी, रोजगार दफ्तर नंदा नगर'
      ),
      description: t(
        'Madhya Pradesh flagship citizen benefits: Mukhyamantri Ladli Behna (₹1,500/mo), MP Kisan Kalyan (₹6,000 extra bonus to farmers), Sambal 2.0 unorganized worker safety, MMSKY Seekho Kamao.',
        'म.प्र. की प्रमुख योजनाएं: मुख्यमंत्री लाड़ली बहना (₹1,500/माह), किसान कल्याण (₹6,000 अतिरिक्त सहायता), संबल 2.0 श्रमिक सुरक्षा, सीखो-कमाओ योजना।',
        'म.प्र. री खास योजना: लाड़ली बहना (₹1,500 हर महीना), किसान कल्याण (₹6,000 अलग सूं मदद), संबल 2.0 मजूर सुरक्षा अने सीखो-कमाओ योजना।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'state_mp'),
      budget: t('₹1,343.0 Cr', '₹1,343.0 करोड़', '₹1,343.0 करोड़'),
    },
    {
      key: 'district_indore' as GovernanceLevel,
      number: '4',
      title: t(
        'Indore Collectorate (District Admin)',
        'इंदौर कलेक्ट्रेट (जिला प्रशासन)',
        'इंदौर कलेक्टर दफ्तर (जिला प्रशासन)'
      ),
      subtitle: t(
        'स्तर 4: इंदौर कलेक्ट्रेट (जिला प्रशासन)',
        'Level 4: District Collectorate Indore',
        'स्तर 4: इंदौर जिला प्रशासन'
      ),
      icon: ShieldCheck,
      badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
      heroBorder: 'border-amber-200 hover:border-amber-400',
      agencies: t(
        'Office of District Collector Indore, Indian Red Cross Society, Social Justice Dept',
        'जिला कलेक्टर कार्यालय इंदौर, इंडियन रेड क्रॉस सोसाइटी, सामाजिक न्याय विभाग',
        'इंदौर कलेक्टर दफ्तर, रेड क्रॉस सोसाइटी अने सामाजिक न्याय विभाग'
      ),
      nodalOffice: t(
        'Collectorate Campus, Moti Tabela, Indore (Tel: 0731-2433833)',
        'कलेक्ट्रेट परिसर, मोती तबेला, इंदौर (फोन: 0731-2433833)',
        'कलेक्ट्रेट परिसर, मोती तबेला, इंदौर (फोन: 0731-2433833)'
      ),
      description: t(
        'Discretionary emergency welfare for Indore district residents: Red Cross Arogya Nidhi (instant ₹1 Lakh surgical aid at MY Hospital), Ahilya Divyang Swavalamban Kosh, Jal-Hath recharge pits.',
        'इंदौर जिले के निवासियों के लिए आपातकालीन सहायता: रेड क्रॉस आरोग्य निधि (एमवाय अस्पताल में ₹1 लाख इलाज सहायता), अहिल्या दिव्यांग स्वावलंबन कोष, जल-हाथ रिचार्ज पिट।',
        'इंदौर जिला रा लोग खातर तुरंत मदद: रेड क्रॉस आरोग्य निधि (एमवाय अस्पताल मां ₹1 लाख इलाज मदद), अहिल्या दिव्यांग कोष अने जल रिचार्ज पिट।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'district_indore'),
      budget: t('₹34.5 Cr', '₹34.5 करोड़', '₹34.5 करोड़'),
    },
    {
      key: 'urban_imc' as GovernanceLevel,
      number: '5',
      title: t(
        'Indore Municipal Corporation (IMC Wards 1-85)',
        'इंदौर नगर निगम (वार्ड 1 से 85)',
        'इंदौर नगर निगम (वार्ड 1 सूं 85)'
      ),
      subtitle: t(
        'स्तर 5: इंदौर नगर निगम वार्ड 1-85',
        'Level 5: IMC Urban Wards',
        'स्तर 5: शहर रा 85 वार्ड'
      ),
      icon: Building,
      badgeBg: 'bg-teal-100 text-teal-900 border-teal-300',
      heroBorder: 'border-teal-200 hover:border-teal-400',
      agencies: t(
        'IMC Health & Sanitation, Renewable Energy Cell, Town Vending Committee (TVC)',
        'नगर निगम स्वास्थ्य एवं स्वच्छता, सौर ऊर्जा प्रकोष्ठ, टाउन वेंडिंग समिति',
        'नगर निगम सफाई विभाग, सोलर ऊर्जा सेल अने फेरीवाला समिति'
      ),
      nodalOffice: t(
        'IMC Head Office, Narayan Singla Marg, Indore & 19 Zonal Offices',
        'नगर निगम मुख्यालय, नारायण सिंगला मार्ग, इंदौर एवं 19 जोनल कार्यालय',
        'नगर निगम मुख्य दफ्तर, इंदौर अने 19 जोन दफ्तर'
      ),
      description: t(
        'Municipal initiatives powering India’s Cleanest City: Swachhata Mitr Kalyan, Solar City ₹10,000 top-up + 10% property tax rebate, Women Street Vendor Pink Zone allotments at 56 Dukan & Rajwada.',
        'देश के सबसे स्वच्छ शहर की योजनाएं: स्वच्छता मित्र कल्याण, सोलर सिटी ₹10,000 अनुदान + 10% संपत्तिकर छूट, 56 दुकान व राजवाड़ा पर महिला पिंक ज़ोन।',
        'स्वच्छ शहर इंदौर री खास योजना: स्वच्छता मित्र कल्याण, सोलर छत खातर ₹10,000 मदद + 10% टैक्स छूट अने महिला फेरीवाला खातर पिंक ज़ोन।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'urban_imc'),
      budget: t('₹49.2 Cr', '₹49.2 करोड़', '₹49.2 करोड़'),
    },
    {
      key: 'rural_janpad' as GovernanceLevel,
      number: '6',
      title: t(
        'Rural Janpad Panchayats (4 Blocks)',
        'ग्रामीण जनपद पंचायतें (4 ब्लॉक)',
        'गाँव री 4 जनपद पंचायत'
      ),
      subtitle: t(
        'स्तर 6: ग्रामीण जनपद पंचायतें (4 ब्लॉक)',
        'Level 6: Rural Janpad Panchayats',
        'स्तर 6: इंदौर, महू, सांवेर, देपालपुर'
      ),
      icon: Tractor,
      badgeBg: 'bg-rose-100 text-rose-900 border-rose-300',
      heroBorder: 'border-rose-200 hover:border-rose-400',
      agencies: t(
        'Janpad Panchayats: Indore, Mhow, Sanwer, Depalpur & Zila Panchayat Indore',
        'जनपद पंचायत: इंदौर, महू, सांवेर, देपालपुर एवं जिला पंचायत इंदौर',
        'जनपद पंचायत: इंदौर, महू, सांवेर, देपालपुर अने जिला पंचायत इंदौर'
      ),
      nodalOffice: t(
        'Block Karyalayas: Betma/Depalpur, Ujjain Rd Sanwer, Mhowgaon Mhow, Collectorate Annexe',
        'ब्लॉक कार्यालय: बेटमा/देपालपुर, उज्जैन रोड सांवेर, महूगांव महू, कलेक्ट्रेट एनेक्सी',
        'ब्लॉक दफ्तर: बेटमा/देपालपुर, उज्जैन रोड सांवेर, महूगांव महू, इंदौर'
      ),
      description: t(
        'Grassroots rural livelihoods across 320 Gram Panchayats: Depalpur & Sanwer Malwi Desi Cow dairy subsidy (₹40,000), Mhow Tribal Bamboo cooperative, Sanwer Onion-Garlic cold storage (₹87,500).',
        '320 ग्राम पंचायतों में ग्रामीण आजीविका: देपालपुर-सांवेर मालवी देसी गाय डेयरी अनुदान (₹40,000), महू आदिवासी बांस सहकारी समिति, सांवेर प्याज-लहसुन भंडारण (₹87,500)।',
        '320 ग्राम पंचायत मां गाँव री कमाई री योजना: देपालपुर-सांवेर मालवी गाय डेयरी मदद (₹40,000), महू बांस काम अने सांवेर प्याज-लहसुन भंडारण (₹87,500)।'
      ),
      activeSchemes: schemes.filter(s => s.governanceLevel === 'rural_janpad'),
      budget: t('₹37.3 Cr', '₹37.3 करोड़', '₹37.3 करोड़'),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-8">
        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
          {t(
            'Integrated Governance Architecture',
            'एकीकृत शासन व्यवस्था',
            'सगळा 6 स्तर री एकीकृत व्यवस्था'
          )}
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2 font-heading">
          {t(
            '6 Levels of Governance in Indore District',
            'शासन के 6 स्तर — अंतर्राष्ट्रीय से ग्रामीण वार्ड तक',
            'इंदौर जिला मां शासन रा 6 स्तर — अंतर्राष्ट्रीय सूं गाँव री चौपाल तक'
          )}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t(
            "Unlike fragmented portals, YojanaSetu maps policies across all six administrative tiers directly to the citizen's doorstep in Indore.",
            'अलग-अलग पोर्टलों के बजाय, योजनासेतु इंदौर के नागरिकों के लिए सभी छह प्रशासनिक स्तरों की योजनाओं को एक ही मंच पर जोड़ता है।',
            'अलग-अलग वेबसाइट मां भटकण री बजाय, योजनासेतु इंदौर रा सगळा 6 स्तर री सरकारी योजना सीधे तमारा घर तक लावे छे।'
          )}
        </p>

        {isProfileFilterApplied && (
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-2 rounded-2xl text-xs font-semibold">
            <Filter className="w-3.5 h-3.5 text-emerald-700" />
            <span>
              {t(
                `Showing ${schemes.length} schemes matching your applied citizen profile criteria across all 6 tiers.`,
                `आपके लागू नागरिक प्रोफाइल मानदंडों से मेल खाने वाली ${schemes.length} योजनाएं सभी 6 स्तरों पर दिख रही हैं।`,
                `तमारा लागयोड़ा प्रोफाइल फिल्टर सूं मिलण वाली ${schemes.length} योजना सगळा 6 स्तर मां दिख री छे।`
              )}
            </span>
            {onClearProfileFilter && (
              <button
                type="button"
                onClick={onClearProfileFilter}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold hover:bg-emerald-100 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('Show All', 'सभी दिखाएं', 'सगळी दिखावो')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state if 0 schemes match across all tiers */}
      {schemes.length === 0 && (
        <div
          role="status"
          className="mb-8 bg-white rounded-2xl border border-dashed border-amber-300 p-6 sm:p-8 text-center space-y-3 shadow-xs"
        >
          <div className="w-11 h-11 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Info className="w-5 h-5" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            {t(
              'Modify your search criteria',
              'Modify your search criteria — अपने खोज मापदंड बदलें',
              'Modify your search criteria — थारा खोज रा नियम बदलो'
            )}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
            {t(
              'Modify your search criteria to explore Indore & MP schemes across all 6 governance levels.',
              'सभी 6 शासन स्तरों की योजनाएं देखने के लिए कृपया अपने खोज मापदंड बदलें।',
              'सगळा 6 स्तर री योजना देखण खातर थारा खोज रा नियम बदलो।'
            )}
          </p>
          {onClearProfileFilter && (
            <button
              type="button"
              onClick={onClearProfileFilter}
              className="min-h-[42px] px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>
                {t('Modify Your Search Criteria & Restart', 'खोज मापदंड बदलें व पुनः शुरू करें', 'खोज रा नियम बदलो अने पाछो शुरू करो')}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Grid of 6 Levels */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <Icon className="w-5 h-5 text-slate-800" />
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${lvl.badgeBg}`}>
                    {t(`Level ${lvl.number}`, `स्तर ${lvl.number}`, `स्तर ${lvl.number}`)}
                  </span>
                </div>

                {/* Level Title */}
                <h3 className="text-lg font-bold text-slate-900 leading-snug">
                  {lvl.title}
                </h3>
                <p className="text-xs font-devanagari font-bold text-slate-500 mt-0.5">
                  {lvl.subtitle}
                </p>

                {/* Description */}
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                  {lvl.description}
                </p>

                {/* Agencies & Nodal Contacts */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">
                      {t('Departments: ', 'विभाग: ', 'विभाग: ')}
                    </span>
                    <span className="text-slate-500">{lvl.agencies}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">
                      {t('Indore Nodal HQ: ', 'इंदौर नोडल कार्यालय: ', 'इंदौर मुख्य दफ्तर: ')}
                    </span>
                    <span className="text-slate-500">{lvl.nodalOffice}</span>
                  </div>
                </div>

                {/* Schemes in this level */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-2">
                    <span>
                      {isProfileFilterApplied
                        ? t(
                            `Matching Schemes (${lvl.activeSchemes.length}):`,
                            `पात्र योजनाएं (${lvl.activeSchemes.length}):`,
                            `मिलती योजना (${lvl.activeSchemes.length}):`
                          )
                        : t(
                            `Active Schemes (${lvl.activeSchemes.length}):`,
                            `सक्रिय योजनाएं (${lvl.activeSchemes.length}):`,
                            `चालू योजना (${lvl.activeSchemes.length}):`
                          )}
                    </span>
                    <span className="text-amber-700 font-mono font-bold">
                      {t('Est. Budget:', 'अनुमानित बजट:', 'अंदाजी बजट:')} {lvl.budget}
                    </span>
                  </div>
                  {lvl.activeSchemes.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      {t(
                        'Modify your search criteria — no schemes in this tier match your current filter.',
                        'Modify your search criteria — इस स्तर पर वर्तमान फिल्टर में कोई योजना नहीं मिली।',
                        'Modify your search criteria — ई स्तर मां अभी कोई योजना नी मिली।'
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-xs">
                      {lvl.activeSchemes.slice(0, 3).map(s => (
                        <li key={s.id} className="text-slate-700 flex items-center justify-between gap-2">
                          <span className="truncate flex items-center space-x-1.5 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                            <span className="truncate">{getSchemeTitle(s, currentLanguage)}</span>
                          </span>
                          <a
                            href={resolveSchemePortalUrl(s)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-700 hover:text-emerald-900 hover:underline shrink-0"
                            title={resolveSchemePortalUrl(s)}
                          >
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span className="hidden sm:inline">{getOfficialPortalDisplayHost(s)}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-6 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onSelectLevel(lvl.key)}
                  className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-900 transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <span>
                    {t(
                      `Explore Level ${lvl.number} Schemes`,
                      `स्तर ${lvl.number} की योजनाएं देखें`,
                      `स्तर ${lvl.number} री योजना देखो`
                    )}
                  </span>
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
              <span>
                {t(
                  'Hyper-Local Administrative Granularity',
                  'स्थानीय प्रशासनिक स्तर तक सीधी पहुँच',
                  'इंदौर रा वार्ड सूं गाँव पंचायत तक सीधी पहुँच'
                )}
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black font-heading">
              {t(
                'IMC Wards 1 to 85 + 4 Rural Janpad Blocks',
                'इंदौर नगर निगम के 85 वार्ड + 4 ग्रामीण जनपद ब्लॉक',
                'इंदौर नगर निगम रा 85 वार्ड + 4 गाँव जनपद ब्लॉक'
              )}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {t(
                'Indore District spans 85 Municipal Corporation wards divided into 19 Administrative Zones (from Rajwada and Sarafa to Vijay Nagar and Khajrana) alongside 4 Janpad Panchayats (Indore, Mhow, Sanwer, Depalpur) encompassing 320 Gram Panchayats. YojanaSetu automatically routes applications to the corresponding Zonal Officer or Janpad Panchayat CEO.',
                'इंदौर जिले में 19 जोन के अंतर्गत 85 नगर निगम वार्ड (राजवाड़ा, सराफा से विजय नगर और खजराना तक) तथा 4 जनपद पंचायतें (इंदौर, महू, सांवेर, देपालपुर) शामिल हैं जिनमें 320 ग्राम पंचायतें हैं। योजनासेतु आवेदन को सीधे संबंधित जोनल अधिकारी या जनपद सीईओ तक पहुँचाता है।',
                'इंदौर जिला मां 19 जोन रा 85 नगर निगम वार्ड (राजवाड़ा, सराफा सूं विजय नगर अने खजराना तक) अने 4 जनपद पंचायत (इंदौर, महू, सांवेर, देपालपुर) री 320 ग्राम पंचायत शामिल छे। योजनासेतु तमारी अर्जी सीधा जोनल अफसर या जनपद सीईओ तक पहुँचावे छे।'
              )}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-amber-400 font-mono">85</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">
                {t('IMC Wards', 'नगर निगम वार्ड', 'नगर निगम वार्ड')}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-cyan-400 font-mono">19</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">
                {t('IMC Zones', 'निगम जोन', 'निगम जोन')}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-rose-400 font-mono">4</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">
                {t('Janpad Blocks', 'जनपद ब्लॉक', 'जनपद ब्लॉक')}
              </div>
            </div>
            <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
              <div className="text-2xl font-black text-emerald-400 font-mono">320</div>
              <div className="text-[11px] text-slate-300 font-medium mt-1">
                {t('Gram Panchayats', 'ग्राम पंचायतें', 'ग्राम पंचायत')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
