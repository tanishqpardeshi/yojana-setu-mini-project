import { CitizenProfile, Scheme, SchemeEligibilityResult, RuleEvaluationResult } from '../types';

/**
 * Real-time Rules Eligibility Engine for YojanaSetu
 * Evaluates citizen profile against declarative JSON eligibility constraints.
 */
export function evaluateSchemeEligibility(
  profile: CitizenProfile,
  scheme: Scheme
): SchemeEligibilityResult {
  const rules = scheme.eligibilityRules;
  const evaluations: RuleEvaluationResult[] = [];
  const passingReasons: string[] = [];
  const failingReasons: string[] = [];
  const recommendations: string[] = [];

  let hardDisqualification = false;
  let softPendingCount = 0;

  // 1. MP Domicile check
  if (rules.requiresMpDomicile) {
    if (profile.isMpDomicile) {
      evaluations.push({
        ruleName: 'MP Domicile',
        passed: true,
        reason: 'Resident of Madhya Pradesh verified',
        reasonHindi: 'मध्य प्रदेश का मूल निवासी सत्यापित',
      });
      passingReasons.push('Valid MP Domicile confirmed');
    } else {
      evaluations.push({
        ruleName: 'MP Domicile',
        passed: false,
        reason: 'Must be a bona fide resident of Madhya Pradesh',
        reasonHindi: 'मध्य प्रदेश का मूल निवासी होना अनिवार्य है',
      });
      failingReasons.push('Applicant is not an MP resident');
      hardDisqualification = true;
    }
  }

  // 2. Indore District Residency check
  if (rules.requiresIndoreResident) {
    if (profile.isIndoreResident) {
      evaluations.push({
        ruleName: 'Indore District Resident',
        passed: true,
        reason: 'Indore district resident verified',
        reasonHindi: 'इंदौर जिले का निवासी सत्यापित',
      });
      passingReasons.push('Indore jurisdiction verified');
    } else {
      evaluations.push({
        ruleName: 'Indore District Resident',
        passed: false,
        reason: 'Must be an Indore district resident for this scheme',
        reasonHindi: 'इस योजना हेतु इंदौर जिले का निवासी होना अनिवार्य है',
      });
      failingReasons.push('Requires residency within Indore District');
      hardDisqualification = true;
    }
  }

  // 3. Gender check
  if (rules.gender && rules.gender !== 'any') {
    if (profile.gender === rules.gender) {
      evaluations.push({
        ruleName: 'Gender Match',
        passed: true,
        reason: `Applicant gender (${profile.gender}) matches scheme criteria (${rules.gender})`,
        reasonHindi: `लिंग पात्रता पूर्ण (${rules.gender === 'female' ? 'महिला' : 'पुरुष'})`,
      });
      passingReasons.push(`Eligible for ${rules.gender === 'female' ? 'women' : 'men'}-focused entitlement`);
    } else {
      evaluations.push({
        ruleName: 'Gender Match',
        passed: false,
        reason: `Scheme is exclusively for ${rules.gender} beneficiaries`,
        reasonHindi: `यह योजना केवल ${rules.gender === 'female' ? 'महिला' : 'पुरुष'} लाभार्थियों हेतु है`,
      });
      failingReasons.push(`Gender requirement mismatch (Scheme is for ${rules.gender})`);
      hardDisqualification = true;
    }
  }

  // 4. Age constraints
  if (rules.ageMin !== undefined) {
    if (profile.age >= rules.ageMin) {
      evaluations.push({
        ruleName: 'Minimum Age',
        passed: true,
        reason: `Age ${profile.age} meets minimum age limit of ${rules.ageMin} years`,
        reasonHindi: `आयु ${profile.age} वर्ष न्यूनतम सीमा ${rules.ageMin} वर्ष के अनुरूप है`,
      });
      passingReasons.push(`Age ${profile.age} is above minimum ${rules.ageMin}`);
    } else {
      evaluations.push({
        ruleName: 'Minimum Age',
        passed: false,
        reason: `Age ${profile.age} is below minimum required age of ${rules.ageMin} years`,
        reasonHindi: `आयु ${profile.age} वर्ष न्यूनतम सीमा ${rules.ageMin} वर्ष से कम है`,
      });
      failingReasons.push(`Age must be at least ${rules.ageMin} years (current: ${profile.age})`);
      hardDisqualification = true;
    }
  }

  if (rules.ageMax !== undefined) {
    if (profile.age <= rules.ageMax) {
      evaluations.push({
        ruleName: 'Maximum Age',
        passed: true,
        reason: `Age ${profile.age} is within maximum limit of ${rules.ageMax} years`,
        reasonHindi: `आयु ${profile.age} वर्ष अधिकतम सीमा ${rules.ageMax} वर्ष के भीतर है`,
      });
      passingReasons.push(`Age ${profile.age} is below maximum ${rules.ageMax}`);
    } else {
      evaluations.push({
        ruleName: 'Maximum Age',
        passed: false,
        reason: `Age ${profile.age} exceeds maximum allowed limit of ${rules.ageMax} years`,
        reasonHindi: `आयु ${profile.age} वर्ष अधिकतम सीमा ${rules.ageMax} वर्ष से अधिक है`,
      });
      failingReasons.push(`Age exceeds maximum limit of ${rules.ageMax} years (current: ${profile.age})`);
      hardDisqualification = true;
    }
  }

  // 5. Area Type (Urban IMC vs Rural Janpad)
  if (rules.requiredAreaType) {
    if (profile.areaType === rules.requiredAreaType) {
      evaluations.push({
        ruleName: 'Area Type',
        passed: true,
        reason: `Matches required ${rules.requiredAreaType === 'urban' ? 'Urban (IMC)' : 'Rural (Janpad)'} area`,
        reasonHindi: `${rules.requiredAreaType === 'urban' ? 'शहरी (नगर निगम)' : 'ग्रामीण (जनपद)'} क्षेत्र के अनुरूप`,
      });
      passingReasons.push(`Location matches ${rules.requiredAreaType} area requirement`);
    } else {
      evaluations.push({
        ruleName: 'Area Type',
        passed: false,
        reason: `Scheme is exclusively for ${rules.requiredAreaType === 'urban' ? 'IMC Urban Ward' : 'Rural Janpad'} residents`,
        reasonHindi: `यह योजना केवल ${rules.requiredAreaType === 'urban' ? 'शहरी नगर निगम' : 'ग्रामीण जनपद'} हेतु है`,
      });
      failingReasons.push(`Requires ${rules.requiredAreaType} jurisdiction (applicant is in ${profile.areaType})`);
      hardDisqualification = true;
    }
  }

  // 6. Block Specific check (Rural)
  if (rules.requiredBlocks && rules.requiredBlocks.length > 0) {
    if (profile.blockName && rules.requiredBlocks.includes(profile.blockName)) {
      evaluations.push({
        ruleName: 'Janpad Block Specific',
        passed: true,
        reason: `Block ${profile.blockName} is in approved blocks (${rules.requiredBlocks.join(', ')})`,
        reasonHindi: `जनपद ब्लॉक ${profile.blockName} मान्य ब्लॉक सूची में है`,
      });
      passingReasons.push(`Janpad block ${profile.blockName} approved`);
    } else {
      evaluations.push({
        ruleName: 'Janpad Block Specific',
        passed: false,
        reason: `Restricted to Janpad blocks: ${rules.requiredBlocks.join(', ')}`,
        reasonHindi: `यह योजना केवल इन जनपदों हेतु है: ${rules.requiredBlocks.join(', ')}`,
      });
      failingReasons.push(`Eligible only in blocks: ${rules.requiredBlocks.join(', ')}`);
      hardDisqualification = true;
    }
  }

  // 7. Social Category check (SC / ST / OBC / GEN / EWS)
  if (rules.allowedCategories && rules.allowedCategories.length > 0) {
    if (rules.allowedCategories.includes(profile.category)) {
      evaluations.push({
        ruleName: 'Social Category',
        passed: true,
        reason: `Category ${profile.category} matches eligible criteria (${rules.allowedCategories.join(', ')})`,
        reasonHindi: `सामाजिक वर्ग ${profile.category} पात्र श्रेणी में सम्मिलित`,
      });
      passingReasons.push(`Category ${profile.category} eligible`);
    } else {
      evaluations.push({
        ruleName: 'Social Category',
        passed: false,
        reason: `Reserved for categories: ${rules.allowedCategories.join(', ')}`,
        reasonHindi: `केवल इन वर्गों हेतु मान्य: ${rules.allowedCategories.join(', ')}`,
      });
      failingReasons.push(`Category ${profile.category} not in target list (${rules.allowedCategories.join(', ')})`);
      hardDisqualification = true;
    }
  }

  // 8. Occupation check
  if (rules.allowedOccupations && rules.allowedOccupations.length > 0) {
    if (rules.allowedOccupations.includes(profile.occupation)) {
      evaluations.push({
        ruleName: 'Occupation Profile',
        passed: true,
        reason: `Occupation (${profile.occupation}) aligns with target beneficiaries`,
        reasonHindi: `व्यवसाय (${profile.occupation}) योजना के अनुरूप है`,
      });
      passingReasons.push(`Occupation (${profile.occupation}) is eligible`);
    } else {
      evaluations.push({
        ruleName: 'Occupation Profile',
        passed: false,
        reason: `Applicable to: ${rules.allowedOccupations.join(', ')}`,
        reasonHindi: `केवल इन व्यवसायों हेतु: ${rules.allowedOccupations.join(', ')}`,
      });
      failingReasons.push(`Occupation (${profile.occupation}) not targeted by this scheme`);
      // Soft or hard depending on flexibility
      hardDisqualification = true;
    }
  }

  // 9. Annual Income Limit
  if (rules.maxIncomeAnnual !== undefined) {
    if (profile.annualIncome <= rules.maxIncomeAnnual) {
      evaluations.push({
        ruleName: 'Annual Income Limit',
        passed: true,
        reason: `Annual income (₹${profile.annualIncome.toLocaleString('en-IN')}) is within ceiling of ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')}`,
        reasonHindi: `वार्षिक आय (₹${profile.annualIncome.toLocaleString('en-IN')}) सीमा ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')} के भीतर है`,
      });
      passingReasons.push(`Income under ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')} ceiling`);
    } else {
      evaluations.push({
        ruleName: 'Annual Income Limit',
        passed: false,
        reason: `Annual income (₹${profile.annualIncome.toLocaleString('en-IN')}) exceeds limit of ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')}`,
        reasonHindi: `वार्षिक आय (₹${profile.annualIncome.toLocaleString('en-IN')}) सीमा ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')} से अधिक है`,
      });
      failingReasons.push(`Annual income ₹${profile.annualIncome.toLocaleString('en-IN')} exceeds threshold of ₹${rules.maxIncomeAnnual.toLocaleString('en-IN')}`);
      hardDisqualification = true;
    }
  }

  // 10. Landholding for agricultural schemes
  if (rules.landHoldingMinHectares !== undefined) {
    if (profile.landHoldingHectares >= rules.landHoldingMinHectares) {
      evaluations.push({
        ruleName: 'Landholding Minimum',
        passed: true,
        reason: `Landholding (${profile.landHoldingHectares} Ha) meets minimum ${rules.landHoldingMinHectares} Ha requirement`,
        reasonHindi: `कृषि भूमि (${profile.landHoldingHectares} हेक्टेयर) न्यूनतम सीमा के अनुरूप`,
      });
      passingReasons.push(`Agricultural landholding confirmed (${profile.landHoldingHectares} Hectares)`);
    } else {
      evaluations.push({
        ruleName: 'Landholding Minimum',
        passed: false,
        reason: `Minimum ${rules.landHoldingMinHectares} Hectare agricultural land required`,
        reasonHindi: `न्यूनतम ${rules.landHoldingMinHectares} हेक्टेयर कृषि भूमि होना आवश्यक है`,
      });
      failingReasons.push(`Requires at least ${rules.landHoldingMinHectares} Ha land (current: ${profile.landHoldingHectares} Ha)`);
      hardDisqualification = true;
    }
  }

  // 11. Disability requirement
  if (rules.requiresDisability) {
    if (profile.hasDisability && (!rules.minDisabilityPercent || (profile.disabilityPercent || 0) >= rules.minDisabilityPercent)) {
      evaluations.push({
        ruleName: 'Disability Certificate',
        passed: true,
        reason: `Certified Divyangjan (${profile.disabilityPercent || 40}%+ disability verified)`,
        reasonHindi: `दिव्यांग प्रमाण पत्र मान्य (${profile.disabilityPercent || 40}%+)`,
      });
      passingReasons.push('Divyang status verified');
    } else {
      evaluations.push({
        ruleName: 'Disability Certificate',
        passed: false,
        reason: `Scheme is exclusively for persons with ${rules.minDisabilityPercent || 40}%+ certified disability`,
        reasonHindi: `यह योजना केवल ${rules.minDisabilityPercent || 40}%+ प्रमाणित दिव्यांगजनों हेतु है`,
      });
      failingReasons.push('Requires certified disability certificate (UDID)');
      hardDisqualification = true;
    }
  }

  // 12. Marital Status check
  if (rules.allowedMaritalStatus && rules.allowedMaritalStatus.length > 0) {
    if (rules.allowedMaritalStatus.includes(profile.maritalStatus)) {
      evaluations.push({
        ruleName: 'Marital Status',
        passed: true,
        reason: `Marital status (${profile.maritalStatus}) is eligible`,
        reasonHindi: `वैवाहिक स्थिति (${profile.maritalStatus}) योजना के अनुरूप`,
      });
      passingReasons.push(`Marital status (${profile.maritalStatus}) eligible`);
    } else {
      evaluations.push({
        ruleName: 'Marital Status',
        passed: false,
        reason: `Allowed marital status: ${rules.allowedMaritalStatus.join(', ')}`,
        reasonHindi: `केवल इन वैवाहिक स्थितियों हेतु मान्य: ${rules.allowedMaritalStatus.join(', ')}`,
      });
      failingReasons.push(`Marital status (${profile.maritalStatus}) not eligible`);
      hardDisqualification = true;
    }
  }

  // 13. BPL requirement
  if (rules.requiresBpl) {
    if (profile.isBPL) {
      evaluations.push({
        ruleName: 'BPL / Antyodaya Status',
        passed: true,
        reason: 'Valid BPL/Antyodaya ration card verified',
        reasonHindi: 'बीपीएल / अन्त्योदय राशन कार्ड सत्यापित',
      });
      passingReasons.push('BPL status confirmed');
    } else {
      evaluations.push({
        ruleName: 'BPL / Antyodaya Status',
        passed: false,
        reason: 'Requires valid BPL or Antyodaya ration card',
        reasonHindi: 'बीपीएल अथवा अन्त्योदय राशन कार्ड होना अनिवार्य है',
      });
      failingReasons.push('Requires active BPL / Antyodaya status');
      hardDisqualification = true;
    }
  }

  // 14. Document readiness check
  const missingDocs: string[] = [];
  if (scheme.requiredDocuments && scheme.requiredDocuments.length > 0) {
    for (const docId of scheme.requiredDocuments) {
      const docState = profile.verifiedDocuments?.[docId];
      if (!docState || !docState.verified) {
        missingDocs.push(docId);
        softPendingCount++;
      }
    }
  }

  // Determine final status & match score
  const totalRules = evaluations.length;
  const passedCount = evaluations.filter(e => e.passed).length;
  let matchScore = totalRules > 0 ? Math.round((passedCount / totalRules) * 100) : 100;

  let status: 'eligible' | 'likely' | 'not_eligible' = 'not_eligible';

  if (hardDisqualification) {
    status = 'not_eligible';
    matchScore = Math.min(matchScore, 45);
    recommendations.push('Review eligibility criteria or check other matching schemes for your profile');
  } else if (missingDocs.length > 0) {
    status = 'likely';
    matchScore = Math.min(matchScore, 85);
    recommendations.push(`Upload or fetch ${missingDocs.length} pending document(s) via DigiLocker to complete eligibility`);
  } else {
    status = 'eligible';
    matchScore = 100;
    recommendations.push('All demographic rules and documents are verified! You can proceed to submit application.');
  }

  return {
    scheme,
    status,
    matchScore,
    ruleEvaluations: evaluations,
    passingReasons,
    failingReasons,
    missingDocuments: missingDocs,
    recommendations,
  };
}

/**
 * Filter and sort a full schemes list against a citizen profile
 */
export function rankSchemesForCitizen(
  profile: CitizenProfile,
  schemes: Scheme[]
): SchemeEligibilityResult[] {
  const results = schemes.map(scheme => evaluateSchemeEligibility(profile, scheme));

  return results.sort((a, b) => {
    const statusPriority = { eligible: 3, likely: 2, not_eligible: 1 };
    const priorityDiff = statusPriority[b.status] - statusPriority[a.status];
    if (priorityDiff !== 0) return priorityDiff;
    return b.matchScore - a.matchScore;
  });
}
