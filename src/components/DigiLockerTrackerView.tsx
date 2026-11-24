import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  Lock,
  Trash2,
  Loader2,
  KeyRound,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  CitizenProfile,
  DigiLockerCredentialRecord,
  DigiLockerDocumentRecord,
  Scheme,
  SupportedLanguage,
} from '../types';
import { STANDARD_DOCUMENTS } from '../data/indoreGovernance';
import { parseApiResponse } from '../utils/apiClient';
import { USE_MOCK_API } from '../services/govApiService';
import { rankSchemesForCitizen } from '../utils/rulesEngine';
import { DigiLockerConsentModal } from './DigiLockerConsentModal';
import { ToastItem } from './ToastContainer';
import { getDocumentLabel, pickText } from '../utils/i18n';

interface DigiLockerTrackerViewProps {
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  schemes?: Scheme[];
  citizenKey: string | null;
  credentials?: DigiLockerCredentialRecord[];
  oauthMeta?: { oauthConfigured: boolean; redirectUri?: string };
  onSyncDocumentsFromServer: (
    docs: DigiLockerDocumentRecord[],
    credentials?: DigiLockerCredentialRecord[]
  ) => void;
  onRefreshWallet?: () => Promise<void>;
  onNavigateToSamagra: () => void;
  onNavigateToSchemes?: () => void;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

export const DigiLockerTrackerView: React.FC<DigiLockerTrackerViewProps> = ({
  currentLanguage,
  profile,
  schemes = [],
  citizenKey,
  credentials = [],
  oauthMeta,
  onSyncDocumentsFromServer,
  onRefreshWallet,
  onNavigateToSamagra,
  onNavigateToSchemes,
  onNotify,
}) => {
  const t = (en: string, hi: string, malwi: string) =>
    pickText(currentLanguage, { en, hi, malwi });

  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [eligibilityUpgradeBanner, setEligibilityUpgradeBanner] = useState<{
    beforeEligible: number;
    afterEligible: number;
    upgradedCount: number;
    consentId?: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [consentGranted, setConsentGranted] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [oauthRedirectUri, setOauthRedirectUri] = useState<string | null>(
    oauthMeta?.redirectUri || null
  );
  const [copiedCallback, setCopiedCallback] = useState(false);

  const effectiveCitizenKey = citizenKey || 'citizen_oauth';

  useEffect(() => {
    if (oauthMeta?.redirectUri) {
      setOauthRedirectUri(oauthMeta.redirectUri);
    }
  }, [oauthMeta?.redirectUri]);

  // Listen for OAuth 2.0 + PKCE popup completion from /api/auth/digilocker/callback
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      const isAllowedOrigin =
        origin === window.location.origin ||
        origin.endsWith('.run.app') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1');
      if (!isAllowedOrigin || !event.data || typeof event.data !== 'object') return;

      const payload = event.data as {
        type?: string;
        count?: number;
        error?: string;
        details?: string;
        redirectUri?: string;
        credentials?: DigiLockerCredentialRecord[];
      };

      if (payload.type === 'DIGILOCKER_OAUTH_SUCCESS') {
        setConnectingOAuth(false);
        setErrorMessage(null);
        setErrorDetails(null);
        const syncedCount = Number(payload.count || 0);
        const okMsg = `Synced ${syncedCount} official issued document${syncedCount === 1 ? '' : 's'} from DigiLocker OAuth 2.0.`;
        setStatusMessage(okMsg);
        onNotify?.({
          type: 'success',
          title: 'DigiLocker Connected',
          message: okMsg,
        });
        void onRefreshWallet?.();
      } else if (payload.type === 'DIGILOCKER_OAUTH_ERROR') {
        setConnectingOAuth(false);
        const errMsg = payload.error || 'Official DigiLocker authorization could not complete.';
        setErrorMessage(errMsg);
        setErrorDetails(payload.details || null);
        if (payload.redirectUri) setOauthRedirectUri(payload.redirectUri);
        onNotify?.({
          type: 'error',
          title: 'DigiLocker OAuth Error',
          message: errMsg,
          details: payload.details,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNotify, onRefreshWallet]);

  const verifiedCount = STANDARD_DOCUMENTS.filter(
    d => profile.verifiedDocuments?.[d.id]?.verified
  ).length;
  const totalDocs = STANDARD_DOCUMENTS.length;
  const percentage = Math.round((verifiedCount / totalDocs) * 100);

  const handleConnectDigiLockerOAuth = async () => {
    if (connectingOAuth) return;
    setErrorMessage(null);
    setErrorDetails(null);
    setStatusMessage(null);

    if (!consentGranted) {
      const msg =
        'Please grant explicit Aadhaar / DigiLocker OAuth 2.0 consent before initiating authorization.';
      setErrorMessage(msg);
      onNotify?.({ type: 'warning', title: 'Consent Required', message: msg });
      return;
    }

    if (USE_MOCK_API) {
      setIsConsentModalOpen(true);
      return;
    }

    setConnectingOAuth(true);
    try {
      const res = await fetch(
        `/api/auth/digilocker/login?mode=json&citizenKey=${encodeURIComponent(effectiveCitizenKey)}`
      );
      const parsed = await parseApiResponse<{
        url?: string;
        redirectUri?: string;
        state?: string;
      }>(res);

      if (parsed.data?.redirectUri) {
        setOauthRedirectUri(parsed.data.redirectUri);
      }

      if (!parsed.ok || !parsed.data?.url) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Could not initialize DigiLocker OAuth 2.0 login.',
        };
        setErrorMessage(errInfo.error);
        setErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title:
            parsed.status === 503
              ? 'DigiLocker OAuth Credentials Missing'
              : 'DigiLocker OAuth Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        setConnectingOAuth(false);
        return;
      }

      if (parsed.data.redirectUri) {
        setOauthRedirectUri(parsed.data.redirectUri);
      }

      const popup = window.open(parsed.data.url, 'digilocker_oauth', 'width=640,height=740');
      if (!popup) {
        setConnectingOAuth(false);
        const blockedMsg =
          'Browser blocked the DigiLocker OAuth popup window. Please allow popups for this site and click "Connect Official DigiLocker" again.';
        setErrorMessage(blockedMsg);
        onNotify?.({
          type: 'warning',
          title: 'Popup Blocked',
          message: blockedMsg,
        });
        return;
      }

      // If the user manually closes the popup without finishing, stop spinner cleanly
      const pollTimer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollTimer);
          setConnectingOAuth(false);
        }
      }, 600);
    } catch (err) {
      setConnectingOAuth(false);
      const msg = 'Network error contacting DigiLocker OAuth endpoint.';
      setErrorMessage(msg);
      setErrorDetails(err instanceof Error ? err.message : null);
      onNotify?.({
        type: 'error',
        title: 'Network Error',
        message: msg,
      });
    }
  };

  const handleRefresh = async () => {
    if (refreshing || !onRefreshWallet) return;
    setRefreshing(true);
    try {
      await onRefreshWallet();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRevokeDocument = async (keyToRevoke: string, label: string) => {
    if (!effectiveCitizenKey || revokingKey) return;
    setErrorMessage(null);
    setErrorDetails(null);
    setStatusMessage(null);
    setRevokingKey(keyToRevoke);
    try {
      const res = await fetch(
        `/api/digilocker/${encodeURIComponent(effectiveCitizenKey)}/${encodeURIComponent(keyToRevoke)}`,
        { method: 'DELETE' }
      );
      const parsed = await parseApiResponse<{
        documents?: DigiLockerDocumentRecord[];
        credentials?: DigiLockerCredentialRecord[];
      }>(res);
      if (!parsed.ok || !Array.isArray(parsed.data?.documents)) {
        const errInfo = parsed.errorInfo || {
          status: parsed.status,
          error: 'Failed to revoke credential from DigiLocker Wallet.',
        };
        setErrorMessage(errInfo.error);
        setErrorDetails(errInfo.details || null);
        onNotify?.({
          type: 'error',
          title: 'Revoke Failed',
          message: errInfo.error,
          details: errInfo.details,
        });
        return;
      }
      onSyncDocumentsFromServer(parsed.data.documents, parsed.data.credentials);
      const okMsg = `Removed ${label} from DigiLocker Wallet. Scheme eligibility updated.`;
      setStatusMessage(okMsg);
      onNotify?.({ type: 'info', title: 'Credential Revoked', message: okMsg });
    } catch (err) {
      const msg = 'Network error while revoking credential from DigiLocker Wallet.';
      setErrorMessage(msg);
      onNotify?.({
        type: 'error',
        title: 'Revoke Network Error',
        message: msg,
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setRevokingKey(null);
    }
  };

  const handleCopyCallbackUrl = async () => {
    if (!oauthRedirectUri) return;
    try {
      await navigator.clipboard.writeText(oauthRedirectUri);
      setCopiedCallback(true);
      window.setTimeout(() => setCopiedCallback(false), 2000);
    } catch {
      // clipboard blocked
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span className="text-xs font-bold text-blue-800 uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded">
              {t(
                'Official DigiLocker OAuth 2.0 + PKCE',
                'आधिकारिक डिजिलॉकर OAuth 2.0 + PKCE',
                'सरकारी डिजिलॉकर कागजात वॉलेट (OAuth 2.0)'
              )}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {t(
              'Official DigiLocker Document Wallet',
              'आधिकारिक डिजिलॉकर दस्तावेज़ वॉलेट (OAuth 2.0)',
              'सरकारी कागजात लॉकर (डिजिलॉकर वॉलेट)'
            )}
          </h2>
          <p className="text-sm text-slate-500">
            {t(
              'Authenticate directly via Government of India DigiLocker (MeriPehchaan OAuth 2.0 + PKCE) to fetch and store issuer-signed certificates.',
              'भारत सरकार के डिजिलॉकर (मेरीपहचान OAuth 2.0 + PKCE) से सीधे जुड़ें और सत्यापित प्रमाण पत्र प्राप्त करें।',
              'भारत सरकार रा डिजिलॉकर (मेरीपहचान) सूं सीधा जुड़ो अने तमारा पक्का सरकारी कागद अठे लावो।'
            )}
          </p>
        </div>

        {/* Readiness Progress Box */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center font-black text-blue-700 font-mono text-sm">
            {percentage}%
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {t('Wallet Readiness', 'दस्तावेज़ तैयारी', 'कागजात तैयारी')}
            </div>
            <div className="text-xs text-slate-500">
              <strong>{verifiedCount}</strong>{' '}
              {t(
                `of ${totalDocs} scheme docs verified`,
                `/ ${totalDocs} योजना दस्तावेज़ सत्यापित`,
                `/ ${totalDocs} सरकारी कागद पक्का छे`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Samagra ID Link Reminder when unlinked */}
      {!citizenKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <KeyRound className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-black text-amber-950">
                {t(
                  'Link a Samagra Member ID or Sign In to Bind Credentials to Your Citizen Profile',
                  'अपने दस्तावेजों को नागरिक प्रोफाइल से जोड़ने के लिए समग्र सदस्य आईडी लिंक करें या लॉगिन करें',
                  'तमारा कागद ने अपणा खाता सूं जोड़ण खातर समग्र सदस्य नंबर जोड़ो या लॉगिन करो'
                )}
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                {t(
                  'Linking your 9-digit Samagra Member ID or signing in ensures OAuth-fetched DigiLocker certificates automatically match across schemes.',
                  '9-अंकीय समग्र सदस्य आईडी लिंक करने पर डिजिलॉकर प्रमाण पत्र सभी योजनाओं में स्वतः मान्य हो जाते हैं।',
                  '9 अंक रो समग्र सदस्य नंबर जोड़ण सूं डिजिलॉकर रा कागद सगळी योजना मां अपने-आप मिल जावे छे।'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToSamagra}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <span>{t('Open Samagra Portal', 'समग्र पोर्टल खोलें', 'समग्र खाता खोलो')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Official DigiLocker OAuth 2.0 + PKCE Connection Card */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-md space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shrink-0">
              <ShieldCheck className="w-8 h-8 text-blue-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-heading flex items-center flex-wrap gap-2">
                <span>
                  {citizenKey
                    ? `${t('Wallet:', 'वॉलेट:', 'लॉकर:')} ${profile.fullName || t('Citizen', 'नागरिक', 'नागरिक')} (${citizenKey})`
                    : t('DigiLocker Government Gateway', 'डिजिलॉकर सरकारी गेटवे', 'डिजिलॉकर सरकारी सेवा')}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono border ${
                    USE_MOCK_API || oauthMeta?.oauthConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                  }`}
                >
                  {USE_MOCK_API
                    ? t('OAuth 2.0 Sandbox Ready', 'OAuth 2.0 सैंडबॉक्स सक्रिय', 'OAuth 2.0 तैयार छे')
                    : oauthMeta?.oauthConfigured
                    ? t('OAuth 2.0 Configured', 'OAuth 2.0 सक्रिय', 'OAuth 2.0 चालू छे')
                    : t('Credentials Required', 'क्रेडेंशियल आवश्यक', 'क्रेडेंशियल जरूरी')}
                </span>
              </h3>
              <p className="text-xs text-blue-100/80 max-w-2xl mt-1 leading-relaxed">
                {t(
                  'Uses Authorization Code + PKCE (S256) against DigiLocker MeriPehchaan. Only verified certificates returned by the official DigiLocker issued-documents API are saved.',
                  'डिजिलॉकर मेरीपहचान के साथ सुरक्षित OAuth 2.0 + PKCE का उपयोग करता है। केवल आधिकारिक रूप से जारी प्रमाण पत्र ही सहेजे जाते हैं।',
                  'डिजिलॉकर मेरीपहचान सूं सुरक्षित जुड़ाव। सिर्फ सरकारी डिजिलॉकर सूं आया पक्का प्रमाण पत्र ही अठे सुरक्षित रखे जावे छे।'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRefreshWallet && (
              <button
                type="button"
                disabled={refreshing}
                onClick={handleRefresh}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{t('Refresh', 'रिफ्रेश', 'ताजा करो')}</span>
              </button>
            )}
            <button
              type="button"
              disabled={connectingOAuth}
              onClick={handleConnectDigiLockerOAuth}
              data-testid="connect-digilocker-oauth-btn"
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition whitespace-nowrap cursor-pointer"
            >
              {connectingOAuth ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('Authorizing DigiLocker...', 'डिजिलॉकर सत्यापन जारी...', 'डिजिलॉकर जुड़ रयो छे...')}</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>
                    {t(
                      'Connect Official DigiLocker (OAuth 2.0 + PKCE)',
                      'आधिकारिक डिजिलॉकर जोड़ें (OAuth 2.0)',
                      'सरकारी डिजिलॉकर जोड़ो'
                    )}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-blue-100 pt-2 border-t border-white/10 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGranted}
            onChange={e => setConsentGranted(e.target.checked)}
            className="rounded text-amber-500 w-4 h-4"
          />
          <span>
            {t(
              'I grant explicit consent to authenticate with Government of India DigiLocker (MeriPehchaan) and import my issued certificates into YojanaSetu.',
              'मैं भारत सरकार के डिजिलॉकर (मेरीपहचान) से सत्यापन करने और अपने प्रमाण पत्र योजनासेतु में लाने की सहमति देता/देती हूँ।',
              'म्हूं भारत सरकार रा डिजिलॉकर सूं अपणा सरकारी कागद योजनासेतु मां लावण री पूरी सहमति देऊं छूं।'
            )}
          </span>
        </label>
      </div>

      {/* Dynamic Eligibility Upgrade Banner after DigiLocker Sync */}
      {eligibilityUpgradeBanner && (
        <div
          role="status"
          data-testid="digilocker-eligibility-upgrade-banner"
          className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-black text-emerald-900">
                {eligibilityUpgradeBanner.upgradedCount > 0
                  ? `${eligibilityUpgradeBanner.upgradedCount} Scheme${eligibilityUpgradeBanner.upgradedCount === 1 ? '' : 's'} Upgraded from Likely (85%) → Eligible (100%)!`
                  : `DigiLocker Wallet Synced — ${eligibilityUpgradeBanner.afterEligible} Scheme${eligibilityUpgradeBanner.afterEligible === 1 ? '' : 's'} at 100% Eligible!`}
              </p>
              <p className="text-emerald-800">
                Verified certificates from DigiLocker have automatically resolved pending document requirements in the Eligibility Rules Engine.
                {eligibilityUpgradeBanner.consentId && (
                  <span className="font-mono ml-1.5 text-[11px] text-emerald-700">
                    ({eligibilityUpgradeBanner.consentId})
                  </span>
                )}
              </p>
            </div>
          </div>
          {onNavigateToSchemes && (
            <button
              type="button"
              onClick={onNavigateToSchemes}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer shrink-0"
            >
              <span>{t('View Eligible (100%) Schemes', 'पात्र (100%) योजनाएं देखें', 'पक्की पात्र योजना देखो')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Inline Status / Error Alerts */}
      {statusMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-700 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          data-testid="digilocker-error-banner"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">{errorMessage}</p>
                {errorDetails && <p className="text-rose-800 leading-relaxed">{errorDetails}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMessage(null);
                setErrorDetails(null);
              }}
              className="text-rose-700 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          {oauthRedirectUri && (
            <div className="pl-6 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-rose-800">
                OAuth Callback URL:
              </span>
              <code className="px-2 py-1 rounded bg-white border border-rose-200 font-mono text-[11px] text-slate-800 break-all">
                {oauthRedirectUri}
              </code>
              <button
                type="button"
                onClick={handleCopyCallbackUrl}
                className="px-2.5 py-1 rounded-lg bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedCallback ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy URL</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Official DigiLocker Issued Credentials Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              {t(
                `Synced DigiLocker Issued Documents (${credentials.length})`,
                `सिंक किए गए डिजिलॉकर दस्तावेज़ (${credentials.length})`,
                `डिजिलॉकर सूं जुड़योड़ा पक्का कागद (${credentials.length})`
              )}
            </h3>
            <p className="text-xs text-slate-500">
              {t(
                'Official URIs fetched via DigiLocker OAuth 2.0 and deduplicated per citizen account.',
                'डिजिलॉकर OAuth 2.0 द्वारा प्राप्त और नागरिक खाते में सुरक्षित किए गए आधिकारिक दस्तावेज़।',
                'डिजिलॉकर सूं लाया गया तमारा असली सरकारी कागद।'
              )}
            </p>
          </div>
        </div>

        {credentials.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">
              {t(
                'No Official DigiLocker Issued Documents Synced Yet',
                'अभी कोई डिजिलॉकर दस्तावेज़ सिंक नहीं हुआ है',
                'अभी कोई डिजिलॉकर कागद जुड़यो नी छे'
              )}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {t(
                'Click "Connect Official DigiLocker (OAuth 2.0 + PKCE)" above to authenticate with DigiLocker and import your Aadhaar, Caste, Income, Domicile, or Land Record certificates.',
                'अपना आधार, जाति, आय, मूल निवासी या खसरा प्रमाण पत्र लाने के लिए ऊपर "आधिकारिक डिजिलॉकर जोड़ें" पर क्लिक करें।',
                'आधार, जाति, कमाई, मूल निवासी या खसरा कागद लावण खातर ऊपर "सरकारी डिजिलॉकर जोड़ो" बटन दबावो।'
              )}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {credentials.map(cred => (
              <div
                key={cred.id}
                className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{cred.docName}</span>
                    {cred.docType && (
                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded">
                        {cred.docType}
                      </span>
                    )}
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      {t('Verified OAuth', 'सत्यापित', 'पक्को कागद')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>
                      {t('Issuer:', 'जारीकर्ता:', 'जारी करण वालो:')}{' '}
                      <strong className="text-slate-700">{cred.issuer}</strong>
                    </span>
                    <span className="font-mono">URI: {cred.docUri}</span>
                    {cred.docNumber && <span className="font-mono">Ref: {cred.docNumber}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={revokingKey === cred.id}
                  onClick={() => handleRevokeDocument(cred.id, cred.docName)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {revokingKey === cred.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>{t('Revoke', 'हटाएं', 'हटावो')}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheme Document Readiness Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-900">
          {t(
            `Scheme Document Readiness Matrix (${verifiedCount}/${totalDocs})`,
            `योजना दस्तावेज़ तैयारी सूची (${verifiedCount}/${totalDocs})`,
            `योजना रा जरूरी कागजात री स्थिति (${verifiedCount}/${totalDocs})`
          )}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STANDARD_DOCUMENTS.map(doc => {
            const verifiedRecord = profile.verifiedDocuments?.[doc.id];
            const isVerified = Boolean(verifiedRecord?.verified);
            const isRevoking = revokingKey === doc.id;
            const localizedDocName = getDocumentLabel(doc.id, currentLanguage);

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition shadow-xs ${
                  isVerified
                    ? 'border-emerald-300 bg-emerald-50/15'
                    : 'border-slate-200 hover:border-blue-300'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={`p-2 rounded-xl border ${
                        isVerified
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    {isVerified ? (
                      <span className="flex items-center space-x-1 text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('Verified via OAuth', 'सत्यापित', 'पक्को कागद')}</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        <span>{t('Not Synced', 'लिंक नहीं', 'अभी बाकी')}</span>
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900">{localizedDocName}</h4>
                  <p className="text-xs font-devanagari font-semibold text-slate-500 mt-0.5">
                    {currentLanguage === 'en' ? doc.nameHindi : doc.name}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1">
                    <div className="text-slate-500">
                      {t('Issuing Authority:', 'जारीकर्ता विभाग:', 'कागद देवण वालो विभाग:')}{' '}
                      <strong className="text-slate-700">{doc.issuingAuthority}</strong>
                    </div>

                    {isVerified && verifiedRecord?.docNumber && (
                      <div className="text-slate-600 font-mono text-[11px] bg-slate-100 px-2 py-1 rounded inline-block">
                        Ref: {verifiedRecord.docNumber}
                      </div>
                    )}

                    {isVerified && verifiedRecord?.verifiedAt && (
                      <div className="text-[10px] text-emerald-700">
                        {t('Synced:', 'सत्यापित समय:', 'जुड़ण रो समय:')}{' '}
                        {new Date(verifiedRecord.verifiedAt).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  {isVerified ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-1">
                        <Lock className="w-3 h-3" />
                        <span>
                          {t('Source:', 'स्रोत:', 'स्रोत:')} {verifiedRecord.source.toUpperCase()}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={isRevoking}
                        onClick={() => handleRevokeDocument(doc.id, localizedDocName)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isRevoking ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>{t('Revoke', 'हटाएं', 'हटावो')}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={connectingOAuth}
                      onClick={handleConnectDigiLockerOAuth}
                      className="w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {connectingOAuth ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {t('Sync via Official DigiLocker', 'डिजिलॉकर से जोड़ें', 'डिजिलॉकर सूं जोड़ो')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive DigiLocker OAuth 2.0 Consent Modal (Mock Sandbox) */}
      <DigiLockerConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        citizenKey={effectiveCitizenKey}
        citizenName={profile.fullName}
        samagraMemberId={profile.samagraMemberId}
        currentLanguage={currentLanguage}
        onAuthorizedSuccess={({ documents, credentials: syncedCreds, issuedDocs, consentId }) => {
          setIsConsentModalOpen(false);
          setErrorMessage(null);
          setErrorDetails(null);

          // Compute live rules-engine upgrade from Likely (85%) -> Eligible (100%)
          const beforeEligible =
            schemes.length > 0
              ? rankSchemesForCitizen(profile, schemes).filter(r => r.status === 'eligible').length
              : 0;
          const nextVerifiedMap = { ...profile.verifiedDocuments };
          for (const d of documents) {
            nextVerifiedMap[d.docId] = {
              verified: Boolean(d.verified),
              source: d.source,
              docNumber: d.docNumber,
              issuer: d.issuer,
              verifiedAt: d.verifiedAt,
            };
          }
          const afterEligible =
            schemes.length > 0
              ? rankSchemesForCitizen(
                  { ...profile, verifiedDocuments: nextVerifiedMap },
                  schemes
                ).filter(r => r.status === 'eligible').length
              : 0;
          const upgradedCount = Math.max(0, afterEligible - beforeEligible);

          onSyncDocumentsFromServer(documents, syncedCreds);
          setEligibilityUpgradeBanner({
            beforeEligible,
            afterEligible,
            upgradedCount,
            consentId,
          });
          const okMsg = `Fetched ${issuedDocs.length} verified documents from DigiLocker OAuth 2.0 (${consentId || 'Bearer Token Verified'}).`;
          setStatusMessage(okMsg);
          onNotify?.({
            type: 'success',
            title:
              upgradedCount > 0
                ? `${upgradedCount} Schemes Upgraded to Eligible (100%)`
                : 'DigiLocker Documents Synced',
            message: okMsg,
          });
        }}
      />
    </div>
  );
};
