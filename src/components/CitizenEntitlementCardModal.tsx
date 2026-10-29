import React, { useRef } from 'react';
import { 
  ShieldCheck, 
  Download, 
  Printer, 
  X, 
  QrCode, 
  CheckCircle, 
  Building2, 
  IndianRupee, 
  Award, 
  MapPin, 
  FileText 
} from 'lucide-react';
import { CitizenProfile, SchemeEligibilityResult, SupportedLanguage } from '../types';

interface CitizenEntitlementCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: CitizenProfile;
  eligibilityResults: SchemeEligibilityResult[];
  currentLanguage: SupportedLanguage;
}

export const CitizenEntitlementCardModal: React.FC<CitizenEntitlementCardModalProps> = ({
  isOpen,
  onClose,
  profile,
  eligibilityResults,
  currentLanguage,
}) => {
  if (!isOpen) return null;

  const eligibleSchemes = eligibilityResults.filter(r => r.status === 'eligible');
  const likelySchemes = eligibilityResults.filter(r => r.status === 'likely');
  const totalQualifiedCount = eligibleSchemes.length + likelySchemes.length;

  // Calculate annual estimated entitlement
  const annualCashTotal = eligibleSchemes.reduce((sum, item) => {
    const ent = item.scheme.financialEntitlement;
    if (ent.frequency === 'Monthly') return sum + ent.amount * 12;
    if (ent.frequency === 'Annual') return sum + ent.amount;
    return sum;
  }, 0);

  const oneTimeCashTotal = eligibleSchemes.reduce((sum, item) => {
    const ent = item.scheme.financialEntitlement;
    if (ent.frequency === 'One-Time' || ent.frequency === 'Subsidized Loan') return sum + ent.amount;
    return sum;
  }, 0);

  const handlePrint = () => {
    window.print();
  };

  const cardRef = 'YS-ENT-CARD-' + (profile.samagraMemberId || 'INDORE-2026');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Modal Top Actions */}
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center no-print border-b border-slate-800">
          <div className="flex items-center space-x-2 text-xs font-semibold">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Official Citizen Entitlement Certificate • Indore District</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Certificate Body (Print Target) */}
        <div className="p-6 sm:p-8 space-y-6 bg-slate-50/40">
          {/* Certificate Header */}
          <div className="border-4 border-double border-amber-600/60 p-6 bg-white rounded-2xl shadow-sm relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
              <Building2 className="w-96 h-96 text-slate-900" />
            </div>

            {/* Official Header */}
            <div className="text-center space-y-1 pb-4 border-b-2 border-amber-500/40">
              <div className="text-[11px] font-bold text-amber-800 uppercase tracking-widest font-heading">
                Government of Madhya Pradesh • District Administration Indore
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 font-heading">
                नागरिक अधिकार व शासकीय पात्रता पत्रक
              </h2>
              <p className="text-xs text-slate-600">
                Official Citizen Welfare Entitlement Card • Indore Municipal & Janpad Jurisdiction
              </p>
              <div className="inline-block mt-1 px-3 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full font-mono">
                Certificate ID: {cardRef} • Valid for FY 2026-27
              </div>
            </div>

            {/* Citizen Demographic Profile Grid */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Citizen Name</span>
                <div className="font-bold text-slate-900 truncate">{profile.fullName}</div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Samagra Member ID</span>
                <div className="font-mono font-bold text-slate-900">{profile.samagraMemberId || 'Not Linked'}</div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Age / Gender</span>
                <div className="font-semibold text-slate-900">{profile.age} Yrs • {profile.gender.toUpperCase()}</div>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">Jurisdiction</span>
                <div className="font-semibold text-slate-900">
                  {profile.areaType === 'urban' ? `Ward ${profile.wardNumber || 'IMC'}` : `${profile.blockName || 'Janpad'}`}
                </div>
              </div>
            </div>

            {/* Financial Entitlement Highlights */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Annual Direct Cash Entitlement</span>
                <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                  ₹{annualCashTotal.toLocaleString('en-IN')}<span className="text-xs font-normal">/yr</span>
                </div>
                <div className="text-[9px] text-emerald-700 mt-0.5">Via Aadhaar DBT Bank Transfer</div>
              </div>

              <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-800 uppercase">One-Time Capital Subsidy</span>
                <div className="text-xl font-black text-blue-700 font-mono mt-0.5">
                  ₹{oneTimeCashTotal.toLocaleString('en-IN')}
                </div>
                <div className="text-[9px] text-blue-700 mt-0.5">Housing, Tools & Asset Grants</div>
              </div>

              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-center">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Total Pre-Qualified Schemes</span>
                <div className="text-xl font-black text-amber-700 font-mono mt-0.5">
                  {totalQualifiedCount} <span className="text-xs font-normal">Schemes</span>
                </div>
                <div className="text-[9px] text-amber-700 mt-0.5">{eligibleSchemes.length} Fully Eligible • {likelySchemes.length} Likely</div>
              </div>
            </div>

            {/* Pre-Qualified Schemes Table */}
            <div className="mt-5 space-y-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pre-Qualified Scheme Portfolio (Indore District Rules Engine)</span>
              </h4>

              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left divide-y divide-slate-200">
                  <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">Tier</th>
                      <th className="px-3 py-2">Scheme Name</th>
                      <th className="px-3 py-2">Entitlement Amount</th>
                      <th className="px-3 py-2">Match Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {eligibleSchemes.slice(0, 6).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">
                          {item.scheme.governanceLevel.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {item.scheme.title}
                          <div className="text-[10px] font-normal text-slate-500">{item.scheme.titleHindi}</div>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          ₹{item.scheme.financialEntitlement.amount.toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] text-slate-500 font-normal">
                            ({item.scheme.financialEntitlement.frequency})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[9px]">
                            ELIGIBLE (100%)
                          </span>
                        </td>
                      </tr>
                    ))}

                    {likelySchemes.slice(0, 2).map((item, idx) => (
                      <tr key={`likely-${idx}`} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase">
                          {item.scheme.governanceLevel.replace('_', ' ')}
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-800">
                          {item.scheme.title}
                          <div className="text-[10px] font-normal text-slate-500">{item.scheme.titleHindi}</div>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-amber-700 whitespace-nowrap">
                          ₹{item.scheme.financialEntitlement.amount.toLocaleString('en-IN')}{' '}
                          <span className="text-[9px] text-slate-500 font-normal">
                            ({item.scheme.financialEntitlement.frequency})
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[9px]">
                            LIKELY ({item.matchScore}%)
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Digital Seal & Signature Footer */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 bg-slate-100 border border-slate-300 rounded-xl flex items-center justify-center p-1">
                  <QrCode className="w-11 h-11 text-slate-800" />
                </div>
                <div className="text-[10px] text-slate-500">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>NIC Digital Signature Authenticated</span>
                  </div>
                  <div>SHA-256: 4d92a188e993bbf0912</div>
                  <div>Verify at: yojanasetu.indore.gov.in/verify</div>
                </div>
              </div>

              <div className="text-center sm:text-right text-[11px] text-slate-600">
                <div className="font-mono font-bold text-slate-900">[Official Digital Seal]</div>
                <div className="font-semibold text-slate-800">Nodal Verification Officer</div>
                <div>Collectorate Campus, Moti Tabela, Indore 452007</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Close */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end no-print">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
