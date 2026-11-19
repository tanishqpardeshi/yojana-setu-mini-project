import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle,
  Clock,
  Printer,
  FileText,
  MapPin,
  QrCode,
  ShieldCheck,
  Download,
  Copy,
  Check,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { ApplicationRecord, SupportedLanguage } from '../types';

interface ApplicationTrackerViewProps {
  currentLanguage: SupportedLanguage;
  applications: ApplicationRecord[];
  onNavigateToSchemes?: () => void;
}

export const ApplicationTrackerView: React.FC<ApplicationTrackerViewProps> = ({
  currentLanguage,
  applications,
  onNavigateToSchemes,
}) => {
  const [searchArn, setSearchArn] = useState(applications[0]?.arn || '');
  const [selectedRecord, setSelectedRecord] = useState<ApplicationRecord | null>(
    applications[0] || null
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Keep selectedRecord synchronized in real time when applications update via SSE / Admin actions
  useEffect(() => {
    if (applications.length === 0) {
      return;
    }
    if (!selectedRecord) {
      setSelectedRecord(applications[0]);
      setSearchArn(applications[0].arn);
      return;
    }
    const updatedMatch = applications.find(a => a.arn === selectedRecord.arn);
    if (updatedMatch) {
      setSelectedRecord(updatedMatch);
    }
  }, [applications, selectedRecord]);

  // Check URL query parameters for ?verifyARN= or ?arn=
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const targetArn = (params.get('verifyARN') || params.get('arn'))?.trim().toUpperCase();
    if (targetArn) {
      setSearchArn(targetArn);
      const match = applications.find(a => a.arn.toUpperCase() === targetArn);
      if (match) {
        setSelectedRecord(match);
      } else {
        fetch(`/api/applications/${encodeURIComponent(targetArn)}`)
          .then(r => (r.ok ? r.json() : null))
          .then(data => {
            if (data?.record) {
              setSelectedRecord(data.record);
            }
          })
          .catch(() => {});
      }
    }
  }, [applications]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    const cleaned = searchArn.trim().toUpperCase();
    if (!cleaned) {
      setSearchError('Enter an Application Reference Number (ARN) to track status.');
      return;
    }

    const found = applications.find(a => a.arn.toUpperCase() === cleaned);
    if (found) {
      setSelectedRecord(found);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(cleaned)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.record) {
          setSelectedRecord(data.record);
          return;
        }
      }
      setSearchError(
        `ARN "${cleaned}" was not found in Indore District live records. Submit an application under Schemes & Eligibility to generate a live ARN.`
      );
    } catch {
      setSearchError('Unable to reach live ARN tracking service.');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verificationUrl = selectedRecord
    ? `${origin}/?verifyARN=${encodeURIComponent(selectedRecord.arn)}`
    : '';

  const handleCopyLink = () => {
    if (!verificationUrl) return;
    navigator.clipboard?.writeText(verificationUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const statusMeta = selectedRecord
    ? {
        submitted: { label: 'Intake Registered', color: 'bg-blue-100 text-blue-800 border-blue-300' },
        ward_verification: { label: 'Ward Verification In-Progress', color: 'bg-amber-100 text-amber-800 border-amber-300' },
        collectorate_scrutiny: { label: 'Collectorate Scrutiny', color: 'bg-purple-100 text-purple-800 border-purple-300' },
        sanction_issued: { label: 'Sanction Order Released', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
        dbt_disbursed: { label: 'DBT Amount Transferred', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
        rejected: { label: 'Application Returned / Rejected', color: 'bg-rose-100 text-rose-800 border-rose-300' },
      }[selectedRecord.currentStatus]
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Title */}
      <div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2 py-0.5 rounded">
            Live Application Tracking & Citizen Receipt
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
          {currentLanguage === 'hi'
            ? 'आवेदन स्थिति ट्रैकर एवं पावती रसीद'
            : currentLanguage === 'malwi'
            ? 'आवेदन खोज व पक्की पावती'
            : 'Application Reference Tracker & Citizen Receipt'}
        </h2>
        <p className="text-sm text-slate-500">
          Track real-time stage-by-stage status of your live scheme submissions in Indore District as Admin officers review and disburse benefits.
        </p>
      </div>

      {/* Search Bar & Live Applications Picker */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 no-print">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-amber-600" />
            </div>
            <input
              type="text"
              value={searchArn}
              onChange={e => setSearchArn(e.target.value)}
              placeholder="Enter live Application Reference Number (e.g. YS-IND-2026-XXXXX)..."
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-900 uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSearching && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Track Status</span>
          </button>
        </form>

        {searchError && (
          <div className="text-xs text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
            {searchError}
          </div>
        )}

        {/* Live Submitted Applications */}
        <div className="pt-2 border-t border-slate-100 flex items-center flex-wrap gap-2 text-xs">
          <span className="text-slate-500 font-semibold">
            Live Submitted Applications ({applications.length}):
          </span>
          {applications.length === 0 ? (
            <span className="text-slate-400">None submitted yet in this live database.</span>
          ) : (
            applications.slice(0, 6).map(app => (
              <button
                key={app.arn}
                type="button"
                onClick={() => {
                  setSelectedRecord(app);
                  setSearchArn(app.arn);
                  setSearchError(null);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-mono font-bold border transition cursor-pointer ${
                  selectedRecord?.arn === app.arn
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {app.arn} ({app.applicantName})
              </button>
            ))
          )}
        </div>
      </div>

      {/* Clean Empty State */}
      {!selectedRecord && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-300 p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <FileText className="w-7 h-7" />
          </div>
          <div className="max-w-lg mx-auto space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">No Live Applications Tracked Yet</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Pre-loaded demo receipts have been removed. Register your Samagra profile, check eligibility for any Indore or MP scheme, and submit an online application to receive a real ARN and live Admin tracking timeline.
            </p>
          </div>
          {onNavigateToSchemes && (
            <button
              type="button"
              onClick={onNavigateToSchemes}
              className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Discover Schemes & Apply</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Tracker Container */}
      {selectedRecord && statusMeta && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT: Graphical Timeline Stepper (6 cols) */}
          <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6 no-print">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 gap-3">
              <div>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${statusMeta.color}`}>
                  {statusMeta.label}
                </span>
                <h3 className="text-lg font-black text-slate-900 mt-2 font-mono">
                  ARN: {selectedRecord.arn}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scheme: <strong className="text-slate-800">{selectedRecord.schemeTitle}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1 border border-slate-200 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 border border-slate-300 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="space-y-6 relative pl-6 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {selectedRecord.timeline.map((step, idx) => {
                const isCompleted = step.status === 'completed';
                const isInProgress = step.status === 'in_progress';

                return (
                  <div key={idx} className="relative">
                    <div
                      className={`absolute -left-6 top-0 w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : isInProgress
                          ? 'bg-amber-500 border-amber-500 text-white animate-pulse'
                          : 'bg-white border-slate-300 text-slate-300'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : isInProgress ? (
                        <Clock className="w-3 h-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{step.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{step.date}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-devanagari font-medium">
                        {step.titleHindi}
                      </div>

                      <div className="text-xs text-slate-600 flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{step.location}</span>
                      </div>

                      {step.remarks && (
                        <div className="text-[11px] text-amber-900 bg-amber-50 p-1.5 rounded border border-amber-200/60 mt-1">
                          <strong>Official Note:</strong> {step.remarks}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div>
                <strong>Nodal Officer Assigned:</strong> {selectedRecord.officerInCharge}
              </div>
              <div>
                <strong>Jurisdiction:</strong> {selectedRecord.wardOrBlock}
              </div>
            </div>
          </div>

          {/* RIGHT: Printable Citizen Acknowledgment (पावती) (6 cols) */}
          <div className="lg:col-span-6">
            <div
              id="printable-receipt"
              className="bg-white rounded-3xl border-2 border-slate-800 p-6 sm:p-8 shadow-md relative space-y-6"
            >
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="text-xs font-black uppercase tracking-widest text-slate-900">
                    Government of Madhya Pradesh
                  </div>
                  <h4 className="text-xl font-black text-slate-900 font-heading">
                    Collectorate Indore & IMC
                  </h4>
                  <p className="text-xs font-medium text-slate-600 font-devanagari">
                    शासकीय योजना नागरिक पावती रसीद (Citizen Acknowledgment)
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-lg border-2 border-slate-800 flex items-center justify-center p-1">
                    <QrCode className="w-12 h-12 text-slate-900" />
                  </div>
                  <div className="text-[9px] font-mono mt-0.5 text-slate-600">ARN Verified</div>
                </div>
              </div>

              <div className="bg-slate-100 p-3 rounded-xl border border-slate-300 flex justify-between items-center font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Application Reference No.</div>
                  <div className="text-base font-black text-slate-900 tracking-wider">
                    {selectedRecord.arn}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase font-sans">Submission Date</div>
                  <div className="text-xs font-bold text-slate-800">{selectedRecord.appliedDate}</div>
                </div>
              </div>

              <div className="border border-slate-300 rounded-xl overflow-hidden text-xs">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold bg-slate-50 w-1/3 text-slate-700">Applicant Name</td>
                      <td className="p-2.5 text-slate-900 font-semibold">{selectedRecord.applicantName}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold bg-slate-50 text-slate-700">Scheme Applied</td>
                      <td className="p-2.5 text-slate-900 font-bold">{selectedRecord.schemeTitle}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold bg-slate-50 text-slate-700">Samagra IDs</td>
                      <td className="p-2.5 font-mono text-slate-800">
                        Family: {selectedRecord.samagraFamilyId} | Member: {selectedRecord.samagraMemberId}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold bg-slate-50 text-slate-700">Jurisdiction Area</td>
                      <td className="p-2.5 text-slate-800">{selectedRecord.wardOrBlock}</td>
                    </tr>
                    <tr className="border-b border-slate-200">
                      <td className="p-2.5 font-bold bg-slate-50 text-slate-700">Current Status</td>
                      <td className="p-2.5 font-bold text-emerald-700 uppercase">
                        {selectedRecord.currentStatus.replace(/_/g, ' ')}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold bg-slate-50 text-slate-700">Sanctioned Amount</td>
                      <td className="p-2.5 font-mono font-black text-amber-700 text-sm">
                        {selectedRecord.sanctionAmount
                          ? `₹${selectedRecord.sanctionAmount.toLocaleString('en-IN')}`
                          : 'In-Kind / Service Benefit'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pt-4 border-t-2 border-slate-800 flex justify-between items-end text-xs">
                <div className="space-y-1">
                  <div className="inline-flex items-center space-x-1 text-emerald-800 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Live Database Record</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Authority: Directorate of Public Welfare, District Indore (M.P.)
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Ref: MP-IND-{selectedRecord.arn.slice(-5)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="w-24 h-12 border border-dashed border-slate-300 rounded flex items-center justify-center text-[10px] text-slate-400 font-serif italic mb-1 ml-auto">
                    [Official Seal]
                  </div>
                  <div className="font-bold text-slate-900">{selectedRecord.officerInCharge}</div>
                  <div className="text-[10px] text-slate-500">Nodal Verification Officer</div>
                </div>
              </div>

              <div className="pt-2 no-print flex justify-end">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Save Receipt as PDF / Print</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
