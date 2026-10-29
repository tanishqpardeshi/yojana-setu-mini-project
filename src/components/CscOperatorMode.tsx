import React, { useState } from 'react';
import { 
  Laptop, 
  Fingerprint, 
  Scan, 
  UserPlus, 
  CheckCircle, 
  Users, 
  Sparkles, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  IndianRupee,
  Layers
} from 'lucide-react';
import { Scheme, CitizenProfile, SupportedLanguage, ApplicationRecord } from '../types';

interface CscOperatorModeProps {
  currentLanguage: SupportedLanguage;
  schemes: Scheme[];
  onSubmitApplication: (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
    kioskOperatorCode: string;
  }) => void;
}

export const CscOperatorMode: React.FC<CscOperatorModeProps> = ({
  currentLanguage,
  schemes,
  onSubmitApplication,
}) => {
  const [operatorId, setOperatorId] = useState('MPON-IND-7201');
  const [kioskLocation, setKioskLocation] = useState('Vijay Nagar Scheme 54 Kiosk, Indore');
  const [tokenCounter, setTokenCounter] = useState(42);
  const [biometricAuthenticated, setBiometricAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Assisted Intake Form Fields
  const [applicantName, setApplicantName] = useState('Radha Bai Verma');
  const [samagraFamilyId, setSamagraFamilyId] = useState('39510482');
  const [samagraMemberId, setSamagraMemberId] = useState('308192842');
  const [phone, setPhone] = useState('9893012345');
  const [wardOrBlock, setWardOrBlock] = useState('Ward 60 (Rajwada / Sarafa)');
  const [selectedSchemeId, setSelectedSchemeId] = useState('mp_ladli_behna');
  const [bundleKisan, setBundleKisan] = useState(false);
  const [submittedAlert, setSubmittedAlert] = useState<string | null>(null);

  const handleSimulateBiometric = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setBiometricAuthenticated(true);
      setIsAuthenticating(false);
    }, 1000);
  };

  const handleIssueToken = () => {
    setTokenCounter(prev => prev + 1);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!biometricAuthenticated) {
      alert('Please perform Biometric Aadhaar / Iris consent before registering assisted intake.');
      return;
    }

    onSubmitApplication({
      schemeId: selectedSchemeId,
      applicantName,
      samagraMemberId,
      samagraFamilyId,
      phone,
      wardOrBlock,
      areaType: wardOrBlock.includes('Ward') ? 'urban' : 'rural',
      kioskOperatorCode: operatorId,
    });

    if (bundleKisan) {
      onSubmitApplication({
        schemeId: 'mp_kisan_kalyan',
        applicantName,
        samagraMemberId,
        samagraFamilyId,
        phone,
        wardOrBlock,
        areaType: 'rural',
        kioskOperatorCode: operatorId,
      });
    }

    setSubmittedAlert(`Assisted Application submitted by Operator ${operatorId}! Citizen token IND-TKN-${tokenCounter} marked completed.`);
    setTokenCounter(prev => prev + 1);
    setBiometricAuthenticated(false);
    setTimeout(() => setSubmittedAlert(null), 5000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded">
              MPOnline & CSC Jan Seva Kendra Operator Desk
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            CSC Kiosk Operator Mode (सहायक नागरिक सेवा केंद्र)
          </h2>
          <p className="text-sm text-slate-500">
            Assisted application intake, token generation, and biometric verification terminal for Village Level Entrepreneurs (VLEs) across Indore District.
          </p>
        </div>

        {/* Operator Badge */}
        <div className="bg-slate-900 text-white px-4 py-2.5 rounded-2xl border border-slate-800 shadow-md">
          <div className="text-[10px] text-amber-400 font-mono font-bold uppercase">Active Operator Terminal</div>
          <div className="text-sm font-black font-mono">{operatorId}</div>
          <div className="text-[11px] text-slate-300 truncate max-w-[200px]">{kioskLocation}</div>
        </div>
      </div>

      {submittedAlert && (
        <div className="p-4 bg-emerald-100 text-emerald-900 rounded-2xl border border-emerald-300 text-xs font-bold flex items-center space-x-2 shadow-xs">
          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{submittedAlert}</span>
        </div>
      )}

      {/* Operator KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Today's Token Queue</div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">IND-TKN-{tokenCounter}</div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">3 Citizens Waiting</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Intakes Completed Today</div>
          <div className="text-2xl font-black text-blue-600 font-mono mt-1">29 Applications</div>
          <div className="text-[10px] text-slate-500 mt-0.5">100% Aadhaar Verified</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Kiosk Facilitation Fee</div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">₹1,450</div>
          <div className="text-[10px] text-slate-500 mt-0.5">₹50/intake subsidized by MP Govt</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-medium">Biometric Device</div>
          <div className="text-sm font-bold text-emerald-700 flex items-center space-x-1 mt-2">
            <Fingerprint className="w-4 h-4 text-emerald-600" />
            <span>Mantra MFS100 Ready</span>
          </div>
        </div>
      </div>

      {/* Assisted Application Intake Form */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-black text-slate-900">
              Assisted Citizen Intake Terminal (सहायक आवेदन प्रविष्टि)
            </h3>
            <p className="text-xs text-slate-500">
              Fill citizen Samagra & biometric details to directly lodge application into Indore Collectorate workflow.
            </p>
          </div>

          <button
            type="button"
            onClick={handleIssueToken}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition"
          >
            + Next Token (IND-TKN-{tokenCounter + 1})
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="applicantNameInput" className="block text-xs font-semibold text-slate-700 mb-1">
                Citizen Full Name (आवेदक का नाम):
              </label>
              <input
                id="applicantNameInput"
                type="text"
                value={applicantName}
                onChange={e => setApplicantName(e.target.value)}
                required
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="mobileInput" className="block text-xs font-semibold text-slate-700 mb-1">
                Mobile Number (मोबाइल नंबर - ओटीपी व एसएमएस हेतु):
              </label>
              <input
                id="mobileInput"
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="samagraFamilyInput" className="block text-xs font-semibold text-slate-700 mb-1">
                Samagra Family ID (8-Digit समग्र परिवार आईडी):
              </label>
              <input
                id="samagraFamilyInput"
                type="text"
                value={samagraFamilyId}
                onChange={e => setSamagraFamilyId(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="samagraMemberInput" className="block text-xs font-semibold text-slate-700 mb-1">
                Samagra Member ID (9-Digit समग्र सदस्य आईडी):
              </label>
              <input
                id="samagraMemberInput"
                type="text"
                value={samagraMemberId}
                onChange={e => setSamagraMemberId(e.target.value)}
                required
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="jurisdictionInput" className="block text-xs font-semibold text-slate-700 mb-1">
                Jurisdiction Ward or Rural Block:
              </label>
              <input
                id="jurisdictionInput"
                type="text"
                value={wardOrBlock}
                onChange={e => setWardOrBlock(e.target.value)}
                required
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="targetSchemeSelect" className="block text-xs font-semibold text-slate-700 mb-1">
                Target Scheme (लक्षित योजना):
              </label>
              <select
                id="targetSchemeSelect"
                value={selectedSchemeId}
                onChange={e => setSelectedSchemeId(e.target.value)}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {schemes.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Scheme Bundling Checkbox for Farmers */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs">
            <label className="flex items-center space-x-2.5 text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={bundleKisan}
                onChange={e => setBundleKisan(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <span className="font-bold text-amber-950">
                1-Click Farmer Bundle: Simultaneously submit MP Mukhyamantri Kisan Kalyan (₹6,000 state top-up)
              </span>
            </label>
            <p className="text-[11px] text-amber-800 mt-1 pl-6">
              Saves applicant from making multiple trips. Combines PM-KISAN central filing with Madhya Pradesh state top-up.
            </p>
          </div>

          {/* Biometric Aadhaar / Iris Consent Section */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Fingerprint className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-xs text-slate-900">
                  Aadhaar Biometric e-KYC Consent (बायोमेट्रिक अंगूठा / आईरिस सत्यापन)
                </span>
              </div>

              {biometricAuthenticated ? (
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center space-x-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Biometrics Verified</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSimulateBiometric}
                  disabled={isAuthenticating}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Scan className={`w-3.5 h-3.5 ${isAuthenticating ? 'animate-spin' : ''}`} />
                  <span>{isAuthenticating ? 'Scanning Scanner...' : 'Capture Fingerprint'}</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Operator certification: Applicant is physically present at Kiosk {operatorId}. Verified that Aadhaar number belongs to applicant and bank account has active NPCI DBT linkage.
            </p>
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center space-x-2"
            >
              <span>Submit Assisted Application & Generate ARN</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
