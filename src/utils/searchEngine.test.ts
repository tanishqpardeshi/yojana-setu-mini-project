import test from 'node:test';
import assert from 'node:assert/strict';
import { searchSchemes } from './searchEngine';
import { SCHEMES_DATABASE } from '../data/schemesData';

test('Malwi search: "टापरो" finds housing schemes (PMAY)', () => {
  const results = searchSchemes('टापरो', SCHEMES_DATABASE);
  assert.ok(results.length > 0, 'Should find housing schemes');
  assert.ok(results.some(s => s.id === 'pmay_urban'), 'PMAY Urban should match');
});

test('Malwi search: "हलवा" finds farmer schemes (PM Kisan)', () => {
  const results = searchSchemes('हलवा', SCHEMES_DATABASE);
  assert.ok(results.length > 0, 'Should find farmer schemes');
  assert.ok(results.some(s => s.id === 'pm_kisan'), 'PM-KISAN should match');
});

test('Hindi search: "लाडली बहना" returns MP Ladli Behna as first match', () => {
  const results = searchSchemes('लाडली बहना', SCHEMES_DATABASE);
  assert.ok(results.length > 0);
  assert.equal(results[0].id, 'mp_ladli_behna');
});

test('English search: "street vendor" finds PM SVANidhi', () => {
  const results = searchSchemes('street vendor', SCHEMES_DATABASE);
  assert.ok(results.some(s => s.id === 'pm_svanidhi'));
});

test('Level filter: "rural_janpad" only returns Level 6 Janpad schemes', () => {
  const results = searchSchemes('', SCHEMES_DATABASE, { levelFilter: 'rural_janpad' });
  assert.ok(results.length > 0);
  assert.ok(results.every(s => s.governanceLevel === 'rural_janpad'));
});
