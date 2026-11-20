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
  SupportedLanguage,
} from '../types';
import { STANDARD_DOCUMENTS } from '../data/indoreGovernance';
import { parseApiResponse } from '../utils/apiClient';
import { ToastItem } from './ToastContainer';

interface DigiLockerTrackerViewProps {
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  citizenKey: string | null;
  credentials?: DigiLockerCredentialRecord[];
  oauthMeta?: { oauthConfigured: boolean; redirectUri?: string };
  onSyncDocumentsFromServer: (
    docs: DigiLockerDocumentRecord[],
    credentials?: DigiLockerCredentialRecord[]
  ) => void;
  onRefreshWallet?: () => Promise<void>;
  onNavigateToSamagra: () => void;
  onNotify?: (toast: Omit<ToastItem, 'id'>) => void;
}

export const DigiLockerTrackerView: React.FC<DigiLockerTrackerViewProps> = ({
  currentLanguage,
  profile,
  citizenKey,
  credentials = [],
  oauthMeta,
  onSyncDocumentsFromServer,
  onRefreshWallet,
  onNavigateToSamagra,
  onNotify,
}) => {
  const [connectingOAuth, setConnectingOAuth] = useState(false);
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

      const rawExtra = parsed.rawBody as { redirectUri?: string } | null;
      if (rawExtra?.redirectUri) {
        setOauthRedirectUri(rawExtra.redirectUri);
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
              Official DigiLocker OAuth 2.0 + PKCE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'आधिकारिक डिजिलॉकर दस्तावेज़ वॉलेट (OAuth 2.0)'
              : currentLanguage === 'malwi'
              ? 'कागजात लॉकर (डिजिलॉकर OAuth 2.0)'
              : 'Official DigiLocker Document Wallet'}
          </h2>
          <p className="text-sm text-slate-500">
            Authenticate directly via Government of India DigiLocker (MeriPehchaan OAuth 2.0 + PKCE) to fetch and store issuer-signed certificates.
          </p>
        </div>

        {/* Readiness Progress Box */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4 shrink-0">
          <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center font-black text-blue-700 font-mono text-sm">
            {percentage}%
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">Wallet Readiness</div>
            <div className="text-xs text-slate-500">
              <strong>{verifiedCount}</strong> of {totalDocs} scheme docs verified
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
                Link a Samagra Member ID or Sign In to Bind Credentials to Your Citizen Profile
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Linking your 9-digit Samagra Member ID or signing in ensures OAuth-fetched DigiLocker certificates automatically match across schemes.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToSamagra}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <span>Open Samagra Portal</span>
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
                    ? `Wallet: ${profile.fullName || 'Citizen'} (${citizenKey})`
                    : 'DigiLocker Government Gateway'}
                </span>
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono border ${
                    oauthMeta?.oauthConfigured
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                  }`}
                >
                  {oauthMeta?.oauthConfigured ? 'OAuth 2.0 Configured' : 'Credentials Required'}
                </span>
              </h3>
              <p className="text-xs text-blue-100/80 max-w-2xl mt-1 leading-relaxed">
                Uses Authorization Code + PKCE (S256) against DigiLocker MeriPehchaan. Only verified certificates returned by the official DigiLocker issued-documents API are saved.
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
                <span>Refresh</span>
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
                  <span>Authorizing DigiLocker...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect Official DigiLocker (OAuth 2.0 + PKCE)</span>
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
            I grant explicit consent to authenticate with Government of India DigiLocker (MeriPehchaan) and import my issued certificates into YojanaSetu.
          </span>
        </label>
      </div>

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
              Synced DigiLocker Issued Documents ({credentials.length})
            </h3>
            <p className="text-xs text-slate-500">
              Official URIs fetched via DigiLocker OAuth 2.0 and deduplicated per citizen account.
            </p>
          </div>
        </div>

        {credentials.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-700">
              No Official DigiLocker Issued Documents Synced Yet
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click "Connect Official DigiLocker (OAuth 2.0 + PKCE)" above to authenticate with DigiLocker and import your Aadhaar, Caste, Income, Domicile, or Land Record certificates.
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
                      Verified OAuth
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Issuer: <strong className="text-slate-700">{cred.issuer}</strong></span>
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
                  <span>Revoke</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheme Document Readiness Matrix */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-900">
          Scheme Document Readiness Matrix ({verifiedCount}/{totalDocs})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STANDARD_DOCUMENTS.map(doc => {
            const verifiedRecord = profile.verifiedDocuments?.[doc.id];
            const isVerified = Boolean(verifiedRecord?.verified);
            const isRevoking = revokingKey === doc.id;

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
                        <span>Verified via OAuth</span>
                      </span>
                    ) : (
                      <span className="flex items-center space-x-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        <span>Not Synced</span>
                      </span>
                    )}
                  </div>

                  <h4 className="text-base font-bold text-slate-900">{doc.name}</h4>
                  <p className="text-xs font-devanagari font-semibold text-slate-500 mt-0.5">
                    {doc.nameHindi}
                  </p>

                  <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1">
                    <div className="text-slate-500">
                      Issuing Authority:{' '}
                      <strong className="text-slate-700">{doc.issuingAuthority}</strong>
                    </div>

                    {isVerified && verifiedRecord?.docNumber && (
                      <div className="text-slate-600 font-mono text-[11px] bg-slate-100 px-2 py-1 rounded inline-block">
                        Ref: {verifiedRecord.docNumber}
                      </div>
                    )}

                    {isVerified && verifiedRecord?.verifiedAt && (
                      <div className="text-[10px] text-emerald-700">
                        Synced: {new Date(verifiedRecord.verifiedAt).toLocaleString('en-IN')}
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
                        <span>Source: {verifiedRecord.source.toUpperCase()}</span>
                      </span>
                      <button
                        type="button"
                        disabled={isRevoking}
                        onClick={() => handleRevokeDocument(doc.id, doc.name)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-800 inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        {isRevoking ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3 h-3" />
                        )}
                        <span>Revoke</span>
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
                      <span>Sync via Official DigiLocker</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
