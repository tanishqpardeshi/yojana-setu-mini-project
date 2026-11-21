import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { Scheme, CitizenProfile, SupportedLanguage } from '../types';
import { IMC_WARDS } from '../data/indoreGovernance';
import { ApiRequestError } from '../utils/apiClient';
import {
  validateIndianMobile,
  validateSamagraFamilyId,
  validateSamagraMemberId,
} from '../utils/samagraValidator';
import {
  getFrequencyLabel,
  getSchemeBenefits,
  getSchemeTitle,
  pickText,
} from '../utils/i18n';
import { getSchemeApplicationProcedure } from '../utils/schemeProcedures';

interface ApplicationIntakeModalProps {
  scheme: Scheme | null;
  profile: CitizenProfile;
  isOpen: boolean;
  onClose: () => void;
  currentLanguage?: SupportedLanguage;
  onSubmit: (appData: {
    schemeId: string;
    applicantName: string;
    samagraMemberId: string;
    samagraFamilyId: string;
    phone: string;
    wardOrBlock: string;
    areaType: 'urban' | 'rural';
  }) => Promise<void>;
}

export const ApplicationIntakeModal: React.FC<ApplicationIntakeModalProps> = ({
  scheme,
  profile,
  isOpen,
  onClose,
  currentLanguage = 'en',
  onSubmit,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const computeDefaultWardOrBlock = () => {
    if (profile.areaType === 'urban') {
      const ward = IMC_WARDS.find(w => w.number === (profile.wardNumber || 1));
      return `Ward ${profile.wardNumber || 1} (${ward?.name || 'Indore IMC'})`;
    }
    return `${profile.blockName || 'Indore'} Janpad`;
  };

  const [applicantName, setApplicantName] = useState(profile.fullName || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [samagraFamilyId, setSamagraFamilyId] = useState(profile.samagraFamilyId || '');
  const [samagraMemberId, setSamagraMemberId] = useState(profile.samagraMemberId || '');
  const [wardOrBlock, setWardOrBlock] = useState(computeDefaultWardOrBlock);
  const [consentChecked, setConsentChecked] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showProcedure, setShowProcedure] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApplicantName(profile.fullName || '');
      setPhone(profile.phone || '');
      setSamagraFamilyId(profile.samagraFamilyId || '');
      setSamagraMemberId(profile.samagraMemberId || '');
      setWardOrBlock(computeDefaultWardOrBlock());
      setConsentChecked(true);
      setValidationError(null);
      setErrorDetails(null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scheme?.id, profile.fullName, profile.samagraFamilyId, profile.samagraMemberId, profile.wardNumber, profile.blockName, profile.areaType]);

  if (!isOpen || !scheme) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setValidationError(null);
    setErrorDetails(null);

    if (!applicantName.trim()) {
      setValidationError(
        t(
          'Applicant full name is required.',
          'आवेदक का पूरा नाम आवश्यक है।',
          'अर्जी देवण वाला रो पूरो नाम लिखणो जरूरी छे।'
        )
      );
      return;
    }

    const famCheck = validateSamagraFamilyId(samagraFamilyId);
    if (!famCheck.valid) {
      setValidationError(
        famCheck.error ||
          t(
            'Valid 8-digit Samagra Family ID is required.',
            'मान्य 8-अंकीय समग्र परिवार आईडी आवश्यक है।',
            'सही 8 अंक रो समग्र कुटुंब नंबर लिखणो जरूरी छे।'
          )
      );
      return;
    }

    const memCheck = validateSamagraMemberId(samagraMemberId);
    if (!memCheck.valid) {
      setValidationError(
        memCheck.error ||
          t(
            'Valid 9-digit Samagra Member ID is required.',
            'मान्य 9-अंकीय समग्र सदस्य आईडी आवश्यक है।',
            'सही 9 अंक रो समग्र सदस्य नंबर लिखणो जरूरी छे।'
          )
      );
      return;
    }

    const phoneCheck = validateIndianMobile(phone);
    if (!phoneCheck.valid) {
      setValidationError(
        phoneCheck.error ||
          t(
            'Please enter a valid 10-digit numeric mobile number.',
            'कृपया मान्य 10-अंकीय मोबाइल नंबर दर्ज करें।',
            'कृपया सही 10 अंक रो मोबाइल नंबर लिखो।'
          )
      );
      return;
    }

    if (!consentChecked) {
      setValidationError(
        t(
          'Please accept the declaration checkbox before submission.',
          'जमा करने से पहले कृपया घोषणा चेकबॉक्स को स्वीकार करें।',
          'अर्जी जमा करण सूं पेहला नीचे री सहमति पर टिक लगावो।'
        )
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        schemeId: scheme.id,
        applicantName: applicantName.trim(),
        samagraMemberId: memCheck.cleaned,
        samagraFamilyId: famCheck.cleaned,
        phone: phoneCheck.cleaned,
        wardOrBlock: wardOrBlock.trim(),
        areaType: profile.areaType,
      });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setValidationError(err.message);
        setErrorDetails(err.details || null);
      } else {
        setValidationError(
          err instanceof Error
            ? err.message
            : t(
                'Application submission failed. Please try again.',
                'आवेदन जमा नहीं हो सका। कृपया पुनः प्रयास करें।',
                'अर्जी जमा नी हो सकी। एक बार फेर कोशिश करो।'
              )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const procedure = getSchemeApplicationProcedure(scheme, currentLanguage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-8 shadow-2xl border border-slate-200 relative max-h-[92vh] overflow-y-auto">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onClose}
          aria-label={t('Close application modal', 'आवेदन विंडो बंद करें', 'अर्जी बॉक्स बंद करो')}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer disabled:opacity-40"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1 pb-4 pr-8 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {scheme.code}
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-snug">
            {getSchemeTitle(scheme, currentLanguage)}
          </h3>
          {currentLanguage === 'en' ? (
            <p className="text-xs font-devanagari text-slate-500 font-bold">
              {scheme.titleHindi}
            </p>
          ) : (
            <p className="text-xs text-slate-500 font-semibold">
              {scheme.title}
            </p>
          )}
        </div>

        {/* Benefits Summary Box */}
        <div className="my-4 p-3.5 sm:p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
          <div>
            <div className="font-bold text-emerald-950">
              {t('Target Financial Entitlement:', 'लक्षित वित्तीय लाभ:', 'मिलण वालो फायदो:')}
            </div>
            <div className="text-emerald-800 mt-0.5">{getSchemeBenefits(scheme, currentLanguage)}</div>
          </div>
          <div className="sm:text-right shrink-0 sm:ml-3">
            <div className="text-base font-black text-emerald-800 font-mono tabular-nums">
              {scheme.financialEntitlement.frequency === 'In-Kind / Service'
                ? t('In-Kind', 'सेवा लाभ', 'सुविधा मदद')
                : `₹${scheme.financialEntitlement.amount.toLocaleString('en-IN')}`}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold">
              {getFrequencyLabel(scheme.financialEntitlement.frequency, currentLanguage)}
            </div>
          </div>
        </div>

        {/* Official Verified Portal & Collapsible Application Procedure */}
        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold text-slate-700">
                {t('Official Portal:', 'आधिकारिक पोर्टल:', 'सरकारी वेबसाइट:')}
              </span>
              <a
                href={procedure.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono font-bold text-amber-700 hover:underline inline-flex items-center gap-1 truncate"
              >
                <span>{procedure.portalHost}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowProcedure(v => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 bg-white border border-slate-300 hover:border-amber-400 px-2.5 py-1 rounded-lg cursor-pointer"
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
              <span>{t('Procedure Steps', 'आवेदन चरण', 'अर्जी चरण')}</span>
              {showProcedure ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
          {showProcedure && (
            <ol className="pt-2 border-t border-slate-200 space-y-1.5 text-[11px] text-slate-700">
              {procedure.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {validationError && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold">{validationError}</div>
              {errorDetails && <div className="text-[11px] text-rose-700">{errorDetails}</div>}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('Applicant Full Name: *', 'आवेदक का पूरा नाम: *', 'अर्जी देवण वाला रो पूरो नाम: *')}
            </label>
            <input
              type="text"
              value={applicantName}
              onChange={e => setApplicantName(e.target.value)}
              placeholder={t(
                'Enter applicant full name as per Samagra',
                'समग्र के अनुसार पूरा नाम दर्ज करें',
                'समग्र रा हिसाब सूं पूरो नाम लिखो'
              )}
              required
              disabled={isSubmitting}
              className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Mobile Number: *', 'मोबाइल नंबर: *', 'मोबाइल नंबर: *')}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder={t('10-digit mobile number', '10-अंकीय मोबाइल नंबर', '10 अंक रो मोबाइल नंबर')}
                required
                disabled={isSubmitting}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Indore Ward / Janpad: *', 'इंदौर वार्ड / जनपद: *', 'इंदौर वार्ड / जनपद: *')}
              </label>
              <input
                type="text"
                value={wardOrBlock}
                onChange={e => setWardOrBlock(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full text-xs font-medium rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Samagra Family ID (8-Digit): *', 'समग्र परिवार आईडी (8 अंक): *', 'समग्र कुटुंब नंबर (8 अंक): *')}
              </label>
              <input
                type="text"
                value={samagraFamilyId}
                onChange={e => setSamagraFamilyId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder={t('8-digit Samagra Family ID', '8-अंकीय परिवार आईडी', '8 अंक रो कुटुंब नंबर')}
                required
                disabled={isSubmitting}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('Samagra Member ID (9-Digit): *', 'समग्र सदस्य आईडी (9 अंक): *', 'समग्र सदस्य नंबर (9 अंक): *')}
              </label>
              <input
                type="text"
                value={samagraMemberId}
                onChange={e => setSamagraMemberId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder={t('9-digit Samagra Member ID', '9-अंकीय सदस्य आईडी', '9 अंक रो सदस्य नंबर')}
                required
                disabled={isSubmitting}
                className="w-full text-xs font-mono rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
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
                disabled={isSubmitting}
                className="rounded text-amber-600 focus:ring-amber-500 mt-0.5 w-4 h-4"
              />
              <span>
                {t(
                  'I hereby declare that all provided details and Samagra credentials are true and correct. I authorize the Indore District Administration and IMC to verify my records via DigiLocker.',
                  'मैं घोषणा करता/करती हूँ कि दी गई सभी जानकारी और समग्र विवरण सत्य हैं। मैं इंदौर जिला प्रशासन व नगर निगम को डिजिलॉकर द्वारा रिकॉर्ड सत्यापन की अनुमति देता/देती हूँ।',
                  'म्हूं घोषणा करूं छूं कि ऊपर लिखी सगळी जानकारी अने समग्र नंबर एकदम सही छे। म्हूं इंदौर जिला प्रशासन अने नगर निगम ने डिजिलॉकर सूं कागद जांचण री इजाजत देऊं छूं।'
                )}
              </span>
            </label>
          </div>

          {/* Submission Button */}
          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl bg-slate-100 hover:bg-slate-200 cursor-pointer disabled:opacity-40"
            >
              {t('Cancel', 'रद्द करें', 'रद्द करो')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('Submitting Application...', 'आवेदन जमा हो रहा है...', 'अर्जी जमा हो री छे...')}</span>
                </>
              ) : (
                <>
                  <span>
                    {t(
                      'Submit Application & Generate ARN',
                      'आवेदन जमा करें व पावती (ARN) प्राप्त करें',
                      'अर्जी जमा करो अने पक्की पावती लो'
                    )}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
