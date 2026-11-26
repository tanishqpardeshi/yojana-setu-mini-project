import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  SupportedLanguage,
} from '../types';
import {
  DigiLockerIssuedDocItem,
  fetchDigiLockerDocs,
  requestDigiLockerConsentToken,
} from '../services/govApiService';
import { pickText } from '../utils/i18n';

interface DigiLockerConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  citizenKey: string;
  citizenName?: string;
  samagraMemberId?: string;
  currentLanguage: SupportedLanguage;
  onAuthorizedSuccess: (result: {
    documents: DigiLockerDocumentRecord[];
    credentials: DigiLockerCredentialRecord[];
    issuedDocs: DigiLockerIssuedDocItem[];
    consentId?: string;
    accessToken: string;
  }) => void;
}

const REQUESTED_SCOPES = [
  {
    id: 'openid',
    title: 'openid',
    desc: 'Verify DigiLocker MeriPehchaan identity subject',
  },
  {
    id: 'profile',
    title: 'profile',
    desc: 'Read verified citizen name, DOB, and demographic match',
  },
  {
    id: 'documents.read',
    title: 'documents.read',
    desc: 'Fetch issuer-signed certificates (Aadhaar, MP Domicile, Income, Khasra/MPBSE, Samagra, Bank DBT)',
  },
];

export const DigiLockerConsentModal: React.FC<DigiLockerConsentModalProps> = ({
  isOpen,
  onClose,
  citizenKey,
  citizenName,
  samagraMemberId,
  currentLanguage,
  onAuthorizedSuccess,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'openid',
    'profile',
    'documents.read',
  ]);
  const [phase, setPhase] = useState<'idle' | 'token' | 'fetching'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setPhase('idle');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleScope = (scopeId: string) => {
    if (phase !== 'idle') return;
    setSelectedScopes(prev =>
      prev.includes(scopeId) ? prev.filter(s => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleAllowConsent = async () => {
    if (phase !== 'idle') return;
    if (!selectedScopes.includes('documents.read')) {
      setErrorMsg('Please keep "documents.read" checked so YojanaSetu can fetch your issued certificates.');
      return;
    }

    setErrorMsg(null);
    setPhase('token');

    try {
      // Step 1: Exchange consent approval for Bearer access_token
      const tokenRes = await requestDigiLockerConsentToken({
        citizenKey,
        memberId: samagraMemberId,
        scopes: selectedScopes,
      });

      if (!tokenRes.ok || !tokenRes.access_token) {
        setErrorMsg(tokenRes.error || 'Could not obtain OAuth 2.0 Bearer access token.');
        setPhase('idle');
        return;
      }

      // Step 2: Fetch issued documents using Bearer access_token
      setPhase('fetching');
      const docsRes = await fetchDigiLockerDocs(tokenRes.access_token);

      if (!docsRes.ok || !docsRes.issuedDocs) {
        setErrorMsg(docsRes.error || 'Could not fetch issued documents from DigiLocker.');
        setPhase('idle');
        return;
      }

      setPhase('idle');
      onAuthorizedSuccess({
        documents: docsRes.documents || [],
        credentials: docsRes.credentials || [],
        issuedDocs: docsRes.issuedDocs,
        consentId: docsRes.consentId || tokenRes.consentId,
        accessToken: tokenRes.access_token,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Network error communicating with DigiLocker Requester API.'
      );
      setPhase('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="digilocker-consent-title"
    >
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Authentic DigiLocker / MeriPehchaan Consent Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-blue-900 to-slate-900 px-6 py-5 text-white flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-white/15 border border-white/20 shrink-0">
              <ShieldCheck className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/30 border border-blue-400/40 text-blue-100">
                  MeriPehchaan OAuth 2.0
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                  Sandbox Consent
                </span>
              </div>
              <h3 id="digilocker-consent-title" className="text-lg font-black tracking-tight mt-1">
                {t(
                  'DigiLocker Document Sharing Consent',
                  'डिजिलॉकर दस्तावेज़ साझाकरण सहमति',
                  'डिजिलॉकर कागजात साझा सहमति'
                )}
              </h3>
              <p className="text-xs text-blue-100/80 mt-0.5">
                {t(
                  'YojanaSetu Indore District Portal is requesting read-only access to your issued certificates.',
                  'योजनासेतु इंदौर जिला पोर्टल आपके जारी किए गए प्रमाण पत्रों को पढ़ने की अनुमति मांग रहा है।',
                  'योजनासेतु इंदौर पोर्टल तमारा सरकारी प्रमाण पत्र जांचण री मंजूरी मांग रयो छे।'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={phase !== 'idle'}
            onClick={onClose}
            className="text-blue-200 hover:text-white p-1 rounded-lg transition cursor-pointer disabled:opacity-40"
            aria-label="Close DigiLocker Consent Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Active Citizen Identity Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 font-semibold">
                {t('Authenticated Citizen Account', 'सत्यापित नागरिक खाता', 'नागरिक खाता')}
              </div>
              <div className="font-bold text-slate-900 truncate mt-0.5">
                {citizenName || t('Citizen of Indore', 'इंदौर नागरिक', 'इंदौर नागरिक')}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[11px] text-slate-500 font-semibold">Citizen / Samagra Key</div>
              <div className="font-mono font-bold text-indigo-700">{samagraMemberId || citizenKey}</div>
            </div>
          </div>

          {/* Requested OAuth Scopes */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                {t('Requested OAuth 2.0 Scopes', 'अनुरोधित OAuth 2.0 स्कोप', 'जरूरी अनुमति (Scopes)')}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                openid profile documents.read
              </span>
            </div>
            <div className="space-y-2">
              {REQUESTED_SCOPES.map(scope => {
                const checked = selectedScopes.includes(scope.id);
                return (
                  <label
                    key={scope.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                      checked
                        ? 'bg-blue-50/70 border-blue-200'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={phase !== 'idle'}
                      onChange={() => toggleScope(scope.id)}
                      className="mt-0.5 rounded text-blue-600 w-4 h-4"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-bold text-slate-900">{scope.title}</div>
                      <div className="text-[11px] text-slate-600 leading-relaxed">{scope.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live 2-Step OAuth Progress */}
          {phase !== 'idle' && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-indigo-950">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                <span>
                  {phase === 'token'
                    ? 'Step 1/2: Exchanging consent for OAuth 2.0 Bearer access_token (/api/gov/digilocker/token)...'
                    : 'Step 2/2: Fetching issuer-signed documents (/api/gov/digilocker/docs)...'}
                </span>
              </div>
              <div className="flex items-center gap-4 pl-6 text-[11px] text-indigo-800">
                <span className="inline-flex items-center gap-1 font-semibold">
                  {phase === 'fetching' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  Bearer Token
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
                  Issued Document URIs
                </span>
              </div>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Revocable anytime in DigiLocker Wallet</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                {t('Deny / Cancel', 'अस्वीकार करें', 'रद्द करो')}
              </button>
              <button
                type="button"
                disabled={phase !== 'idle'}
                onClick={handleAllowConsent}
                data-testid="digilocker-consent-allow-btn"
                className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                {phase !== 'idle' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                <span>
                  {t('Allow & Fetch Documents', 'अनुमति दें और दस्तावेज़ लाएं', 'मंजूरी दो व कागद लावो')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
