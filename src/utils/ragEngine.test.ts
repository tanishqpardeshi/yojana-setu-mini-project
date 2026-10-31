import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  buildSchemeChunks, 
  hybridRagSearch, 
  tokenizeText, 
  expandQueryWithSynonyms,
  formatRagContextForPrompt,
  generateLocalMitraAnswer
} from './ragEngine.ts';
import { SCHEMES_DATABASE } from '../data/schemesData.ts';

test('buildSchemeChunks produces multiple semantic chunks per scheme', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE);
  assert.ok(chunks.length >= SCHEMES_DATABASE.length * 3, `Expected at least ${SCHEMES_DATABASE.length * 3} chunks, got ${chunks.length}`);
  
  // Verify chunk types
  const types = new Set(chunks.map(c => c.chunkType));
  assert.ok(types.has('eligibility'));
  assert.ok(types.has('benefits'));
  assert.ok(types.has('documents'));
  assert.ok(types.has('nodal_office'));
});

test('tokenizeText handles Hindi, English and removes punctuation', () => {
  const tokens = tokenizeText('लाड़ली बहना योजना 2026! MP-KISAN (Indore)');
  assert.ok(tokens.includes('लाड़ली'));
  assert.ok(tokens.includes('बहना'));
  assert.ok(tokens.includes('योजना'));
  assert.ok(tokens.includes('indore'));
});

test('expandQueryWithSynonyms expands Malwi terms into relevant query tokens', () => {
  const malwiTokens = tokenizeText('टापरो');
  const expanded = expandQueryWithSynonyms(malwiTokens);
  assert.ok(expanded.includes('टापरो'));
  assert.ok(expanded.includes('मकान') || expanded.includes('आवास') || expanded.includes('pmay'));
});

test('hybridRagSearch retrieves relevant scheme for Ladli Behna query with high confidence', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE);
  const results = hybridRagSearch('लाड़ली बहना ₹1500 उम्र नियम', chunks, 3);
  
  assert.ok(results.length > 0);
  assert.ok(results[0].chunk.schemeTitle.toLowerCase().includes('ladli behna') || results[0].chunk.schemeTitleHindi.includes('लाड़ली'));
  assert.ok(results[0].confidencePercent >= 70);
});

test('hybridRagSearch retrieves Depalpur Sanwer cow or agricultural schemes for farmer Malwi query', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE);
  const results = hybridRagSearch('हलवा काश्तकार गाय मालवी देपालपुर', chunks, 3);
  
  assert.ok(results.length > 0);
  const matchTitles = results.map(r => r.chunk.schemeTitle + ' ' + r.chunk.schemeTitleHindi).join(' ');
  assert.ok(matchTitles.includes('Malwi') || matchTitles.includes('Kisan') || matchTitles.includes('किसान') || matchTitles.includes('गोवंश'));
});

test('formatRagContextForPrompt builds structured citation context', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE.slice(0, 2));
  const results = hybridRagSearch('PMAY housing', chunks, 2);
  const formatted = formatRagContextForPrompt(results);
  assert.ok(formatted.includes('### Source [Citation 1]'));
  assert.ok(formatted.includes('Confidence:'));
});

test('hybridRagSearch computes vector cosine similarity and BM25 scores', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE);
  const results = hybridRagSearch('PM SVANidhi street vendor loan Indore', chunks, 2);
  assert.ok(results.length > 0);
  assert.ok(typeof results[0].cosineSimilarity === 'number');
  assert.ok(typeof results[0].bm25Score === 'number');
  assert.ok(results[0].cosineSimilarity >= 0);
  assert.ok(results[0].bm25Score >= 0);
});

test('generateLocalMitraAnswer generates grounded civic advice with citations', () => {
  const chunks = buildSchemeChunks(SCHEMES_DATABASE);
  const results = hybridRagSearch('लाड़ली बहना', chunks, 2);
  const hindiAnswer = generateLocalMitraAnswer('लाड़ली बहना', results, 'hi');
  assert.ok(hindiAnswer.includes('लाड़ली बहना') || hindiAnswer.includes('Ladli Behna'));
  assert.ok(hindiAnswer.includes('समग्र') || hindiAnswer.includes('ई-केवाईसी'));

  const enAnswer = generateLocalMitraAnswer('Ladli Behna', results, 'en');
  assert.ok(enAnswer.includes('Administrative Level:') || enAnswer.includes('Ladli Behna'));
});

