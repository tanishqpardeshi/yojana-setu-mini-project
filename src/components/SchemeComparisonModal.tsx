import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowRightLeft,
  CheckCircle,
  IndianRupee,
  ExternalLink,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { Scheme, SupportedLanguage } from '../types';
import {
  getDocumentLabel,
  getFrequencyLabel,
  getGovernanceLevelLabel,
  getSchemeBenefits,
  getSchemeTitle,
  pickText,
} from '../utils/i18n';
import { getOfficialPortalDisplayHost, resolveSchemePortalUrl } from '../utils/liveDataEngine';
import { getSchemeApplicationProcedure } from '../utils/schemeProcedures';

interface SchemeComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  schemes: Scheme[];
  currentLanguage: SupportedLanguage;
  initialSchemeId?: string;
}

export const SchemeComparisonModal: React.FC<SchemeComparisonModalProps> = ({
  isOpen,
  onClose,
  schemes,
  currentLanguage,
  initialSchemeId,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (initialSchemeId) {
      return [initialSchemeId, schemes[1]?.id || schemes[0]?.id].filter(Boolean).slice(0, 2) as string[];
    }
    return ['nat_pm_kisan', 'mp_kisan_kalyan'];
  });

  const comparedSchemes = useMemo(() => {
    const matched = selectedIds
      .map(id => schemes.find(s => s.id === id))
      .filter((s): s is Scheme => Boolean(s));
    if (matched.length > 0) return matched;
    return schemes.slice(0, 2);
  }, [selectedIds, schemes]);

  if (!isOpen) return null;

  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const activeIds = comparedSchemes.map(s => s.id);

  const handleAddScheme = (id: string) => {
    if (activeIds.length < 3 && !activeIds.includes(id)) {
      setSelectedIds([...activeIds, id]);
    }
  };

  const handleRemoveScheme = (id: string) => {
    if (activeIds.length > 1) {
      setSelectedIds(activeIds.filter(i => i !== id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-5xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center border-b border-slate-700 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base sm:text-lg font-heading">
                {t(
                  'Side-by-Side Scheme Comparison',
                  'योजना तुलना मंच',
                  'योजना री साथ-साथ तुलना करो'
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {t(
                  'Compare up to 3 central, MP state, or Indore local schemes on rules, benefits, and documents.',
                  'केंद्र, म.प्र. राज्य या इंदौर की 3 योजनाओं के नियम, लाभ और दस्तावेजों की तुलना करें।',
                  'केंद्र, म.प्र. या इंदौर री 3 योजना रा नियम, फायदो अने कागद साथ-साथ देख सको छो।'
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scheme Selector Bar */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-bold text-slate-600">
              {t(
                `Comparing (${comparedSchemes.length}/3):`,
                `तुलना में (${comparedSchemes.length}/3):`,
                `तुलना मां (${comparedSchemes.length}/3):`
              )}
            </span>
            {comparedSchemes.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg shadow-xs"
              >
                <span className="truncate max-w-[160px]">{getSchemeTitle(s, currentLanguage)}</span>
                {comparedSchemes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveScheme(s.id)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    title={t('Remove', 'हटाएं', 'हटावो')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {comparedSchemes.length < 3 && schemes.length > comparedSchemes.length && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">
                {t('Add scheme:', 'योजना जोड़ें:', 'योजना जोड़ो:')}
              </span>
              <select
                onChange={e => {
                  if (e.target.value) handleAddScheme(e.target.value);
                  e.target.value = '';
                }}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                defaultValue=""
              >
                <option value="" disabled>
                  {t('Select scheme to add...', 'जोड़ने के लिए योजना चुनें...', 'जोड़ण खातर योजना चुनो...')}
                </option>
                {schemes
                  .filter(s => !activeIds.includes(s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {getSchemeTitle(s, currentLanguage)}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Comparison Matrix Table */}
        <div className="overflow-x-auto flex-1 p-3 sm:p-6 bg-slate-50">
          {comparedSchemes.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600 bg-white rounded-2xl border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900">
                {t('Modify your search criteria', 'Modify your search criteria — अपने खोज मापदंड बदलें', 'Modify your search criteria — थारा खोज रा नियम बदलो')}
              </div>
              <p>
                {t(
                  'No schemes available in the current filtered view to compare.',
                  'तुलना के लिए वर्तमान फिल्टर में कोई योजना उपलब्ध नहीं है।',
                  'अभी रा फिल्टर मां तुलना खातर कोई योजना उपलब्ध नी छे।'
                )}
              </p>
            </div>
          ) : (
            <>
              <p className="sm:hidden text-[11px] text-slate-500 mb-2 font-medium">
                {t('Swipe left/right to compare all columns →', 'सभी कॉलम देखने के लिए बाएं/दाएं स्वाइप करें →', 'सगळा कॉलम देखण खातर साइड मां सरकावो →')}
              </p>
              <table className="w-full min-w-[640px] border-collapse border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-xs text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <th className="p-3 text-left w-1/4 font-bold text-[11px] uppercase tracking-wider text-slate-500">
                    {t('Feature / Parameter', 'विवरण / मानदंड', 'जानकारी / नियम')}
                  </th>
                  {comparedSchemes.map(s => (
                    <th key={s.id} className="p-3 text-left font-black text-slate-900 border-l border-slate-200">
                      <div className="text-[10px] text-amber-700 font-bold">
                        {getGovernanceLevelLabel(s.governanceLevel, currentLanguage)}
                      </div>
                      <div className="text-sm font-heading">{getSchemeTitle(s, currentLanguage)}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        {currentLanguage === 'en' ? s.titleHindi : s.title}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Financial Benefit */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    <div className="flex items-center space-x-1.5 text-emerald-800">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>{t('Financial Entitlement', 'वित्तीय लाभ', 'मिलण वालो फायदो')}</span>
                    </div>
                  </td>
                  {comparedSchemes.map(s => (
                    <td key={s.id} className="p-3 border-l border-slate-200">
                      <div className="text-base font-black text-emerald-700 font-mono">
                        ₹{s.financialEntitlement.amount.toLocaleString('en-IN')}
                      </div>
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 mt-1">
                        {getFrequencyLabel(s.financialEntitlement.frequency, currentLanguage)}
                      </span>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {getSchemeBenefits(s, currentLanguage)}
                      </p>
                    </td>
                  ))}
                </tr>

                {/* Target Beneficiary */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Target Beneficiary', 'लक्षित लाभार्थी', 'किण खातर योजना')}
                  </td>
                  {comparedSchemes.map(s => (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700 font-medium">
                      {s.targetBeneficiary}
                    </td>
                  ))}
                </tr>

                {/* Age Limits */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Age Limit', 'आयु सीमा', 'उमर री सीमा')}
                  </td>
                  {comparedSchemes.map(s => {
                    const rules = s.eligibilityRules;
                    const ageText =
                      rules.ageMin || rules.ageMax
                        ? t(
                            `${rules.ageMin || 0} to ${rules.ageMax || 'Unlimited'} Years`,
                            `${rules.ageMin || 0} से ${rules.ageMax || 'कोई सीमा नहीं'} वर्ष`,
                            `${rules.ageMin || 0} सूं ${rules.ageMax || 'कोई सीमा नी'} बरस`
                          )
                        : t(
                            'No specific age restrictions',
                            'आयु की कोई विशेष सीमा नहीं',
                            'उमर री कोई खास बंदिश नी छे'
                          );
                    return (
                      <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                        {ageText}
                      </td>
                    );
                  })}
                </tr>

                {/* Gender Requirement */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Gender Eligibility', 'लिंग पात्रता', 'लिंग पात्रता')}
                  </td>
                  {comparedSchemes.map(s => {
                    const g = s.eligibilityRules.gender;
                    return (
                      <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700 font-semibold">
                        {g === 'female'
                          ? t('Women Only', 'केवल महिलाएं', 'सिर्फ बाईजी (महिला) खातर')
                          : g === 'male'
                          ? t('Men Only', 'केवल पुरुष', 'सिर्फ भाईजी (पुरुष) खातर')
                          : t('All Genders (Open)', 'सभी लिंग (खुला)', 'सगळा खातर खुली')}
                      </td>
                    );
                  })}
                </tr>

                {/* Annual Income Cap */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Max Annual Income', 'अधिकतम वार्षिक आय', 'साल री ज्यादा कमाई सीमा')}
                  </td>
                  {comparedSchemes.map(s => {
                    const cap = s.eligibilityRules.maxIncomeAnnual;
                    return (
                      <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                        {cap
                          ? t(
                              `Up to ₹${cap.toLocaleString('en-IN')}/year`,
                              `₹${cap.toLocaleString('en-IN')}/वर्ष तक`,
                              `₹${cap.toLocaleString('en-IN')}/साल तक`
                            )
                          : t('No formal income ceiling', 'कोई औपचारिक आय सीमा नहीं', 'कमाई री कोई खास सीमा नी')}
                      </td>
                    );
                  })}
                </tr>

                {/* Jurisdiction / Area */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Area Type', 'क्षेत्र प्रकार', 'शहर / गाँव क्षेत्र')}
                  </td>
                  {comparedSchemes.map(s => {
                    const area = s.eligibilityRules.requiredAreaType;
                    return (
                      <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                        {area === 'urban'
                          ? t('Urban Only (IMC Wards 1-85)', 'केवल शहरी (वार्ड 1-85)', 'सिर्फ शहर (वार्ड 1-85)')
                          : area === 'rural'
                          ? t('Rural Only (Janpads)', 'केवल ग्रामीण (जनपद)', 'सिर्फ गाँव (जनपद पंचायत)')
                          : t('Both Urban & Rural Indore', 'शहरी एवं ग्रामीण दोनों', 'शहर अने गाँव दोनूं खातर')}
                      </td>
                    );
                  })}
                </tr>

                {/* Required Documents */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Required Documents', 'आवश्यक दस्तावेज', 'जरूरी कागद')}
                  </td>
                  {comparedSchemes.map(s => (
                    <td key={s.id} className="p-3 border-l border-slate-200">
                      <ul className="space-y-1">
                        {s.requiredDocuments.map((doc, dIdx) => (
                          <li key={dIdx} className="flex items-center space-x-1 text-slate-600">
                            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate">{getDocumentLabel(doc, currentLanguage)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  ))}
                </tr>

                {/* Nodal Office in Indore */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    {t('Indore Nodal Office', 'इंदौर नोडल कार्यालय', 'इंदौर मुख्य दफ्तर')}
                  </td>
                  {comparedSchemes.map(s => (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-600 text-[11px]">
                      <div className="font-semibold text-slate-800">{s.nodalOfficeIndore}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {t('Helpline:', 'हेल्पलाइन:', 'मदद नंबर:')} {s.helpline}
                      </div>
                    </td>
                  ))}
                </tr>

                {/* Official Verified Government Portal */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50">
                    <div className="flex items-center space-x-1.5 text-emerald-800">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('Official Verified Portal', 'आधिकारिक सत्यापित पोर्टल', 'पक्की सरकारी वेबसाइट')}</span>
                    </div>
                  </td>
                  {comparedSchemes.map(s => (
                    <td key={s.id} className="p-3 border-l border-slate-200">
                      <a
                        href={resolveSchemePortalUrl(s)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono font-bold text-amber-700 hover:text-amber-900 hover:underline break-all"
                      >
                        <span>{getOfficialPortalDisplayHost(s)}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </td>
                  ))}
                </tr>

                {/* Application Procedure */}
                <tr className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-800 bg-slate-50 align-top">
                    <div className="flex items-center space-x-1.5 text-amber-800">
                      <ClipboardList className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('Application Procedure', 'आवेदन प्रक्रिया', 'अर्जी लगावण रो तरीको')}</span>
                    </div>
                  </td>
                  {comparedSchemes.map(s => {
                    const proc = getSchemeApplicationProcedure(s, currentLanguage);
                    return (
                      <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700 align-top space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-500">{proc.mode}</div>
                        <ol className="space-y-1 text-[11px] list-decimal list-inside">
                          {proc.steps.slice(0, 3).map((st, idx) => (
                            <li key={idx} className="leading-snug">
                              {st}
                            </li>
                          ))}
                        </ol>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            </>
          )}
        </div>

        {/* Modal Bottom */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer"
          >
            {t('Close Comparison', 'तुलना बंद करें', 'तुलना बंद करो')}
          </button>
        </div>
      </div>
    </div>
  );
};
