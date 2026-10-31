import { Scheme, RagChunk, RagSearchResult, SupportedLanguage } from '../types/index.js';

/**
 * Malwi & Nimar regional vernacular vocabulary mapping for semantic expansion
 */
export const MALWI_SEMANTIC_SYNONYMS: Record<string, string[]> = {
  // Housing & Shelter
  'टापरो': ['मकान', 'घर', 'आवास', 'pmay', 'housing', 'shelter', 'झोपड़ी', 'पक्का'],
  'ओसरो': ['मकान', 'आवास', 'घर', 'छत', 'housing', 'बसेरा'],
  'खोखा': ['गुमटी', 'दुकान', 'ठेला', 'rehari', 'vending'],
  // Farming, Agriculture & Cattle
  'हलवा': ['किसान', 'खेती', 'काश्तकार', 'farmer', 'krishi', 'कृषि', 'kisan'],
  'खेड़ूत': ['किसान', 'खेती', 'काश्तकार', 'farmer', 'krishi'],
  'कांदा': ['प्याज', 'onion', 'storage', 'भंडारण', 'सब्जी', 'मंडी'],
  'लहसन': ['लहसुन', 'garlic', 'मंडी', 'fpo', 'सब्जी'],
  'ढोर': ['पशु', 'गाय', 'भैंस', 'dairy', 'animal husbandry', 'गोवंश', 'पशुपालन'],
  'गाय': ['गोवंश', 'मालवी', 'cow', 'dairy', 'दूध', 'पशुपालन'],
  'मालवी गाय': ['देशी गाय', 'गोवंश', 'गाय', 'दूध', 'सब्सिडी'],
  'कुआं': ['कूप', 'बोरवेल', 'कपिलधारा', 'सिंचाई', 'जल', 'farm pond'],
  'तलाई': ['तालाब', 'खेत तालाब', 'जलहठ', 'water', 'pond', 'सिंचाई'],
  // Street vending & micro-business
  'ठेलो': ['ठेला', 'रेहड़ी', 'पटरी', 'street vendor', 'svanidhi', 'गुमटी', 'फेरीवाला', 'स्वनिधि'],
  'गुमटी': ['दुकान', 'खोखा', 'kiosk', 'vendor', 'vending', 'पिंक हॉकर्स'],
  'धंधो': ['रोजगार', 'व्यवसाय', 'बिजनेस', 'उद्यम', 'मुद्रा', 'ऋण', 'लोन'],
  // Women, Girls & Family
  'बाईजी': ['महिला', 'बहन', 'स्त्री', 'woman', 'female', 'ladli', 'लाड़ली', 'बहना'],
  'लाडली': ['बेटी', 'बालिका', 'कन्या', 'girl', 'daughter', 'woman', 'लाड़ली'],
  'छोरी': ['बेटी', 'कन्या', 'girl child', 'बालिका', 'लाडली लक्ष्मी'],
  'छोरो': ['बेटा', 'बालक', 'युवा', 'youth', 'सीखो कमाओ'],
  'ब्याव': ['विवाह', 'शादी', 'निकाह', 'कन्या विवाह', 'दान'],
  // Health, Medicine & Pension
  'पीलो पत्तो': ['आयुष्मान', 'बीपीएल', 'राशन कार्ड', 'health card', 'मुफ्त इलाज', 'उपचार'],
  'दवाई': ['इलाज', 'चिकित्सा', 'hospital', 'health', 'आरोग्य', 'treatment', 'अस्पताल', 'रेड क्रॉस'],
  'डोकरी': ['वृद्धा', 'बुजुर्ग', 'senior citizen', 'pension', 'पेंशन', 'कल्याणी'],
  'डोकरो': ['वृद्ध', 'बुजुर्ग', 'senior citizen', 'pension', 'पेंशन', 'वृद्धावस्था'],
  // Disability
  'लूला-लंगड़ा': ['दिव्यांग', 'विकलांग', 'disability', 'handicapped', 'swavalamban', 'अहिल्या', 'सहायता उपकरण'],
  'अपंग': ['दिव्यांग', 'विकलांग', 'disability', 'अहिल्या कोष'],
  // Cleanliness & Energy
  'कचरा': ['स्वच्छता', 'सफाई', 'कचरा गाड़ी', 'स्वच्छता मित्र', 'नगर निगम', 'imc'],
  'घाम': ['धूप', 'सोलर', 'सौर ऊर्जा', 'रूफटॉप सोलर', 'बिजली बिल', 'पीएम सूर्य घर'],
  'बिजली': ['सौर ऊर्जा', 'solar', 'रूफटॉप', 'कुसुम', 'पंप'],
  'पाणि': ['पानी', 'जल', 'नल', 'पीने का पानी', 'नल कनेक्शन', 'एडीबी'],
};

/**
 * Tokenize string into clean search tokens (English, Hindi, and regional scripts)
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

/**
 * Expand query tokens with Malwi dialect and Hindi synonyms
 */
export function expandQueryWithSynonyms(queryTokens: string[]): string[] {
  const expanded = new Set<string>(queryTokens);

  for (const token of queryTokens) {
    // Check direct match in Malwi dictionary
    if (MALWI_SEMANTIC_SYNONYMS[token]) {
      MALWI_SEMANTIC_SYNONYMS[token].forEach(syn => expanded.add(syn.toLowerCase()));
    }

    // Check if token appears inside synonym lists
    for (const [key, synList] of Object.entries(MALWI_SEMANTIC_SYNONYMS)) {
      if (synList.some(s => s.toLowerCase() === token)) {
        expanded.add(key.toLowerCase());
        synList.forEach(s => expanded.add(s.toLowerCase()));
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Chunks each scheme into semantic facets (Eligibility, Benefits, Documents, Indore Nodal Office)
 */
export function buildSchemeChunks(schemes: Scheme[]): RagChunk[] {
  const chunks: RagChunk[] = [];

  for (const s of schemes) {
    // 1. Eligibility Chunk
    const ruleTexts: string[] = [];
    if (s.eligibilityRules.ageMin || s.eligibilityRules.ageMax) {
      ruleTexts.push(`आयु सीमा: ${s.eligibilityRules.ageMin || 0} से ${s.eligibilityRules.ageMax || 'असीमित'} वर्ष (Age: ${s.eligibilityRules.ageMin || 0}-${s.eligibilityRules.ageMax || 'Open'})`);
    }
    if (s.eligibilityRules.gender && s.eligibilityRules.gender !== 'any') {
      ruleTexts.push(`लिंग पात्रता: केवल ${s.eligibilityRules.gender === 'female' ? 'महिलाएं (Female)' : 'पुरुष (Male)'}`);
    }
    if (s.eligibilityRules.allowedOccupations?.length) {
      ruleTexts.push(`मान्य व्यवसाय: ${s.eligibilityRules.allowedOccupations.join(', ')}`);
    }
    if (s.eligibilityRules.maxIncomeAnnual) {
      ruleTexts.push(`अधिकतम वार्षिक पारिवारिक आय: ₹${s.eligibilityRules.maxIncomeAnnual.toLocaleString('en-IN')}`);
    }
    if (s.eligibilityRules.requiredAreaType) {
      ruleTexts.push(`क्षेत्र: केवल ${s.eligibilityRules.requiredAreaType === 'urban' ? 'शहरी (नगर निगम वार्ड 1-85)' : 'ग्रामीण (इंदौर, महू, सांवेर, देपालपुर जनपद)'}`);
    }
    if (s.eligibilityRules.requiresMpDomicile) {
      ruleTexts.push('मध्य प्रदेश का मूल निवासी होना अनिवार्य (MP Domicile Required)');
    }
    if (s.eligibilityRules.requiresIndoreResident) {
      ruleTexts.push('इंदौर जिले का स्थायी निवासी होना आवश्यक (Indore Resident Required)');
    }
    if (s.eligibilityRules.requiresBpl) {
      ruleTexts.push('बीपीएल / गरीबी रेखा से नीचे राशन कार्ड धारक');
    }
    if (s.eligibilityRules.requiresDisability) {
      ruleTexts.push('न्यूनतम 40% दिव्यांगता प्रमाण पत्र धारक');
    }

    chunks.push({
      id: `${s.id}-chunk-eligibility`,
      schemeId: s.id,
      schemeTitle: s.title,
      schemeTitleHindi: s.titleHindi,
      governanceLevel: s.governanceLevel,
      chunkType: 'eligibility',
      title: `${s.title} — पात्रता एवं नियम (Eligibility Rules)`,
      content: `योजना: ${s.title} (${s.titleHindi})\nप्रशासनिक स्तर: ${s.governanceLevel.toUpperCase()}\nलक्षित वर्ग: ${s.targetBeneficiary}\nपात्रता मानदंड:\n- ${ruleTexts.join('\n- ')}`,
      keywords: [
        ...tokenizeText(s.title),
        ...tokenizeText(s.titleHindi),
        ...s.tags,
        'पात्रता',
        'eligibility',
        'नियम',
        'उम्र',
        'आय',
        'शर्तें',
      ],
      malwiKeywords: s.malwiSynonyms || [],
    });

    // 2. Benefits Chunk
    chunks.push({
      id: `${s.id}-chunk-benefits`,
      schemeId: s.id,
      schemeTitle: s.title,
      schemeTitleHindi: s.titleHindi,
      governanceLevel: s.governanceLevel,
      chunkType: 'benefits',
      title: `${s.title} — वित्तीय लाभ एवं अनुदान (Financial Entitlement)`,
      content: `योजना: ${s.title} (${s.titleHindi})\nवित्तीय राशि: ₹${s.financialEntitlement.amount.toLocaleString('en-IN')} (${s.financialEntitlement.frequency})\nविवरण: ${s.financialEntitlement.description}\nमुख्य लाभ:\n${s.benefits}\n${s.benefitsHindi}`,
      keywords: [
        ...tokenizeText(s.title),
        ...tokenizeText(s.titleHindi),
        'लाभ',
        'benefits',
        'अनुदान',
        'subsidy',
        'पैसा',
        'किस्त',
        'वित्तीय',
        'amount',
        'सहायता',
      ],
      malwiKeywords: s.malwiSynonyms || [],
    });

    // 3. Documents Chunk
    chunks.push({
      id: `${s.id}-chunk-documents`,
      schemeId: s.id,
      schemeTitle: s.title,
      schemeTitleHindi: s.titleHindi,
      governanceLevel: s.governanceLevel,
      chunkType: 'documents',
      title: `${s.title} — आवश्यक दस्तावेज व प्रमाण पत्र (Required Documents)`,
      content: `योजना: ${s.title} (${s.titleHindi})\nआवेदन हेतु अनिवार्य दस्तावेज:\n${s.requiredDocuments.map((doc, i) => `${i + 1}. ${doc}`).join('\n')}\n(समग्र 9-अंकीय सदस्य आईडी एवं आधार-लिंक डीबीटी बैंक खाता आवश्यक है)`,
      keywords: [
        ...tokenizeText(s.title),
        ...tokenizeText(s.titleHindi),
        'कागजात',
        'दस्तावेज',
        'documents',
        'aadhaar',
        'आधार',
        'समग्र',
        'samagra',
        'खसरा',
        'प्रमाण पत्र',
      ],
      malwiKeywords: s.malwiSynonyms || [],
    });

    // 4. Process & Nodal Office Chunk
    chunks.push({
      id: `${s.id}-chunk-nodal`,
      schemeId: s.id,
      schemeTitle: s.title,
      schemeTitleHindi: s.titleHindi,
      governanceLevel: s.governanceLevel,
      chunkType: 'nodal_office',
      title: `${s.title} — नोडल कार्यालय, हेल्पलाइन व आवेदन केंद्र (Indore Nodal Office)`,
      content: `योजना: ${s.title} (${s.titleHindi})\nनोडल कार्यालय (इंदौर): ${s.nodalOfficeIndore}\nविभाग: ${s.department}\nआधिकारिक हेल्पलाइन: ${s.helpline}\nकियोस्क सुविधा (MPOnline / CSC): ${s.cscAvailable ? 'उपलब्ध (नजदीकी कियोस्क पर जाएं)' : 'केवल विभागीय कार्यालय'}\nआधिकारिक पोर्टल: ${s.applyUrl || 'mpedistrict.gov.in'}`,
      keywords: [
        ...tokenizeText(s.title),
        ...tokenizeText(s.titleHindi),
        'नोडल',
        'कार्यालय',
        'office',
        'helpline',
        'कलेक्ट्रेट',
        'नगर निगम',
        'जनपद',
        'contact',
        'कहाँ जाएं',
        'apply',
        'आवेदन प्रक्रिया',
      ],
      malwiKeywords: s.malwiSynonyms || [],
    });
  }

  return chunks;
}

/**
 * Compute vector cosine similarity between query TF-IDF vector and document TF-IDF vector
 */
function computeCosineSimilarity(
  queryVector: Record<string, number>,
  queryNorm: number,
  docVector: Record<string, number>,
  docNorm: number
): number {
  if (queryNorm === 0 || docNorm === 0) return 0;

  let dotProduct = 0;
  for (const term in queryVector) {
    if (docVector[term]) {
      dotProduct += queryVector[term] * docVector[term];
    }
  }

  return dotProduct / (queryNorm * docNorm);
}

/**
 * Hybrid RAG Search Engine: BM25 + TF-IDF Vector Cosine Similarity + Vernacular Boosting
 */
export function hybridRagSearch(
  query: string,
  chunks: RagChunk[],
  topK: number = 4
): RagSearchResult[] {
  if (!query || !query.trim() || !chunks.length) return [];

  const rawTokens = tokenizeText(query);
  const expandedTokens = expandQueryWithSynonyms(rawTokens);

  if (!expandedTokens.length) return [];

  const N = chunks.length;
  const docFreq: Record<string, number> = {};

  // Pre-tokenize and extract chunk representation
  const preparedChunks = chunks.map(chunk => {
    const fullText = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')} ${chunk.malwiKeywords.join(' ')}`.toLowerCase();
    const tokens = tokenizeText(fullText);
    const tokenSet = new Set(tokens);
    const termFreq: Record<string, number> = {};
    for (const t of tokens) {
      termFreq[t] = (termFreq[t] || 0) + 1;
    }
    for (const t of tokenSet) {
      docFreq[t] = (docFreq[t] || 0) + 1;
    }
    return { chunk, tokens, tokenSet, termFreq, docLength: tokens.length };
  });

  const avgDocLength =
    preparedChunks.reduce((acc, c) => acc + c.docLength, 0) / Math.max(1, N);

  // Compute IDF for all terms in query
  const queryTermIdf: Record<string, number> = {};
  for (const term of expandedTokens) {
    const df = docFreq[term] || 0;
    // Smoothed BM25 / Lucene-style IDF
    queryTermIdf[term] = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  }

  // Build query TF-IDF vector & norm
  const queryTermFreq: Record<string, number> = {};
  for (const t of expandedTokens) {
    queryTermFreq[t] = (queryTermFreq[t] || 0) + 1;
  }

  const queryVector: Record<string, number> = {};
  let queryNormSq = 0;
  for (const term of expandedTokens) {
    const tf = 1 + Math.log(queryTermFreq[term]);
    const idf = queryTermIdf[term] || 0.1;
    const weight = tf * idf;
    queryVector[term] = weight;
    queryNormSq += weight * weight;
  }
  const queryNorm = Math.sqrt(queryNormSq);

  // BM25 Hyperparameters
  const k1 = 1.4;
  const b = 0.75;

  const results: RagSearchResult[] = [];
  const lowerQuery = query.trim().toLowerCase();

  for (const item of preparedChunks) {
    const { chunk, tokenSet, termFreq, docLength } = item;
    let bm25Score = 0;
    const matchedTerms: string[] = [];

    // Calculate document TF-IDF vector for cosine similarity
    const docVector: Record<string, number> = {};
    let docNormSq = 0;

    for (const [term, freq] of Object.entries(termFreq)) {
      const idf = queryTermIdf[term] || (docFreq[term] ? Math.log(1 + (N - docFreq[term] + 0.5) / (docFreq[term] + 0.5)) : 0.1);
      const tf = 1 + Math.log(freq);
      const weight = tf * idf;
      docVector[term] = weight;
      docNormSq += weight * weight;
    }
    const docNorm = Math.sqrt(docNormSq);

    // Compute BM25 match
    for (const qToken of expandedTokens) {
      if (tokenSet.has(qToken)) {
        matchedTerms.push(qToken);
        const tf = termFreq[qToken] || 0;
        const idf = queryTermIdf[qToken] || 0.1;
        const num = tf * (k1 + 1);
        const denom = tf + k1 * (1 - b + b * (docLength / avgDocLength));
        bm25Score += idf * (num / denom);
      }
    }

    // Compute Vector Cosine Similarity
    const cosineSim = computeCosineSimilarity(queryVector, queryNorm, docVector, docNorm);

    // Boosts for exact phrases and regional vernacular
    let directBoost = 0;
    const lowerTitle = chunk.title.toLowerCase();
    const lowerContent = chunk.content.toLowerCase();

    if (lowerTitle.includes(lowerQuery) || lowerContent.includes(lowerQuery)) {
      directBoost += 3.0;
    }
    if (chunk.malwiKeywords.some(m => lowerQuery.includes(m.toLowerCase()))) {
      directBoost += 2.0;
    }
    if (chunk.keywords.some(k => lowerQuery.includes(k.toLowerCase()))) {
      directBoost += 1.0;
    }

    // Combine BM25 + Cosine Similarity + Vernacular Boost
    const normalizedBM25 = Math.min(10, bm25Score);
    const combinedScore = (normalizedBM25 * 0.6) + (cosineSim * 4.0) + directBoost;

    if (combinedScore > 0.15 || matchedTerms.length > 0) {
      // Normalize score into a reliable human-readable confidence percentage (55% to 99%)
      const confidencePercent = Math.min(
        99,
        Math.max(55, Math.round(52 + Math.tanh(combinedScore / 4.2) * 47))
      );

      const sourceLevelLabel =
        chunk.governanceLevel === 'international' ? 'International (ADB/WB)'
        : chunk.governanceLevel === 'national' ? 'National / Central'
        : chunk.governanceLevel === 'state_mp' ? 'Madhya Pradesh State'
        : chunk.governanceLevel === 'district_indore' ? 'Indore Collectorate'
        : chunk.governanceLevel === 'urban_imc' ? 'Indore Municipal (IMC)'
        : 'Rural Janpad Panchayat';

      results.push({
        chunk,
        score: Number(combinedScore.toFixed(3)),
        bm25Score: Number(bm25Score.toFixed(3)),
        cosineSimilarity: Number(cosineSim.toFixed(3)),
        matchedTerms: Array.from(new Set(matchedTerms)),
        sourceLevel: sourceLevelLabel,
        confidencePercent,
      });
    }
  }

  // Sort descending by hybrid score
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Format retrieved RAG chunks into a structured Markdown prompt for LLM grounding
 */
export function formatRagContextForPrompt(results: RagSearchResult[]): string {
  if (!results.length) return 'No directly matching scheme documents retrieved.';

  return results
    .map((res, i) => {
      const c = res.chunk;
      return `### Source [Citation ${i + 1}] (${res.sourceLevel} — Confidence: ${res.confidencePercent}%)
**Scheme**: ${c.schemeTitle} (${c.schemeTitleHindi})
**Facet**: ${c.title}
**Official Facts & Rules**:
${c.content}
---`;
    })
    .join('\n\n');
}

/**
 * Client-Side Grounded Answer Generator: Generates comprehensive, polite, verified answers
 * when offline or when backend LLM endpoints are unreachable.
 */
export function generateLocalMitraAnswer(
  query: string,
  retrievedChunks: RagSearchResult[],
  language: SupportedLanguage = 'hi'
): string {
  if (!retrievedChunks.length) {
    if (language === 'en') {
      return `**Namaste! I am Yojana Mitra, your civic counselor for Indore District.**\n\nI could not find a specific scheme directly matching your search "${query}".\n\nIndore operates schemes across **6 Governance Levels**:\n1. **International (ADB/World Bank):** 24x7 Water Tap Subsidy.\n2. **National / Central:** PM-KISAN, PMAY Housing, Ayushman Bharat (₹5 Lakh Free Treatment), PM SVANidhi.\n3. **MP State:** Ladli Behna (₹1,500/month), MP Kisan Kalyan, Seekho Kamao, Sambal 2.0.\n4. **Indore Collectorate:** Red Cross Arogya Nidhi, Ahilya Divyang Swavalamban Kosh.\n5. **Indore Municipal Corporation (Wards 1-85):** Swachhata Mitr Kalyan, IMC Solar Tax Rebate, Pink Hawking.\n6. **Rural Janpads (Indore, Mhow, Sanwer, Depalpur):** Malwi Cow Conservation, Onion Cold Storage Subsidy.\n\n👉 *Please try asking with scheme names, beneficiary type (farmer, woman, vendor), or ward/block name.*`;
    }
    return `**राम-राम सा! मैं योजना मित्र (Yojana Mitra) हूँ — इंदौर जिले का आधिकारिक AI सहायक।**\n\nआपके प्रश्न "${query}" से संबंधित कोई विशिष्ट योजना सीधे नहीं मिली।\n\nइंदौर जिले में कुल **6 प्रशासनिक स्तरों** पर 51+ योजनाएं संचालित हैं:\n1. **अंतर्राष्ट्रीय (ADB/विश्व बैंक):** 24x7 निःशुल्क नल कनेक्शन अनुदान।\n2. **राष्ट्रीय (Central):** पीएम-किसान, पीएम आवास, आयुष्मान भारत (₹5 लाख मुफ्त इलाज), पीएम स्वनिधि।\n3. **म.प्र. शासन:** लाड़ली बहना (₹1,500/माह), किसान कल्याण (₹6,000/वर्ष), सीखो कमाओ, संबल 2.0।\n4. **इंदौर कलेक्ट्रेट:** रेड क्रॉस आरोग्य निधि (₹1 लाख त्वरित सहायता), अहिल्या दिव्यांग कोष।\n5. **नगर निगम (वार्ड 1-85):** स्वच्छता मित्र कल्याण, रूफटॉप सोलर ₹10,000 अनुदान, पिंक हॉकर्स।\n6. **ग्रामीण जनपद (महू, सांवेर, देपालपुर, इंदौर):** मालवी गोवंश संरक्षण व प्याज भंडारण शेड।\n\n💡 *कृपया किसी विशिष्ट योजना, वर्ग (महिला, किसान, रेहड़ी पटरी, दिव्यांग) या अपने वार्ड/जनपद का नाम लिखकर पुनः पूछें।*`;
  }

  const primaryChunk = retrievedChunks[0].chunk;
  const confidence = retrievedChunks[0].confidencePercent;
  const level = retrievedChunks[0].sourceLevel;

  // Aggregate facts from matching chunks of this scheme
  const allContent = retrievedChunks.map(r => r.chunk.content).join('\n\n');

  if (language === 'en') {
    return `### 🏛️ ${primaryChunk.schemeTitle}\n**Administrative Level:** ${level} • **Grounding Confidence:** ${confidence}%\n\n${primaryChunk.content}\n\n📌 **Key Action Points for Indore Citizens:**\n- **Samagra & DBT:** Ensure your 9-digit Samagra Member ID is Aadhaar-eKYC verified with active bank DBT.\n- **Where to Apply:** Visit your nearest MPOnline / CSC Kiosk, Indore Collectorate (Moti Tabela), or IMC Ward Office (Wards 1–85).\n- **Helpline & Tracking:** Track your application status using the 15-digit ARN on our portal or contact the official nodal helpline.`;
  }

  return `### 🏛️ ${primaryChunk.schemeTitleHindi} (${primaryChunk.schemeTitle})\n**प्रशासनिक स्तर:** ${level} | **विश्वसनीयता स्कोर:** ${confidence}%\n\n${primaryChunk.content}\n\n---\n\n📋 **इंदौर नागरिकों के लिए मुख्य मार्गदर्शन व प्रक्रिया:**\n1. **समग्र व आधार ई-केवाईसी:** समग्र पोर्टल पर 9-अंकीय सदस्य आईडी का आधार ई-केवाईसी एवं बैंक खाते में डीबीटी (DBT) सक्रिय होना अनिवार्य है।\n2. **कहाँ संपर्क करें:** अपने नजदीकी **MPOnline / CSC कियोस्क**, **इंदौर कलेक्ट्रेट (मोती तबेला)** या **नगर निगम जोनल / वार्ड कार्यालय (वार्ड 1-85)** में आवेदन करें।\n3. **पावती (ARN ट्रैकिंग):** आवेदन जमा करने पर प्राप्त 15-अंकीय ARN नंबर को हमारे 'Track ARN' टैब में दर्ज करके कभी भी स्थिति ट्रैक करें।\n\n💡 *विस्तृत नियम या पात्रता गणना हेतु नीचे दिए गए 'Verified Civic Citations' कार्ड्स देखें अथवा 'Find My Schemes' कैलकुलेटर का उपयोग करें।*`;
}
