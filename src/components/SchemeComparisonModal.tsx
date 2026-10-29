import React, { useState } from 'react';
import { 
  X, 
  ArrowRightLeft, 
  CheckCircle, 
  AlertCircle, 
  Building2, 
  IndianRupee, 
  FileText, 
  Clock, 
  PhoneCall, 
  Plus, 
  Trash2 
} from 'lucide-react';
import { Scheme, SupportedLanguage } from '../types';

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
      return [initialSchemeId, schemes[1]?.id || schemes[0].id].slice(0, 2);
    }
    // Default to comparison: PM-KISAN vs MP Kisan Kalyan
    return ['nat_pm_kisan', 'mp_kisan_kalyan'];
  });

  if (!isOpen) return null;

  const comparedSchemes = selectedIds
    .map(id => schemes.find(s => s.id === id))
    .filter((s): s is Scheme => Boolean(s));

  const handleAddScheme = (id: string) => {
    if (selectedIds.length < 3 && !selectedIds.includes(id)) {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleRemoveScheme = (id: string) => {
    if (selectedIds.length > 1) {
      setSelectedIds(selectedIds.filter(i => i !== id));
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
                {currentLanguage === 'hi' ? 'योजना तुलना मंच (Scheme Comparison)' : 'Side-by-Side Scheme Comparison'}
              </h3>
              <p className="text-xs text-slate-400">
                Compare up to 3 central, MP state, or Indore local schemes on rules, benefits, and documents.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scheme Selector Bar */}
        <div className="p-4 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Comparing ({comparedSchemes.length}/3):</span>
            {comparedSchemes.map(s => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 text-slate-800 text-xs font-bold rounded-lg shadow-xs"
              >
                <span className="truncate max-w-[140px]">{s.title}</span>
                {comparedSchemes.length > 1 && (
                  <button
                    onClick={() => handleRemoveScheme(s.id)}
                    className="text-slate-400 hover:text-rose-600"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {comparedSchemes.length < 3 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Add scheme:</span>
              <select
                onChange={e => {
                  if (e.target.value) handleAddScheme(e.target.value);
                  e.target.value = '';
                }}
                className="text-xs font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                defaultValue=""
              >
                <option value="" disabled>Select scheme to add...</option>
                {schemes
                  .filter(s => !selectedIds.includes(s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      [{s.governanceLevel.toUpperCase()}] {s.title}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Comparison Matrix Table */}
        <div className="overflow-x-auto flex-1 p-4 sm:p-6 bg-slate-50">
          <table className="w-full border-collapse border border-slate-200 bg-white rounded-2xl overflow-hidden shadow-xs text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                <th className="p-3 text-left w-1/4 font-bold text-[11px] uppercase tracking-wider text-slate-500">
                  Feature / Parameter
                </th>
                {comparedSchemes.map(s => (
                  <th key={s.id} className="p-3 text-left font-black text-slate-900 border-l border-slate-200">
                    <div className="text-[10px] text-amber-700 uppercase font-mono font-bold">
                      {s.governanceLevel.replace('_', ' ')}
                    </div>
                    <div className="text-sm font-heading">{s.title}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{s.titleHindi}</div>
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
                    <span>Financial Entitlement</span>
                  </div>
                </td>
                {comparedSchemes.map(s => (
                  <td key={s.id} className="p-3 border-l border-slate-200">
                    <div className="text-base font-black text-emerald-700 font-mono">
                      ₹{s.financialEntitlement.amount.toLocaleString('en-IN')}
                    </div>
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 mt-1">
                      {s.financialEntitlement.frequency}
                    </span>
                    <p className="text-[11px] text-slate-600 mt-1">{s.financialEntitlement.description}</p>
                  </td>
                ))}
              </tr>

              {/* Target Beneficiary */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Target Beneficiary</td>
                {comparedSchemes.map(s => (
                  <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700 font-medium">
                    {s.targetBeneficiary}
                  </td>
                ))}
              </tr>

              {/* Age Limits */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Age Limit</td>
                {comparedSchemes.map(s => {
                  const rules = s.eligibilityRules;
                  const ageText = rules.ageMin || rules.ageMax
                    ? `${rules.ageMin || 0} to ${rules.ageMax || 'Unlimited'} Years`
                    : 'No specific age restrictions';
                  return (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                      {ageText}
                    </td>
                  );
                })}
              </tr>

              {/* Gender Requirement */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Gender Eligibility</td>
                {comparedSchemes.map(s => {
                  const g = s.eligibilityRules.gender;
                  return (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700 font-semibold">
                      {g === 'female' ? 'Women Only' : g === 'male' ? 'Men Only' : 'All Genders (Open)'}
                    </td>
                  );
                })}
              </tr>

              {/* Annual Income Cap */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Max Annual Income</td>
                {comparedSchemes.map(s => {
                  const cap = s.eligibilityRules.maxIncomeAnnual;
                  return (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                      {cap ? `Up to ₹${cap.toLocaleString('en-IN')}/year` : 'No formal income ceiling'}
                    </td>
                  );
                })}
              </tr>

              {/* Jurisdiction / Area */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Area Type</td>
                {comparedSchemes.map(s => {
                  const area = s.eligibilityRules.requiredAreaType;
                  return (
                    <td key={s.id} className="p-3 border-l border-slate-200 text-slate-700">
                      {area === 'urban' ? 'Urban Only (IMC Wards 1-85)' : area === 'rural' ? 'Rural Only (Janpads)' : 'Both Urban & Rural Indore'}
                    </td>
                  );
                })}
              </tr>

              {/* Required Documents */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Required Documents</td>
                {comparedSchemes.map(s => (
                  <td key={s.id} className="p-3 border-l border-slate-200">
                    <ul className="space-y-1">
                      {s.requiredDocuments.map((doc, dIdx) => (
                        <li key={dIdx} className="flex items-center space-x-1 text-slate-600">
                          <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                ))}
              </tr>

              {/* Nodal Office in Indore */}
              <tr className="hover:bg-slate-50/50">
                <td className="p-3 font-bold text-slate-800 bg-slate-50">Indore Nodal Office</td>
                {comparedSchemes.map(s => (
                  <td key={s.id} className="p-3 border-l border-slate-200 text-slate-600 text-[11px]">
                    <div className="font-semibold text-slate-800">{s.nodalOfficeIndore}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Helpline: {s.helpline}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Modal Bottom */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
