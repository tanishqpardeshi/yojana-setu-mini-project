import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  RefreshCw,
  AlertCircle,
  Lock,
  Trash2,
  Loader2,
  KeyRound,
  ArrowRight,
} from 'lucide-react';
import { CitizenProfile, DigiLockerDocumentRecord, SupportedLanguage } from '../types';
import { STANDARD_DOCUMENTS } from '../data/indoreGovernance';

interface DigiLockerTrackerViewProps {
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  citizenKey: string | null;
  onSyncDocumentsFromServer: (docs: DigiLockerDocumentRecord[]) => void;
  onNavigateToSamagra: () => void;
}

export const DigiLockerTrackerView: React.FC<DigiLockerTrackerViewProps> = ({
  currentLanguage,
  profile,
  citizenKey,
  onSyncDocumentsFromServer,
  onNavigateToSamagra,
}) => {
  const [fetchingDocId, setFetchingDocId] = useState<string | null>(null);
  const [revokingDocId, setRevokingDocId] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [consentGranted, setConsentGranted] = useState(true);
  const [customDocNumbers, setCustomDocNumbers] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wardOrBlockLabel =
    profile.areaType === 'urban'
      ? `Ward ${profile.wardNumber || 1} (Indore IMC)`
      : `${profile.blockName || 'Indore'} Janpad`;

  const verifiedCount = STANDARD_DOCUMENTS.filter(
    d => profile.verifiedDocuments?.[d.id]?.verified
  ).length;
  const totalDocs = STANDARD_DOCUMENTS.length;
  const percentage = Math.round((verifiedCount / totalDocs) * 100);

  const handleVerifyDocument = async (
    docId: string,
    issuer: string,
    source: 'digilocker' | 'mp_edistrict' | 'manual'
  ) => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!citizenKey) {
      setErrorMessage('Link or register a live Samagra Member ID first so DigiLocker documents can be persisted to your citizen wallet.');
      return;
    }

    if (!consentGranted) {
      setErrorMessage('Please grant Aadhaar / DigiLocker consent before pulling credentials.');
      return;
    }

    setFetchingDocId(docId);
    try {
      const res = await fetch('/api/digilocker/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenKey,
          docId,
          docNumber: customDocNumbers[docId]?.trim() || undefined,
          source,
          issuer,
          wardOrBlock: wardOrBlockLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.documents)) {
        setErrorMessage(data?.error || 'Failed to verify credential in DigiLocker.');
        return;
      }

      onSyncDocumentsFromServer(data.documents);
      setCustomDocNumbers(prev => ({ ...prev, [docId]: '' }));
      setStatusMessage(
        `Verified and persisted ${data.document?.docId?.replace(/_/g, ' ').toUpperCase()} (${data.document?.docNumber}) into live DigiLocker Wallet.`
      );
    } catch {
      setErrorMessage('Unable to reach live DigiLocker verification endpoint.');
    } finally {
      setFetchingDocId(null);
    }
  };

  const handleRevokeDocument = async (docId: string) => {
    if (!citizenKey) return;
    setErrorMessage(null);
    setStatusMessage(null);
    setRevokingDocId(docId);
    try {
      const res = await fetch(
        `/api/digilocker/${encodeURIComponent(citizenKey)}/${encodeURIComponent(docId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data?.documents)) {
        onSyncDocumentsFromServer(data.documents);
        setStatusMessage(`Removed ${docId.replace(/_/g, ' ').toUpperCase()} from live DigiLocker Wallet. Scheme eligibility recalculated.`);
      }
    } catch {
      setErrorMessage('Failed to revoke credential from live DigiLocker Wallet.');
    } finally {
      setRevokingDocId(null);
    }
  };

  const handleBulkSync = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!citizenKey) {
      setErrorMessage('Register or link a live Samagra Member ID before syncing DigiLocker credentials.');
      return;
    }
    if (!consentGranted) {
      setErrorMessage('Please check the DigiLocker e-Sign consent box first.');
      return;
    }

    const unverifiedDigiLockerDocs = STANDARD_DOCUMENTS.filter(
      d => d.isDigiLockerAvailable && !profile.verifiedDocuments?.[d.id]?.verified
    );

    if (unverifiedDigiLockerDocs.length === 0) {
      setStatusMessage('All DigiLocker-enabled credentials are already verified and persisted.');
      return;
    }

    setBulkSyncing(true);
    try {
      const res = await fetch('/api/digilocker/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          citizenKey,
          wardOrBlock: wardOrBlockLabel,
          docItems: unverifiedDigiLockerDocs.map(d => ({
            docId: d.id,
            issuer: d.issuingAuthority,
            source:
              d.id.startsWith('samagra') || d.id === 'khasra_b1' ? 'mp_edistrict' : 'digilocker',
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.documents)) {
        setErrorMessage(data?.error || 'Bulk DigiLocker sync failed.');
        return;
      }

      onSyncDocumentsFromServer(data.documents);
      setStatusMessage(
        `Synced ${unverifiedDigiLockerDocs.length} credentials live from DigiLocker & MP e-District into Citizen Wallet ${citizenKey}.`
      );
    } catch {
      setErrorMessage('Network error during bulk DigiLocker sync.');
    } finally {
      setBulkSyncing(false);
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
              Live DigiLocker Wallet • Persistent SQLite Verification
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'डिजिलॉकर लाइव दस्तावेज़ वॉलेट एवं सत्यापन'
              : currentLanguage === 'malwi'
              ? 'कागजात लॉकर (लाइव डिजिटल वॉलेट)'
              : 'Live DigiLocker Wallet & Document Readiness'}
          </h2>
          <p className="text-sm text-slate-500">
            Verify, persist, or revoke digital certificates bound to your Samagra Member ID. Every change updates scheme eligibility in real time.
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
              <strong>{verifiedCount}</strong> of {totalDocs} credentials verified
            </div>
          </div>
        </div>
      </div>

      {/* Unlinked Citizen Gate */}
      {!citizenKey && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <KeyRound className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-black text-amber-950">
                Link a Live Samagra Member ID to Activate Your DigiLocker Wallet
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                No demo profile is loaded. Register or select a real Samagra Member ID first (or sign in) so your verified certificates persist in the live database.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToSamagra}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
          >
            <span>Open Samagra Family Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Citizen DigiLocker Session Banner */}
      {citizenKey && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-md space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white/10 rounded-2xl border border-white/20 shrink-0">
                <ShieldCheck className="w-8 h-8 text-blue-300" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading flex items-center flex-wrap gap-2">
                  <span>Connected Wallet: {profile.fullName || 'Linked Citizen'}</span>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-mono">
                    ID: {citizenKey}
                  </span>
                </h3>
                <p className="text-xs text-blue-100/80 max-w-2xl mt-1 leading-relaxed">
                  Verified documents are saved directly to SQLite under Citizen ID <strong className="font-mono text-white">{citizenKey}</strong> and broadcast live to the eligibility engine and Indore Collectorate portal.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={bulkSyncing}
              onClick={handleBulkSync}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition whitespace-nowrap cursor-pointer shrink-0"
            >
              {bulkSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Sync All DigiLocker Docs</span>
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs text-blue-100 pt-2 border-t border-white/10 cursor-pointer">
            <input
              type="checkbox"
              checked={consentGranted}
              onChange={e => setConsentGranted(e.target.checked)}
              className="rounded text-amber-500 w-4 h-4"
            />
            <span>
              I grant explicit Aadhaar / DigiLocker consent to fetch and verify issuer-signed documents from UIDAI, MP Samagra (SPR), MP e-District, NPCI, and MP Bhulekh.
            </span>
          </label>
        </div>
      )}

      {/* Alerts */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-emerald-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-700 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Document Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {STANDARD_DOCUMENTS.map(doc => {
          const verifiedRecord = profile.verifiedDocuments?.[doc.id];
          const isVerified = Boolean(verifiedRecord?.verified);
          const isFetching = fetchingDocId === doc.id;
          const isRevoking = revokingDocId === doc.id;
          const preferredSource: 'digilocker' | 'mp_edistrict' | 'manual' =
            doc.id.startsWith('samagra') || doc.id === 'khasra_b1'
              ? 'mp_edistrict'
              : doc.isDigiLockerAvailable
              ? 'digilocker'
              : 'manual';

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
                      <span>Verified Live</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      <span>Not Verified</span>
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-slate-900">{doc.name}</h4>
                <p className="text-xs font-devanagari font-semibold text-slate-500 mt-0.5">
                  {doc.nameHindi}
                </p>

                <div className="mt-3 pt-2 border-t border-slate-100 text-xs space-y-1">
                  <div className="text-slate-500">
                    Issuing Authority: <strong className="text-slate-700">{doc.issuingAuthority}</strong>
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
                      disabled={isRevoking || !citizenKey}
                      onClick={() => handleRevokeDocument(doc.id)}
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
                  <>
                    <input
                      type="text"
                      value={customDocNumbers[doc.id] || ''}
                      onChange={e =>
                        setCustomDocNumbers(prev => ({ ...prev, [doc.id]: e.target.value }))
                      }
                      disabled={!citizenKey}
                      placeholder="Optional certificate / reference no."
                      className="w-full px-2.5 py-1.5 text-[11px] font-mono border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isFetching || !citizenKey}
                      onClick={() => handleVerifyDocument(doc.id, doc.issuingAuthority, preferredSource)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50 ${
                        doc.isDigiLockerAvailable
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-800 hover:bg-slate-900 text-white'
                      }`}
                    >
                      {isFetching ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying with {doc.issuingAuthority}...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>
                            {doc.isDigiLockerAvailable
                              ? 'Fetch & Verify via DigiLocker'
                              : 'Verify & Register Credential'}
                          </span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
