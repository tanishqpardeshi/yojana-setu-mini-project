import { Scheme, SupportedLanguage } from '../types';

export interface SynonymDictionary {
  canonicalCategory: string;
  english: string[];
  hindi: string[];
  malwi: string[];
}

export const SYNONYM_DICTIONARY: SynonymDictionary[] = [
  {
    canonicalCategory: 'agriculture',
    english: ['farmer', 'kisan', 'agriculture', 'farming', 'land', 'tractor', 'crop', 'soil'],
    hindi: ['किसान', 'कृषि', 'खेती', 'खेत', 'फसल', 'भूमि', 'पटवारी', 'खसरा'],
    malwi: ['हलवा', 'खेड़ूत', 'काश्तकार', 'खेतीबाड़ी', 'बखर', 'बोवनी', 'खाता', 'जमीन'],
  },
  {
    canonicalCategory: 'housing',
    english: ['house', 'housing', 'home', 'roof', 'shelter', 'pmay', 'construction'],
    hindi: ['मकान', 'आवास', 'घर', 'छत', 'गृह', 'कच्चा मकान', 'पक्का मकान'],
    malwi: ['टापरो', 'ओसरो', 'झोपड़ी', 'मकान', 'छत', 'कमरो', 'रहवा को ठाम'],
  },
  {
    canonicalCategory: 'women_empowerment',
    english: ['women', 'lady', 'mother', 'female', 'sister', 'ladli', 'behna', 'maternity'],
    hindi: ['महिला', 'लाड़ली', 'बहना', 'माता', 'नारी', 'प्रसूति', 'स्त्री'],
    malwi: ['बाईजी', 'छोरी', 'बहना', 'लाडली', 'औरत', 'लुगाई', 'मायजी'],
  },
  {
    canonicalCategory: 'health_medical',
    english: ['health', 'hospital', 'doctor', 'medicine', 'illness', 'treatment', 'surgery', 'ayushman'],
    hindi: ['स्वास्थ्य', 'अस्पताल', 'इलाज', 'दवा', 'बीमारी', 'चिकित्सा', 'ऑपरेशन', 'आयुष्मान'],
    malwi: ['दवाई', 'दारू', 'बीमारी', 'गोली', 'पीलो पत्तो', 'अस्पताल', 'जांच', 'एमवाय'],
  },
  {
    canonicalCategory: 'street_vendor',
    english: ['vendor', 'street vendor', 'hawker', 'stall', 'cart', 'svanidhi', 'loan', 'credit'],
    hindi: ['रेहड़ी', 'पटरी', 'ठेला', 'खोखा', 'दुकानदार', 'विक्रेता', 'स्वनिधि', 'ऋण'],
    malwi: ['ठेलो', 'गुमटी', 'रेहड़ी', 'हाट', 'फेरी', 'दुकानिया', 'सब्जी का ठेला'],
  },
  {
    canonicalCategory: 'livestock_dairy',
    english: ['cow', 'cattle', 'dairy', 'milk', 'livestock', 'organic', 'gobar'],
    hindi: ['गाय', 'पशुपालन', 'डेयरी', 'दूध', 'गोवंश', 'जैविक खाद', 'गोबर गैस'],
    malwi: ['मालवी गाय', 'तबेला', 'ढोर-डांगर', 'गोबर', 'दूध', 'पशु', 'बछड़ो'],
  },
  {
    canonicalCategory: 'artisan_craft',
    english: ['artisan', 'craft', 'carpenter', 'blacksmith', 'potter', 'tailor', 'vishwakarma', 'toolkit'],
    hindi: ['शिल्पकार', 'कारीगर', 'बढ़ई', 'लोहार', 'कुम्हार', 'दर्जी', 'विश्वकर्मा', 'टूलकिट'],
    malwi: ['सुथार', 'लुहार', 'कुम्हार', 'दर्जी', 'हथियार', 'औजार', 'कारीगरी'],
  },
  {
    canonicalCategory: 'solar_energy',
    english: ['solar', 'electricity', 'energy', 'power', 'rooftop', 'light', 'bill'],
    hindi: ['सोलर', 'सौर ऊर्जा', 'बिजली', 'विद्युत', 'छत पर पैनल', 'बिजली बिल'],
    malwi: ['धूप की प्लेट', 'सोलर पैनल', 'करंट', 'बिजली को बिल', 'छत'],
  },
  {
    canonicalCategory: 'education_youth',
    english: ['student', 'youth', 'scholarship', 'study', 'education', 'internship', 'stipend', 'job'],
    hindi: ['शिक्षा', 'छात्र', 'युवा', 'छात्रवृत्ति', 'पढ़ाई', 'स्टाइपेंड', 'कौशल', 'रोजगार'],
    malwi: ['पढ़ाई', 'वज़ीफ़ा', 'बस्ता', 'छोरा-छोरी', 'सीखना', 'नौकरी', 'भत्ता'],
  },
  {
    canonicalCategory: 'water_conservation',
    english: ['water', 'tap', 'pond', 'well', 'boring', 'recharge', 'irrigation'],
    hindi: ['जल', 'पानी', 'नल', 'तालाब', 'कुआं', 'नलकूप', 'पुनर्भरण', 'सिंचाई'],
    malwi: ['पाणि', 'नलको', 'टूंटी', 'बोरिंग', 'खेत को तालाब', 'कुओ', 'पियाव'],
  },
];

/**
 * Normalizes query string for robust matching
 */
export function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Smart Multilingual Search across English, Hindi, and Malwi
 */
export function searchSchemes(
  query: string,
  schemes: Scheme[],
  options?: {
    levelFilter?: string;
    departmentFilter?: string;
    areaFilter?: string;
  }
): Scheme[] {
  let filtered = schemes;

  if (options?.levelFilter && options.levelFilter !== 'all') {
    filtered = filtered.filter(s => s.governanceLevel === options.levelFilter);
  }

  if (options?.areaFilter && options.areaFilter !== 'all') {
    filtered = filtered.filter(s => {
      if (!s.eligibilityRules.requiredAreaType) return true;
      return s.eligibilityRules.requiredAreaType === options.areaFilter;
    });
  }

  if (options?.departmentFilter && options.departmentFilter !== 'all') {
    filtered = filtered.filter(s => s.department.toLowerCase().includes(options.departmentFilter!.toLowerCase()));
  }

  const cleanQuery = normalizeQuery(query);
  if (!cleanQuery) return filtered;

  // Split query into search terms
  const terms = cleanQuery.split(' ').filter(t => t.length > 1);
  if (terms.length === 0) return filtered;

  // Identify matching semantic categories from synonyms
  const matchedCategories = new Set<string>();
  for (const dict of SYNONYM_DICTIONARY) {
    const allWords = [...dict.english, ...dict.hindi, ...dict.malwi];
    for (const term of terms) {
      if (allWords.some(w => w.toLowerCase().includes(term) || term.includes(w.toLowerCase()))) {
        matchedCategories.add(dict.canonicalCategory);
      }
    }
  }

  // Score each scheme
  const scored = filtered.map(scheme => {
    let score = 0;
    const titleEn = scheme.title.toLowerCase();
    const titleHi = scheme.titleHindi.toLowerCase();
    const titleMalwi = scheme.titleMalwi.toLowerCase();
    const descEn = scheme.description.toLowerCase();
    const descHi = scheme.descriptionHindi.toLowerCase();
    const tags = scheme.tags.map(t => t.toLowerCase());
    const malwiSynonyms = scheme.malwiSynonyms.map(s => s.toLowerCase());

    for (const term of terms) {
      // Direct title match
      if (titleEn.includes(term)) score += 30;
      if (titleHi.includes(term)) score += 30;
      if (titleMalwi.includes(term)) score += 35; // boost vernacular terms!

      // Malwi synonyms exact match
      if (malwiSynonyms.some(s => s.includes(term))) score += 25;

      // Tags match
      if (tags.some(t => t.includes(term))) score += 20;

      // Description match
      if (descEn.includes(term)) score += 10;
      if (descHi.includes(term)) score += 10;

      // Department & Office match
      if (scheme.department.toLowerCase().includes(term)) score += 8;
      if (scheme.nodalOfficeIndore.toLowerCase().includes(term)) score += 8;
      if (scheme.code.toLowerCase().includes(term)) score += 40;
    }

    // Synonym category match bonus
    for (const cat of matchedCategories) {
      if (tags.includes(cat) || scheme.tags.some(t => t.toLowerCase().includes(cat))) {
        score += 25;
      }
    }

    return { scheme, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.scheme);
}

/**
 * Returns localized string based on active language
 */
export function getLocalizedText(
  lang: SupportedLanguage,
  en: string,
  hi: string,
  malwi?: string
): string {
  if (lang === 'malwi' && malwi) return malwi;
  if (lang === 'hi') return hi;
  return en;
}
