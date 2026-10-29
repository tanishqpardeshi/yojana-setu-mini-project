import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileCheck2, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Upload,
  Lock,
  Landmark
} from 'lucide-react';
import { DocumentInfo, CitizenProfile, SupportedLanguage } from '../types';
import { STANDARD_DOCUMENTS } from '../data/indoreGovernance';

interface DigiLockerTrackerViewProps {
  currentLanguage: SupportedLanguage;
  profile: CitizenProfile;
  setProfile: React.Dispatch<React.SetStateAction<CitizenProfile>>;
}

export const DigiLockerTrackerView: React.FC<DigiLockerTrackerViewProps> = ({
  currentLanguage,
  profile,
  setProfile,
}) => {
  const [fetchingDocId, setFetchingDocId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'verified' | 'missing'>('all');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const verifiedCount = STANDARD_DOCUMENTS.filter(
    doc => profile.verifiedDocuments?.[doc.id]?.verified
  ).length;

  const totalCount = STANDARD_DOCUMENTS.length;
  const readinessPercent = Math.round((verifiedCount / totalCount) * 100);

  const handleFetchDigiLocker = (docId: string, docName: string) => {
    setFetchingDocId(docId);
    setTimeout(() => {
      setProfile(prev => ({
        ...prev,
        verifiedDocuments: {
          ...prev.verifiedDocuments,
          [docId]: {
            verified: true,
            source: 'digilocker',
            docNumber: `DL-MP-${Math.floor(1000000 + Math.random() * 9000000)}`,
          },
        },
      }));
      setFetchingDocId(null);
      setSuccessBanner(`Successfully fetched and digitally verified "${docName}" from DigiLocker / MP e-District repository!`);
      setTimeout(() => setSuccessBanner(null), 4000);
    }, 900);
  };

  const handleFetchAllDigiLocker = () => {
    setFetchingDocId('all');
    setTimeout(() => {
      const updatedDocs = { ...profile.verifiedDocuments };
      STANDARD_DOCUMENTS.forEach(doc => {
        if (doc.isDigiLockerAvailable) {
          updatedDocs[doc.id] = {
            verified: true,
            source: 'digilocker',
            docNumber: `DL-MP-${Math.floor(1000000 + Math.random() * 9000000)}`,
          };
        }
      });
      setProfile(prev => ({
        ...prev,
        verifiedDocuments: updatedDocs,
      }));
      setFetchingDocId(null);
      setSuccessBanner('Batch DigiLocker sync complete! All eligible certificates fetched and authenticated.');
      setTimeout(() => setSuccessBanner(null), 4000);
    }, 1200);
  };

  const displayedDocs = STANDARD_DOCUMENTS.filter(doc => {
    const isVerified = profile.verifiedDocuments?.[doc.id]?.verified;
    if (filter === 'verified') return isVerified;
    if (filter === 'missing') return !isVerified;
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
          <span className="text-xs font-bold text-blue-800 uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded">
            National DigiLocker & MP e-District API Gateway
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
          {currentLanguage === 'hi'
            ? 'दस्तावेज चेकलिस्ट एवं डिजिलॉकर ट्रैकर'
            : currentLanguage === 'malwi'
            ? 'कागजात लॉकर व सत्यापन'
            : 'Document Checklist & DigiLocker Wallet Tracker'}
        </h2>
        <p className="text-sm text-slate-500">
          Verify and link government certificates from UIDAI, MP Bhulekh, MP SPR, and RSK Lok Seva Kendras to enable instant 1-click scheme approvals.
        </p>
      </div>

      {successBanner && (
        <div className="p-4 bg-emerald-100 text-emerald-900 rounded-2xl border border-emerald-300 text-xs font-bold flex items-center space-x-2 shadow-xs animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Readiness Overview Card */}
      <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2 text-cyan-300 text-xs font-bold uppercase">
              <ShieldCheck className="w-4 h-4" />
              <span>Digital Vault Authenticity Index</span>
            </div>
            <h3 className="text-2xl font-black font-heading">
              Citizen Document Readiness: {readinessPercent}%
            </h3>
            <p className="text-xs text-slate-300">
              {verifiedCount} of {totalCount} essential welfare certificates are verified. Having verified documents eliminates physical visits to the Indore Collectorate or Ward offices.
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700 mt-2">
              <div
                className="bg-gradient-to-r from-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${readinessPercent}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleFetchAllDigiLocker}
              disabled={fetchingDocId !== null}
              className="px-5 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${fetchingDocId === 'all' ? 'animate-spin' : ''}`} />
              <span>Sync All from DigiLocker</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Documents ({totalCount})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filter === 'verified'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            Verified ({verifiedCount})
          </button>
          <button
            onClick={() => setFilter('missing')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
              filter === 'missing'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            Pending / Missing ({totalCount - verifiedCount})
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden sm:block">
          Official MP e-District Service Level: <strong>3 Days SLA</strong>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedDocs.map(doc => {
          const docState = profile.verifiedDocuments?.[doc.id];
          const isVerified = docState?.verified;
          const isFetching = fetchingDocId === doc.id;

          return (
            <div
              key={doc.id}
              className={`bg-white rounded-2xl border p-5 transition flex flex-col justify-between shadow-xs ${
                isVerified
                  ? 'border-emerald-200 bg-emerald-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {doc.category}
                  </span>

                  {isVerified ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1">
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Action Required</span>
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {doc.name}
                </h4>
                <p className="text-xs font-devanagari text-slate-500 font-bold mt-0.5">
                  {doc.nameHindi}
                </p>

                <div className="mt-3 text-xs text-slate-500 space-y-1">
                  <div><strong>Issuing Authority:</strong> {doc.issuingAuthority}</div>
                  {isVerified && docState.docNumber && (
                    <div className="text-emerald-700 font-mono text-[11px]">
                      <strong>Cert Ref:</strong> {docState.docNumber}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100">
                {isVerified ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                      <Lock className="w-3 h-3" />
                      <span>Linked via {docState.source}</span>
                    </span>
                    <button
                      onClick={() => handleFetchDigiLocker(doc.id, doc.name)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                    >
                      Re-verify
                    </button>
                  </div>
                ) : doc.isDigiLockerAvailable ? (
                  <button
                    onClick={() => handleFetchDigiLocker(doc.id, doc.name)}
                    disabled={isFetching}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                    <span>{isFetching ? 'Verifying with DigiLocker...' : 'Fetch via DigiLocker'}</span>
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500">
                      Physical issuance at IMC Ward / Lok Seva Kendra
                    </div>
                    <button
                      onClick={() => {
                        setProfile(prev => ({
                          ...prev,
                          verifiedDocuments: {
                            ...prev.verifiedDocuments,
                            [doc.id]: { verified: true, source: 'manual', docNumber: `IMC-${Math.floor(1000 + Math.random() * 9000)}` },
                          },
                        }));
                      }}
                      className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>Upload Scanned Copy</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
