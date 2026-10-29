import { Scheme, RagChunk, RagSearchResult, RagChunkType } from '../types';

/**
 * Malwi dialect vocabulary mapping for semantic expansion
 */
export const MALWI_SEMANTIC_SYNONYMS: Record<string, string[]> = {
  // Housing
  'टापरो': ['मकान', 'घर', 'आवास', 'pmay', 'housing', 'shelter', 'झोपड़ी', 'पक्का'],
  'ओसरो': ['मकान', 'आवास', 'घर', 'छत', 'housing'],
  // Farming & Agriculture
  'हलवा': ['किसान', 'खेती', 'काश्तकार', 'farmer', 'krishi', 'कृषि', 'kisan'],
  'खेड़ूत': ['किसान', 'खेती', 'काश्तकार', 'farmer', 'krishi'],
  'कांदा': ['प्याज', 'onion', 'storage', 'भंडारण', 'सब्जी'],
  'लहसन': ['लहसुन', 'garlic', 'मंडी', 'fpo'],
  'ढोर': ['पशु', 'गाय', 'भैंस', 'dairy', 'animal husbandry', 'गोवंश'],
  'गाय': ['गोवंश', 'मालवी', 'cow', 'dairy', 'दूध'],
  // Street vending & informal economy
  'ठेलो': ['ठेला', 'रेहड़ी', 'पटरी', 'street vendor', 'svanidhi', 'गुमटी', 'फेरीवाला'],
  'गुमटी': ['दुकान', 'खोखा', 'kiosk', 'vendor', 'vending'],
  // Women & Girl Child
  'बाईजी': ['महिला', 'बहन', 'स्त्री', 'woman', 'female', 'ladli', 'लाड़ली'],
  'लाडली': ['बेटी', 'बालिका', 'कन्या', 'girl', 'daughter', 'woman'],
  'छोरी': ['बेटी', 'कन्या', 'girl child', 'बालिका'],
  // Health & Pension
  'पीलो पत्तो': ['आयुष्मान', 'बीपीएल', 'राशन कार्ड', 'health card', 'मुफ्त इलाज'],
  'दवाई': ['इलाज', 'चिकित्सा', 'hospital', 'health', 'आरोग्य', 'treatment'],
  'डोकरी': ['वृद्धा', 'बुजुर्ग', 'senior citizen', 'pension', 'पेंशन'],
  'डोकरो': ['वृद्ध', 'बुजुर्ग', 'senior citizen', 'pension', 'पेंशन'],
  // Disability
  'लूला-लंगड़ा': ['दिव्यांग', 'विकलांग', 'disability', 'handicapped', 'swavalamban', 'अहिल्या'],
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
        expanded.add(key);
        synList.forEach(s => expanded.add(s.toLowerCase()));
      }
    }
  }

  return Array.from(expanded);
}

/**
 * Chunks a scheme into semantic facets
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
        'financial',
        'amount',
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
      ],
      malwiKeywords: s.malwiSynonyms || [],
    });
  }

  return chunks;
}

/**
 * Hybrid BM25 + TF-IDF Retrieval over scheme chunks
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

  // Corpus statistics for IDF calculation
  const N = chunks.length;
  const docFreq: Record<string, number> = {};

  const chunkTokenSets = chunks.map(chunk => {
    const fullText = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')} ${chunk.malwiKeywords.join(' ')}`.toLowerCase();
    const tokens = tokenizeText(fullText);
    const tokenSet = new Set(tokens);
    for (const t of tokenSet) {
      docFreq[t] = (docFreq[t] || 0) + 1;
    }
    return { chunk, tokens, tokenSet };
  });

  const avgDocLength =
    chunkTokenSets.reduce((acc, c) => acc + c.tokens.length, 0) / N;

  // BM25 Hyperparameters
  const k1 = 1.4;
  const b = 0.75;

  const results: RagSearchResult[] = [];

  for (const item of chunkTokenSets) {
    const { chunk, tokens, tokenSet } = item;
    const docLength = tokens.length;
    let bm25Score = 0;
    const matchedTerms: string[] = [];

    // Calculate term frequencies in current chunk
    const termFreq: Record<string, number> = {};
    for (const t of tokens) {
      termFreq[t] = (termFreq[t] || 0) + 1;
    }

    for (const qToken of expandedTokens) {
      if (tokenSet.has(qToken)) {
        matchedTerms.push(qToken);
        const tf = termFreq[qToken] || 0;
        const df = docFreq[qToken] || 1;
        // Smoothed IDF
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const num = tf * (k1 + 1);
        const denom = tf + k1 * (1 - b + b * (docLength / avgDocLength));
        bm25Score += idf * (num / denom);
      }
    }

    // Boost for title exact phrase or scheme name match
    const lowerTitle = chunk.title.toLowerCase();
    const lowerContent = chunk.content.toLowerCase();
    if (lowerTitle.includes(query.trim().toLowerCase())) {
      bm25Score += 3.5;
    }
    if (chunk.malwiKeywords.some(m => query.toLowerCase().includes(m.toLowerCase()))) {
      bm25Score += 2.5;
    }

    if (bm25Score > 0) {
      // Normalize score to confidence percentage (between 55% and 99%)
      const confidencePercent = Math.min(
        99,
        Math.max(55, Math.round(50 + Math.tanh(bm25Score / 4) * 49))
      );

      const sourceLevelLabel =
        chunk.governanceLevel === 'international' ? 'International / ADB'
        : chunk.governanceLevel === 'national' ? 'National / Central'
        : chunk.governanceLevel === 'state_mp' ? 'Madhya Pradesh State'
        : chunk.governanceLevel === 'district_indore' ? 'Indore Collectorate'
        : chunk.governanceLevel === 'urban_imc' ? 'Indore Municipal (IMC)'
        : 'Rural Janpad Panchayat';

      results.push({
        chunk,
        score: Number(bm25Score.toFixed(3)),
        matchedTerms: Array.from(new Set(matchedTerms)),
        sourceLevel: sourceLevelLabel,
        confidencePercent,
      });
    }
  }

  // Sort descending by score
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
