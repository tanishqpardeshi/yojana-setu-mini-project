import React, { useState } from 'react';
import { 
  Building2, 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  QrCode, 
  X, 
  FileText,
  ShieldCheck,
  User,
  Phone,
  MapPin
} from 'lucide-react';
import { Scheme, CitizenProfile, SupportedLanguage } from '../types';

interface ApplicationIntakeModalProps {
  scheme: Scheme | null;
  profile: CitizenProfile;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
  }) => void;
}

export const ApplicationIntakeModal: React.FC<ApplicationIntakeModalProps> = ({
  scheme,
  profile,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !scheme) return null;

  const [applicantName, setApplicantName] = useState(profile.fullName || 'Sunita Sharma');
  const [phone, setPhone] = useState('9826012345');
  const [samagraFamilyId, setSamagraFamilyId] = useState(profile.samagraFamilyId || '48921840');
  const [samagraMemberId, setSamagraMemberId] = useState(profile.samagraMemberId || '109283742');
  const [wardOrBlock, setWardOrBlock] = useState(
    profile.areaType === 'urban'
      ? `Ward ${profile.wardNumber || 72} (Vijay Nagar)`
      : `${profile.blockName || 'Depalpur'} Janpad`
  );
  const [consentChecked, setConsentChecked] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) {
      alert('Please accept the declaration checkbox before submission.');
      return;
    }

    onSubmit({
      schemeId: scheme.id,
      applicantName,
      samagraMemberId,
      samagraFamilyId,
      phone,
      wardOrBlock,
      areaType: profile.areaType,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {scheme.code}
            </span>
          </div>
          <h3 className="text-xl font-black text-slate-900 leading-snug">
            {scheme.title}
          </h3>
          <p className="text-xs font-devanagari text-slate-500 font-bold">
            {scheme.titleHindi}
          </p>
        </div>

        {/* Benefits Summary Box */}
        <div className="my-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs flex justify-between items-center">
          <div>
            <div className="font-bold text-emerald-950">Target Financial Entitlement:</div>
            <div className="text-emerald-800 mt-0.5">{scheme.benefits}</div>
          </div>
          <div className="text-right shrink-0 ml-3">
            <div className="text-base font-black text-emerald-800 font-mono">
              {scheme.financialEntitlement.frequency === 'In-Kind / Service'
                ? 'In-Kind'
                : `₹${scheme.financialEntitlement.amount.toLocaleString('en-IN')}`}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">{scheme.financialEntitlement.frequency}</div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Applicant Full Name (आवेदक का नाम):
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={e => setApplicantName(e.target.value)}
              required
              className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (मोबाइल):
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Indore Ward / Janpad:
              </label>
              <input
                type="text"
                value={wardOrBlock}
                onChange={e => setWardOrBlock(e.target.value)}
                required
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Samagra Family ID (8-Digit):
              </label>
              <input
                type="text"
                value={samagraFamilyId}
                onChange={e => setSamagraFamilyId(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Samagra Member ID (9-Digit):
              </label>
              <input
                type="text"
                value={samagraMemberId}
                onChange={e => setSamagraMemberId(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Consent Checkbox */}
          <div className="pt-2">
            <label className="flex items-start space-x-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={e => setConsentChecked(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 mt-0.5 w-4 h-4"
              />
              <span>
                I hereby declare that all provided details and Samagra credentials are true and correct. I authorize the Indore District Administration and IMC to verify my records via DigiLocker.
              </span>
            </label>
          </div>

          {/* Submission Button */}
          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <span>Submit Application & Generate ARN</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
