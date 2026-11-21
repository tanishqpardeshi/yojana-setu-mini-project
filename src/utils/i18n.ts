import {
  ApplicationRecord,
  Category,
  Gender,
  GovernanceLevel,
  MaritalStatus,
  OccupationType,
  Scheme,
  SchemesRealtimeReport,
  SupportedLanguage,
} from '../types';

export interface TriText {
  en: string;
  hi: string;
  malwi: string;
}

export function pickText(lang: SupportedLanguage, text: TriText): string {
  if (lang === 'malwi') return text.malwi;
  if (lang === 'hi') return text.hi;
  return text.en;
}

/**
 * Converts standard Hindi welfare descriptions into natural Malwi dialect phrasing
 * so dynamic scheme descriptions/benefits read authentically in Malwi Devanagari.
 */
export function toMalwiDevanagari(hindiText: string | undefined): string {
  if (!hindiText) return '';
  return hindiText
    .replace(/के लिए/g, 'खातर')
    .replace(/हेतु/g, 'खातर')
    .replace(/सभी/g, 'सगळा')
    .replace(/परिवारों/g, 'कुटुंबां')
    .replace(/परिवार/g, 'कुटुंब')
    .replace(/प्रति वर्ष/g, 'हर साल')
    .replace(/प्रति माह/g, 'हर महीना')
    .replace(/वार्षिक/g, 'सालाना')
    .replace(/निःशुल्क/g, 'मुफ्त')
    .replace(/निशुल्क/g, 'मुफ्त')
    .replace(/के माध्यम से/g, 'रा जरिया सूं')
    .replace(/में /g, 'मां ')
    .replace(/है।/g, 'छे।')
    .replace(/हैं।/g, 'छे।')
    .replace(/करें।/g, 'करो।')
    .replace(/किया जाता है/g, 'करयो जावे छे')
    .replace(/मिलता है/g, 'मिले छे')
    .replace(/मिलती है/g, 'मिले छे')
    .replace(/दिया जाता है/g, 'दियो जावे छे')
    .replace(/दी जाती है/g, 'दी जावे छे');
}

export const DOCUMENT_LABELS: Record<string, TriText> = {
  aadhaar: { en: 'Aadhaar Card', hi: 'आधार कार्ड', malwi: 'आधार कार्ड' },
  samagra_member: { en: 'Samagra Member ID', hi: 'समग्र सदस्य आईडी', malwi: 'समग्र सदस्य नंबर' },
  samagra_family: { en: 'Samagra Family ID', hi: 'समग्र परिवार आईडी', malwi: 'समग्र कुटुंब नंबर' },
  mp_domicile: { en: 'MP Domicile Certificate', hi: 'म.प्र. मूल निवासी प्रमाण पत्र', malwi: 'म.प्र. मूल निवासी कागद' },
  income_cert: { en: 'Income Certificate', hi: 'आय प्रमाण पत्र', malwi: 'कमाई रो प्रमाण पत्र' },
  khasra_b1: { en: 'Land Record Khasra B-1', hi: 'खसरा / बी-1 खतौनी', malwi: 'जमीन रो खसरा / बी-1 नकल' },
  caste_cert: { en: 'Caste Certificate', hi: 'जाति प्रमाण पत्र', malwi: 'जाति प्रमाण पत्र' },
  bank_dbt: { en: 'Bank Passbook (DBT Active)', hi: 'बैंक खाता डीबीटी पासबुक', malwi: 'बैंक पासबुक (खाता मां सीधा रुपया)' },
  udid_card: { en: 'UDID Disability Card', hi: 'यूडीआईडी दिव्यांग प्रमाण पत्र', malwi: 'दिव्यांग यूडीआईडी कार्ड' },
  vendor_id: { en: 'Street Vendor ID / LOR', hi: 'स्ट्रीट वेंडर पहचान पत्र', malwi: 'ठेलो / फेरीवाला पहचान पत्र' },
  bpl_ration: { en: 'BPL Ration Card', hi: 'बीपीएल राशन कार्ड', malwi: 'बीपीएल / पीलो राशन कार्ड' },
  sambal_card: { en: 'Sambal 2.0 Card', hi: 'संबल 2.0 कार्ड', malwi: 'संबल 2.0 मजूर कार्ड' },
  elec_bill: { en: 'Electricity Bill', hi: 'विद्युत बिल', malwi: 'बिजली रो बिल' },
  birth_cert: { en: 'Birth Certificate', hi: 'जन्म प्रमाण पत्र', malwi: 'जनम प्रमाण पत्र' },
};

export function getDocumentLabel(docId: string, lang: SupportedLanguage): string {
  const entry = DOCUMENT_LABELS[docId];
  if (!entry) return docId;
  return pickText(lang, entry);
}

export const GOVERNANCE_LEVEL_LABELS: Record<GovernanceLevel, TriText> = {
  international: {
    en: 'Level 1: International & Multilateral',
    hi: 'स्तर 1: अंतर्राष्ट्रीय व बहुपक्षीय',
    malwi: 'स्तर 1: अंतर्राष्ट्रीय व बड़ी मदद',
  },
  national: {
    en: 'Level 2: National (Central Govt)',
    hi: 'स्तर 2: राष्ट्रीय (केंद्र सरकार)',
    malwi: 'स्तर 2: केंद्र सरकार री योजना',
  },
  state_mp: {
    en: 'Level 3: Madhya Pradesh State',
    hi: 'स्तर 3: मध्य प्रदेश राज्य शासन',
    malwi: 'स्तर 3: म.प्र. सरकार री योजना',
  },
  district_indore: {
    en: 'Level 4: Indore Collectorate',
    hi: 'स्तर 4: इंदौर कलेक्ट्रेट (जिला प्रशासन)',
    malwi: 'स्तर 4: इंदौर कलेक्टर दफ्तर',
  },
  urban_imc: {
    en: 'Level 5: IMC Urban Wards (1-85)',
    hi: 'स्तर 5: इंदौर नगर निगम वार्ड 1-85',
    malwi: 'स्तर 5: इंदौर नगर निगम (वार्ड 1-85)',
  },
  rural_janpad: {
    en: 'Level 6: Rural Janpad Panchayats',
    hi: 'स्तर 6: ग्रामीण जनपद पंचायतें',
    malwi: 'स्तर 6: गाँव री 4 जनपद पंचायत',
  },
};

export function getGovernanceLevelLabel(level: GovernanceLevel, lang: SupportedLanguage): string {
  return pickText(lang, GOVERNANCE_LEVEL_LABELS[level]);
}

export const OCCUPATION_LABELS: Record<OccupationType, TriText> = {
  Farmer: {
    en: 'Farmer',
    hi: 'किसान',
    malwi: 'किसान / हलवा (खेती-बाड़ी)',
  },
  'Street Vendor': {
    en: 'Street Vendor',
    hi: 'रेहड़ी-पटरी / ठेला व्यवसायी',
    malwi: 'ठेलो / फेरीवाला धंधो',
  },
  Homemaker: {
    en: 'Homemaker',
    hi: 'गृहिणी / घरेलू महिला',
    malwi: 'घर री बाईजी / गृहिणी',
  },
  Student: {
    en: 'Student',
    hi: 'विद्यार्थी / छात्र',
    malwi: 'पढ़ण वाला बालक / विद्यार्थी',
  },
  'Construction Worker': {
    en: 'Construction / Daily Laborer',
    hi: 'मजदूर / निर्माण श्रमिक',
    malwi: 'मजूर / हमाल / दिहाड़ी काम',
  },
  'Artisan / Handicraft': {
    en: 'Artisan / Handicraft',
    hi: 'शिल्पकार / विश्वकर्मा',
    malwi: 'कारीगर / शिल्पकार / विश्वकर्मा',
  },
  'Gig Worker / Driver': {
    en: 'Gig Worker / Driver',
    hi: 'ऑटो/टैक्सी चालक / डिलीवरी',
    malwi: 'ऑटो-टैक्सी ड्राइवर / डिलीवरी काम',
  },
  'Small Business': {
    en: 'Small Business / Shopkeeper',
    hi: 'लघु व्यापारी / दुकानदार',
    malwi: 'छोटो दुकानदार / व्यापारी',
  },
  Unemployed: {
    en: 'Unemployed Youth',
    hi: 'बेरोजगार युवा',
    malwi: 'काम खोजता जवान / बेरोजगार',
  },
  'Senior Citizen': {
    en: 'Senior Citizen',
    hi: 'वरिष्ठ नागरिक',
    malwi: 'बुजुर्ग / बड़ा-बूढ़ा',
  },
  Other: {
    en: 'Other',
    hi: 'अन्य',
    malwi: 'दूजो कामकाज',
  },
};

export function getOccupationLabel(occ: OccupationType, lang: SupportedLanguage): string {
  const entry = OCCUPATION_LABELS[occ];
  return entry ? pickText(lang, entry) : occ;
}

export const GENDER_LABELS: Record<Gender, TriText> = {
  female: { en: 'Female', hi: 'महिला', malwi: 'बाईजी / महिला' },
  male: { en: 'Male', hi: 'पुरुष', malwi: 'भाईजी / पुरुष' },
  transgender: { en: 'Transgender', hi: 'तृतीय लिंग', malwi: 'तृतीय लिंग' },
  any: { en: 'All Genders', hi: 'सभी लिंग', malwi: 'सगळा खातर' },
};

export function getGenderLabel(g: Gender, lang: SupportedLanguage): string {
  return pickText(lang, GENDER_LABELS[g] || GENDER_LABELS.any);
}

export const CATEGORY_LABELS: Record<Category, TriText> = {
  GEN: { en: 'General', hi: 'सामान्य (GEN)', malwi: 'सामान्य वर्ग (GEN)' },
  OBC: { en: 'OBC', hi: 'अन्य पिछड़ा वर्ग (OBC)', malwi: 'पिछड़ा वर्ग (OBC)' },
  SC: { en: 'SC', hi: 'अनुसूचित जाति (SC)', malwi: 'अनुसूचित जाति (SC)' },
  ST: { en: 'ST', hi: 'अनुसूचित जनजाति (ST)', malwi: 'आदिवासी / जनजाति (ST)' },
  EWS: { en: 'EWS', hi: 'आर्थिक कमजोर वर्ग (EWS)', malwi: 'कमजोर आय वर्ग (EWS)' },
};

export function getCategoryLabel(cat: Category, lang: SupportedLanguage): string {
  return pickText(lang, CATEGORY_LABELS[cat] || CATEGORY_LABELS.GEN);
}

export const MARITAL_LABELS: Record<MaritalStatus, TriText> = {
  Married: { en: 'Married', hi: 'विवाहित', malwi: 'ब्याह होयो / विवाहित' },
  Unmarried: { en: 'Unmarried', hi: 'अविवाहित', malwi: 'कुँवारो / अविवाहित' },
  Widow: { en: 'Widow', hi: 'विधवा', malwi: 'विधवा बाईजी' },
  Divorced: { en: 'Divorced', hi: 'परित्यक्ता / तलाकशुदा', malwi: 'अलग रहण वाला / परित्यक्ता' },
};

export function getMaritalLabel(ms: MaritalStatus, lang: SupportedLanguage): string {
  return pickText(lang, MARITAL_LABELS[ms] || MARITAL_LABELS.Unmarried);
}

export function getFrequencyLabel(
  freq: Scheme['financialEntitlement']['frequency'],
  lang: SupportedLanguage
): string {
  const map: Record<Scheme['financialEntitlement']['frequency'], TriText> = {
    'One-Time': { en: 'One-Time', hi: 'एकमुश्त', malwi: 'एक बार मां' },
    Monthly: { en: 'Monthly', hi: 'मासिक', malwi: 'हर महीना' },
    Annual: { en: 'Annual', hi: 'वार्षिक', malwi: 'हर साल' },
    'Subsidized Loan': { en: 'Subsidized Loan', hi: 'रियायती ऋण', malwi: 'कम ब्याज कर्जो' },
    'In-Kind / Service': { en: 'In-Kind / Service', hi: 'सेवा / सामग्री सहायता', malwi: 'सुविधा / सामान मदद' },
  };
  return pickText(lang, map[freq] || map['One-Time']);
}

export function getSchemeTitle(scheme: Scheme, lang: SupportedLanguage): string {
  if (lang === 'malwi') return scheme.titleMalwi || scheme.titleHindi || scheme.title;
  if (lang === 'hi') return scheme.titleHindi || scheme.title;
  return scheme.title;
}

export function getSchemeDescription(scheme: Scheme, lang: SupportedLanguage): string {
  if (lang === 'malwi') return toMalwiDevanagari(scheme.descriptionHindi) || scheme.description;
  if (lang === 'hi') return scheme.descriptionHindi || scheme.description;
  return scheme.description;
}

export function getSchemeBenefits(scheme: Scheme, lang: SupportedLanguage): string {
  if (lang === 'malwi') return toMalwiDevanagari(scheme.benefitsHindi) || scheme.benefits;
  if (lang === 'hi') return scheme.benefitsHindi || scheme.benefits;
  return scheme.benefits;
}

export function getApplicationStatusLabel(
  status: ApplicationRecord['currentStatus'],
  lang: SupportedLanguage
): string {
  const map: Record<ApplicationRecord['currentStatus'], TriText> = {
    submitted: {
      en: 'Intake Registered',
      hi: 'आवेदन दर्ज हुआ',
      malwi: 'अर्जी जमा हो गई छे',
    },
    ward_verification: {
      en: 'Ward Verification In-Progress',
      hi: 'वार्ड / जनपद सत्यापन जारी',
      malwi: 'वार्ड / पंचायत मां जांच चाल री छे',
    },
    collectorate_scrutiny: {
      en: 'Collectorate Scrutiny',
      hi: 'कलेक्ट्रेट जांच प्रक्रियाधीन',
      malwi: 'कलेक्टर दफ्तर मां जांच चाल री छे',
    },
    sanction_issued: {
      en: 'Sanction Order Released',
      hi: 'स्वीकृति आदेश जारी',
      malwi: 'मंजूरी रो आदेश निकल गयो छे',
    },
    dbt_disbursed: {
      en: 'DBT Amount Transferred',
      hi: 'डीबीटी राशि खाते में अंतरित',
      malwi: 'रुपया सीधा बैंक खाता मां आ गया छे',
    },
    rejected: {
      en: 'Application Returned / Rejected',
      hi: 'आवेदन अस्वीकृत / वापस',
      malwi: 'अर्जी वापस / नामंजूर हुई छे',
    },
  };
  return pickText(lang, map[status]);
}

export function getRealtimeReportText(
  report: SchemesRealtimeReport | null,
  lang: SupportedLanguage
): { label: string; detail: string } {
  if (!report) {
    return {
      label: pickText(lang, {
        en: 'Loading Live Catalog Status...',
        hi: 'लाइव योजना सूची लोड हो रही है...',
        malwi: 'लाइव योजना री जानकारी खुल री छे...',
      }),
      detail: pickText(lang, {
        en: 'Schemes are synced from the live database. Click below to verify official government portals right now.',
        hi: 'योजनाएं लाइव डेटाबेस से सिंक हैं। आधिकारिक सरकारी पोर्टल की अभी जांच करने के लिए क्लिक करें।',
        malwi: 'सगळी योजना सीधा डेटाबेस सूं जुड़ी छे। सरकारी पोर्टल री अभी जांच खातर बटन दबावो।',
      }),
    };
  }

  if (lang === 'en') {
    return { label: report.verdictLabel, detail: report.verdictDetail };
  }

  if (report.verdict === 'live_verified') {
    return {
      label: pickText(lang, {
        en: report.verdictLabel,
        hi: 'लाइव डेटाबेस सिंक + सभी आधिकारिक पोर्टल सक्रिय',
        malwi: 'लाइव डेटाबेस जुड़यो छे + सगळा सरकारी पोर्टल चालू छे',
      }),
      detail: pickText(lang, {
        en: report.verdictDetail,
        hi: `सभी ${report.totalSchemes} योजनाएं लाइव डेटाबेस में अपडेट हैं और प्रत्येक सरकारी पोर्टल सक्रिय है।`,
        malwi: `सगळी ${report.totalSchemes} योजना लाइव डेटाबेस मां छे अने हर सरकारी पोर्टल चालू मिल्यो छे।`,
      }),
    };
  }

  if (report.verdict === 'partially_verified') {
    return {
      label: pickText(lang, {
        en: report.verdictLabel,
        hi: `लाइव सिंक • ${report.reachableSchemesCount}/${report.totalSchemes} पोर्टल सत्यापित`,
        malwi: `लाइव सिंक • ${report.reachableSchemesCount}/${report.totalSchemes} पोर्टल चालू मिल्या`,
      }),
      detail: pickText(lang, {
        en: report.verdictDetail,
        hi: `${report.reachableSchemesCount} योजनाओं के आधिकारिक पोर्टल सक्रिय हैं; शेष पोर्टल धीमे या बंद हैं।`,
        malwi: `${report.reachableSchemesCount} योजना रा सरकारी पोर्टल चालू छे; बाकी पोर्टल अभी धीमा छे।`,
      }),
    };
  }

  if (report.verdict === 'unreachable') {
    return {
      label: pickText(lang, {
        en: report.verdictLabel,
        hi: 'केवल लाइव डेटाबेस — बाहरी पोर्टल अनुपलब्ध',
        malwi: 'लाइव डेटाबेस चालू — बाहरी पोर्टल अभी नी खुल रिया',
      }),
      detail: pickText(lang, {
        en: report.verdictDetail,
        hi: 'बाहरी सरकारी पोर्टल से अभी संपर्क नहीं हो सका, लेकिन योजनाएं लाइव डेटाबेस में सुरक्षित हैं।',
        malwi: 'बाहरी सरकारी वेबसाइट अभी नी खुली, पण सगळी योजना आपणो डेटाबेस मां ताजा छे।',
      }),
    };
  }

  return {
    label: pickText(lang, {
      en: report.verdictLabel,
      hi: 'लाइव डेटाबेस सूची — बाहरी पोर्टल जांच शेष',
      malwi: 'लाइव डेटाबेस सूची — पोर्टल री जांच बाकी छे',
    }),
    detail: pickText(lang, {
      en: report.verdictDetail,
      hi: 'योजनाएं लाइव डेटाबेस से उपलब्ध हैं। आधिकारिक पोर्टल की लाइव स्थिति जांचने के लिए बटन दबाएं।',
      malwi: 'सगळी योजना सीधा लाइव डेटाबेस सूं मिल री छे। सरकारी पोर्टल री जांच खातर बटन दबावो।',
    }),
  };
}
