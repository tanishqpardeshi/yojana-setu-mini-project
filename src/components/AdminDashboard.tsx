import React, { useState, useMemo } from 'react';
import {
  Radio,
  Send,
  BarChart3,
  Layers,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  RefreshCw,
  Plus,
  Loader2,
  ClipboardList,
  ExternalLink,
  Users,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  LiveNotification,
  SupportedLanguage,
  ApplicationRecord,
  DistrictStats,
  SamagraFamily,
  Scheme,
  SchemesRealtimeReport,
  GovernanceLevel,
} from '../types';
import { IMC_WARDS, JANPAD_BLOCKS, WardInfo } from '../data/indoreGovernance';
import {
  aggregateJanpadLiveMetrics,
  aggregateWardLiveMetrics,
} from '../utils/liveDataEngine';
import { IndoreSpatialHeatmap } from './IndoreSpatialHeatmap';
import { ApiRequestError } from '../utils/apiClient';

interface AdminDashboardProps {
  currentLanguage: SupportedLanguage;
  notifications: LiveNotification[];
  applications: ApplicationRecord[];
  schemes: Scheme[];
  samagraFamilies: SamagraFamily[];
  stats: DistrictStats | null;
  schemesRealtimeReport: SchemesRealtimeReport | null;
  isCheckingRealtime: boolean;
  onRunSchemesRealtimeCheck: () => Promise<void>;
  onUpdateApplicationStatus: (
    arn: string,
    status: ApplicationRecord['currentStatus'],
    remarks?: string
  ) => Promise<void>;
  onCreateLiveScheme: (scheme: Partial<Scheme> & { id: string; title: string }) => Promise<boolean>;
  onBroadcastNotification: (notifData: {
    type: LiveNotification['type'];
    message: string;
    wardOrBlock: string;
    amount?: number;
  }) => Promise<void>;
  onFilterWardSchemes?: (wardNumber: number) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentLanguage,
  notifications,
  applications,
  schemes,
  samagraFamilies,
  stats,
  schemesRealtimeReport,
  isCheckingRealtime,
  onRunSchemesRealtimeCheck,
  onUpdateApplicationStatus,
  onCreateLiveScheme,
  onBroadcastNotification,
  onFilterWardSchemes,
}) => {
  const [adminTab, setAdminTab] = useState<'queue' | 'schemes_realtime' | 'spatial'>('queue');
  const [selectedAreaTab, setSelectedAreaTab] = useState<'urban_wards' | 'rural_janpads'>('urban_wards');
  const [selectedWard, setSelectedWard] = useState<WardInfo>(IMC_WARDS[0]);
  const [wardSearch, setWardSearch] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [customWard, setCustomWard] = useState('Indore Collectorate');
  const [customType, setCustomType] = useState<LiveNotification['type']>('ward_verification');
  const [isExporting, setIsExporting] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [updatingArn, setUpdatingArn] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New Live Scheme Form State
  const [showAddScheme, setShowAddScheme] = useState(false);
  const [newSchemeTitle, setNewSchemeTitle] = useState('');
  const [newSchemeTitleHi, setNewSchemeTitleHi] = useState('');
  const [newSchemeLevel, setNewSchemeLevel] = useState<GovernanceLevel>('district_indore');
  const [newSchemeDepartment, setNewSchemeDepartment] = useState('District Administration Indore');
  const [newSchemeAmount, setNewSchemeAmount] = useState<number>(5000);
  const [newSchemeBenefits, setNewSchemeBenefits] = useState('');
  const [newSchemePortalUrl, setNewSchemePortalUrl] = useState('https://indore.nic.in/');
  const [isSavingScheme, setIsSavingScheme] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<{ message: string; details?: string } | null>(null);

  const wardMetrics = useMemo(
    () => aggregateWardLiveMetrics(applications, samagraFamilies, IMC_WARDS),
    [applications, samagraFamilies]
  );

  const janpadMetrics = useMemo(
    () => aggregateJanpadLiveMetrics(applications, samagraFamilies, JANPAD_BLOCKS),
    [applications, samagraFamilies]
  );

  const filteredWards = IMC_WARDS.filter(
    w =>
      w.name.toLowerCase().includes(wardSearch.toLowerCase()) ||
      String(w.number).includes(wardSearch) ||
      w.areaDescription.toLowerCase().includes(wardSearch.toLowerCase())
  );

  const filteredApplications = useMemo(() => {
    if (statusFilter === 'all') return applications;
    return applications.filter(a => a.currentStatus === statusFilter);
  }, [applications, statusFilter]);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBroadcasting) return;
    setAdminError(null);
    setAdminFeedback(null);

    if (!customMsg.trim()) {
      setAdminError({ message: 'Please enter a non-empty official broadcast message.' });
      return;
    }

    setIsBroadcasting(true);
    try {
      await onBroadcastNotification({
        type: customType,
        message: customMsg.trim(),
        wardOrBlock: customWard.trim() || 'Indore Collectorate',
      });
      setCustomMsg('');
      setAdminFeedback(`Live alert broadcasted to ${customWard.trim() || 'Indore Collectorate'}.`);
    } catch (err) {
      setAdminError({
        message: err instanceof Error ? err.message : 'Failed to broadcast alert.',
        details: err instanceof ApiRequestError ? err.details : undefined,
      });
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleAdvanceStatus = async (
    arn: string,
    nextStatus: ApplicationRecord['currentStatus'],
    remarks: string
  ) => {
    if (updatingArn) return;
    setUpdatingArn(arn);
    setAdminFeedback(null);
    setAdminError(null);
    try {
      await onUpdateApplicationStatus(arn, nextStatus, remarks);
      setAdminFeedback(`Application ${arn} updated live to ${nextStatus.replace(/_/g, ' ').toUpperCase()}.`);
    } catch (err) {
      setAdminError({
        message: err instanceof Error ? err.message : `Failed to update application ${arn}.`,
        details: err instanceof ApiRequestError ? err.details : undefined,
      });
    } finally {
      setUpdatingArn(null);
    }
  };

  const handlePublishLiveScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingScheme) return;
    setAdminError(null);
    setAdminFeedback(null);

    if (!newSchemeTitle.trim()) {
      setAdminError({ message: 'Scheme title (English) is required.' });
      return;
    }
    setIsSavingScheme(true);
    try {
      const slug = `live_${newSchemeTitle
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .slice(0, 32)}_${String(Date.now()).slice(-4)}`;
      const ok = await onCreateLiveScheme({
        id: slug,
        code: `IND-LIVE-${String(Date.now()).slice(-4)}`,
        title: newSchemeTitle.trim(),
        titleHindi: newSchemeTitleHi.trim() || newSchemeTitle.trim(),
        titleMalwi: newSchemeTitleHi.trim() || newSchemeTitle.trim(),
        governanceLevel: newSchemeLevel,
        department: newSchemeDepartment.trim() || 'District Administration Indore',
        nodalOfficeIndore: 'Collectorate Campus, Moti Tabela, Indore',
        helpline: '181 / 0731-2433833',
        targetBeneficiary: 'Eligible Citizens of Indore District',
        description: newSchemeBenefits.trim() || 'Live scheme published by Indore District Administration.',
        descriptionHindi: newSchemeBenefits.trim() || 'इंदौर जिला प्रशासन द्वारा लाइव प्रकाशित योजना।',
        benefits: newSchemeBenefits.trim() || `₹${newSchemeAmount.toLocaleString('en-IN')} direct assistance`,
        benefitsHindi: newSchemeBenefits.trim() || `₹${newSchemeAmount.toLocaleString('en-IN')} प्रत्यक्ष सहायता`,
        financialEntitlement: {
          amount: Number(newSchemeAmount) || 0,
          frequency: 'One-Time',
          description: 'Direct Benefit Transfer via NPCI',
        },
        eligibilityRules: {
          requiresIndoreResident: true,
          requiresMpDomicile: true,
        },
        requiredDocuments: ['samagra_member', 'aadhaar', 'bank_dbt'],
        tags: ['live', 'indore', 'admin'],
        malwiSynonyms: ['इंदौर', 'लाइव योजना'],
        applyUrl: newSchemePortalUrl.trim() || 'https://indore.nic.in/',
        cscAvailable: false,
      });
      if (ok) {
        setAdminFeedback(`Live scheme "${newSchemeTitle.trim()}" published to database & pushed in real time to Citizen Discovery.`);
        setNewSchemeTitle('');
        setNewSchemeTitleHi('');
        setNewSchemeBenefits('');
        setShowAddScheme(false);
      }
    } catch (err) {
      setAdminError({
        message: err instanceof Error ? err.message : 'Failed to publish live scheme.',
        details: err instanceof ApiRequestError ? err.details : undefined,
      });
    } finally {
      setIsSavingScheme(false);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    setAdminError(null);
    try {
      const headers = [
        'ARN',
        'Scheme Title',
        'Applicant Name',
        'Samagra Member ID',
        'Samagra Family ID',
        'Phone',
        'Ward / Block',
        'Area Type',
        'Applied Date',
        'Current Status',
        'Officer In Charge',
        'Sanction Amount',
      ];
      const rows = applications.map(r => [
        `"${r.arn}"`,
        `"${r.schemeTitle.replace(/"/g, '""')}"`,
        `"${r.applicantName.replace(/"/g, '""')}"`,
        `"${r.samagraMemberId}"`,
        `"${r.samagraFamilyId}"`,
        `"${r.phone}"`,
        `"${r.wardOrBlock.replace(/"/g, '""')}"`,
        `"${r.areaType}"`,
        `"${r.appliedDate}"`,
        `"${r.currentStatus}"`,
        `"${r.officerInCharge.replace(/"/g, '""')}"`,
        `"${r.sanctionAmount || 0}"`,
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `YojanaSetu_Indore_Live_Applications_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setAdminError({
        message: 'Failed to export CSV file.',
        details: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const selectedWardLive = wardMetrics[selectedWard.number] || {
    wardNumber: selectedWard.number,
    applicationsCount: 0,
    approvedCount: 0,
    dbtDisbursedInr: 0,
    registeredFamiliesCount: 0,
    approvalRatePercent: null,
  };

  const liveTotalApps = stats?.totalApplications ?? applications.length;
  const liveTotalDbtInr = stats?.totalDbtDisbursedInr ?? 0;
  const liveFamiliesCount = stats?.registeredFamilies ?? samagraFamilies.length;
  const liveMembersCount =
    stats?.registeredMembers ?? samagraFamilies.reduce((sum, f) => sum + f.members.length, 0);
  const liveVerifiedDocsCount = stats?.verifiedDocumentsCount ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider bg-purple-100 px-2 py-0.5 rounded">
              District Collectorate & IMC Admin Control
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'प्रशासनिक नियंत्रण कक्ष (100% लाइव डेटा)'
              : 'District Admin Command Centre (Live Data)'}
          </h2>
          <p className="text-sm text-slate-500">
            Zero demo numbers. All KPIs, citizen application approvals, ward metrics, and scheme catalog checks run live on SQLite & SSE.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting || applications.length === 0}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-xl border border-slate-700 text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExporting ? 'Exporting...' : `Export Live CSV (${applications.length})`}</span>
          </button>

          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl border border-emerald-200 text-xs font-bold">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Live SSE Active</span>
          </div>
        </div>
      </div>

      {adminError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">{adminError.message}</div>
              {adminError.details && (
                <div className="text-[11px] text-rose-700 mt-0.5">{adminError.details}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdminError(null)}
            className="text-rose-700 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {adminFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{adminFeedback}</span>
          </div>
          <button type="button" onClick={() => setAdminFeedback(null)} className="text-emerald-700 font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* 100% Live District KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Live Applications</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {stats?.pendingApplications ?? 0} Pending
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1">
            {liveTotalApps.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Approved / Disbursed: <strong>{stats?.approvedApplications ?? 0}</strong> ({stats?.approvalRatePercent ?? 0}%)
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Live DBT Sanctioned</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Aadhaar NPCI
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono mt-1">
            ₹{liveTotalDbtInr.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Disbursed records: <strong>{stats?.disbursedApplications ?? 0}</strong>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Live Samagra Registry</span>
            <Users className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1">
            {liveFamiliesCount} <span className="text-xs font-semibold text-slate-500">Families</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            <strong>{liveMembersCount}</strong> Samagra members registered
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">DigiLocker Verified Docs</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700 font-mono mt-1">
            {liveVerifiedDocsCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Live Schemes Catalog: <strong>{schemes.length}</strong>
          </div>
        </div>
      </div>

      {/* Admin Workspace Tabs */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 pb-3 gap-3">
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200 gap-1">
          <button
            type="button"
            onClick={() => setAdminTab('queue')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              adminTab === 'queue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-amber-600" />
            <span>Live Applications Queue ({applications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('schemes_realtime')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              adminTab === 'schemes_realtime' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>Schemes Real-Time Check ({schemes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setAdminTab('spatial')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              adminTab === 'spatial' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>Live Ward Heatmap & Broadcast</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LIVE APPLICATIONS QUEUE */}
      {adminTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 font-heading">
                  Live Citizen Applications Approval Queue
                </h3>
                <p className="text-xs text-slate-500">
                  Advance submitted ARNs from Ward Verification to Sanction and DBT Disbursement. Citizen Tracker updates immediately via SSE.
                </p>
              </div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-xs font-bold border border-slate-300 rounded-xl px-3 py-1.5 bg-white text-slate-700"
              >
                <option value="all">All Statuses ({applications.length})</option>
                <option value="submitted">Submitted</option>
                <option value="ward_verification">Ward Verification</option>
                <option value="collectorate_scrutiny">Collectorate Scrutiny</option>
                <option value="sanction_issued">Sanction Issued</option>
                <option value="dbt_disbursed">DBT Disbursed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {filteredApplications.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No Live Applications in Queue</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  When citizens register a Samagra ID, verify DigiLocker docs, and submit scheme applications on the Citizen Portal, their applications arrive here in real time.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredApplications.map(app => {
                  const isUpdating = updatingArn === app.arn;
                  return (
                    <div
                      key={app.arn}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300">
                              {app.arn}
                            </span>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                              {app.currentStatus.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[11px] text-slate-500">{app.appliedDate}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1.5">
                            {app.schemeTitle}
                          </h4>
                          <div className="text-xs text-slate-600 mt-0.5">
                            Applicant: <strong>{app.applicantName}</strong> · Samagra:{' '}
                            <span className="font-mono">{app.samagraMemberId}</span> · {app.wardOrBlock}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Entitlement</div>
                          <div className="text-base font-black font-mono text-emerald-700">
                            ₹{(app.sanctionAmount || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      {/* Real-time Admin Workflow Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                        <button
                          type="button"
                          disabled={isUpdating || app.currentStatus === 'ward_verification'}
                          onClick={() =>
                            handleAdvanceStatus(
                              app.arn,
                              'ward_verification',
                              'Ward / Panchayat field officer verified Samagra & DigiLocker records.'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-amber-50 border border-slate-300 text-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          1. Ward Verified
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating || app.currentStatus === 'collectorate_scrutiny'}
                          onClick={() =>
                            handleAdvanceStatus(
                              app.arn,
                              'collectorate_scrutiny',
                              'Forwarded to Indore Collectorate nodal scrutiny desk.'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white hover:bg-purple-50 border border-slate-300 text-slate-800 disabled:opacity-40 cursor-pointer"
                        >
                          2. Collectorate Scrutiny
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating || app.currentStatus === 'sanction_issued'}
                          onClick={() =>
                            handleAdvanceStatus(
                              app.arn,
                              'sanction_issued',
                              'Sanction Order issued by District Nodal Officer, Indore.'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 cursor-pointer"
                        >
                          3. Issue Sanction
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating || app.currentStatus === 'dbt_disbursed'}
                          onClick={() =>
                            handleAdvanceStatus(
                              app.arn,
                              'dbt_disbursed',
                              'Benefit credited via Aadhaar NPCI Direct Benefit Transfer.'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40 cursor-pointer"
                        >
                          4. Disburse DBT
                        </button>
                        <button
                          type="button"
                          disabled={isUpdating || app.currentStatus === 'rejected'}
                          onClick={() =>
                            handleAdvanceStatus(
                              app.arn,
                              'rejected',
                              'Returned for document correction by verification desk.'
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40 cursor-pointer ml-auto"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Live Real-Time Activity Stream (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <h3 className="font-bold text-slate-900 text-sm">Live Administrative Stream</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 font-semibold">Real Events Only</span>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {notifications.length === 0 ? (
                <div className="p-6 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                  No live events yet. Events appear here instantly when citizens register Samagra IDs, verify DigiLocker docs, submit applications, or when Admin approves them.
                </div>
              ) : (
                notifications.map(notif => {
                  const typeConfigMap: Record<string, { label: string; color: string }> = {
                    dbt_disbursed: { label: 'DBT RELEASED', color: 'bg-emerald-100 text-emerald-800' },
                    sanction_order: { label: 'SANCTION ORDER', color: 'bg-purple-100 text-purple-800' },
                    ward_verification: { label: 'WARD VERIFIED', color: 'bg-amber-100 text-amber-800' },
                    application_filed: { label: 'NEW INTAKE', color: 'bg-blue-100 text-blue-800' },
                    samagra_synced: { label: 'SAMAGRA SYNC', color: 'bg-teal-100 text-teal-800' },
                    digilocker_verified: { label: 'DIGILOCKER', color: 'bg-indigo-100 text-indigo-800' },
                    schemes_synced: { label: 'SCHEMES CHECK', color: 'bg-slate-200 text-slate-800' },
                  };
                  const typeConfig = typeConfigMap[notif.type] || typeConfigMap.application_filed;

                  return (
                    <div
                      key={notif.id}
                      className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{notif.timestamp}</span>
                      </div>
                      <p className="text-slate-800 font-medium leading-snug">{notif.message}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
                        <span>{notif.wardOrBlock}</span>
                        {notif.amount !== undefined && notif.amount > 0 && (
                          <span className="text-amber-700 font-bold">
                            ₹{notif.amount.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2">Broadcast Live Administrative Alert:</h4>
              <form onSubmit={handleBroadcast} className="space-y-2">
                <input
                  type="text"
                  value={customMsg}
                  onChange={e => setCustomMsg(e.target.value)}
                  placeholder="Enter official Indore announcement..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customWard}
                    onChange={e => setCustomWard(e.target.value)}
                    placeholder="Ward / Block"
                    className="w-1/2 text-xs rounded-xl border border-slate-300 p-1.5 text-slate-800"
                  />
                  <select
                    value={customType}
                    onChange={e => setCustomType(e.target.value as LiveNotification['type'])}
                    className="text-xs rounded-xl border border-slate-300 p-1.5 text-slate-800 bg-white flex-1"
                  >
                    <option value="ward_verification">Ward Notice</option>
                    <option value="sanction_order">Sanction Release</option>
                    <option value="dbt_disbursed">DBT Release</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isBroadcasting}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
                >
                  {isBroadcasting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isBroadcasting ? 'Broadcasting...' : 'Broadcast Live Alert'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCHEMES REAL-TIME CHECK & LIVE CATALOG */}
      {adminTab === 'schemes_realtime' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                    Real-Time Schemes Data Audit
                  </span>
                  {schemesRealtimeReport?.lastPortalCheckAt && (
                    <span className="text-[11px] font-mono text-slate-500">
                      Last Portal Check: {new Date(schemesRealtimeReport.lastPortalCheckAt).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-black text-slate-900 mt-1">
                  {schemesRealtimeReport?.verdictLabel || 'Schemes Catalog Status'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
                  {schemesRealtimeReport?.verdictDetail}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isCheckingRealtime}
                  onClick={onRunSchemesRealtimeCheck}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isCheckingRealtime ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{isCheckingRealtime ? 'Probing Official Portals...' : 'Run Live Portal Reachability Check'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddScheme(prev => !prev)}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{showAddScheme ? 'Close Form' : 'Publish Live Scheme'}</span>
                </button>
              </div>
            </div>

            {/* Honest Architecture Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">SQLite Live Catalog</div>
                <div className="text-xl font-black font-mono text-slate-900 mt-0.5">
                  {schemesRealtimeReport?.totalSchemes ?? schemes.length}
                </div>
                <div className="text-[10px] text-emerald-700 font-semibold">Live DB + SSE Push</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Baseline Policy Seed</div>
                <div className="text-xl font-black font-mono text-slate-800 mt-0.5">
                  {schemesRealtimeReport?.baselineSchemesCount ?? schemes.length}
                </div>
                <div className="text-[10px] text-slate-500">Curated MP/Indore rules</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Admin Live Published</div>
                <div className="text-xl font-black font-mono text-amber-700 mt-0.5">
                  {schemesRealtimeReport?.adminLiveSchemesCount ?? 0}
                </div>
                <div className="text-[10px] text-slate-500">Modified / added live</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-[10px] font-bold uppercase text-emerald-800">Portals Reachable</div>
                <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
                  {schemesRealtimeReport?.reachableSchemesCount ?? 0}
                </div>
                <div className="text-[10px] text-emerald-700">Live HTTP verified</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-800">Unchecked / Blocked</div>
                <div className="text-xl font-black font-mono text-amber-700 mt-0.5">
                  {(schemesRealtimeReport?.totalSchemes ?? schemes.length) -
                    (schemesRealtimeReport?.reachableSchemesCount ?? 0)}
                </div>
                <div className="text-[10px] text-amber-800">External govt APIs: None</div>
              </div>
            </div>

            {/* Publish Live Scheme Form */}
            {showAddScheme && (
              <form
                onSubmit={handlePublishLiveScheme}
                className="p-5 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-4"
              >
                <h4 className="text-sm font-black text-slate-900">
                  Publish New Scheme Live to Citizen Discovery (SQLite + SSE Push)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Scheme Title (English) *</label>
                    <input
                      type="text"
                      required
                      value={newSchemeTitle}
                      onChange={e => setNewSchemeTitle(e.target.value)}
                      placeholder="e.g. Indore Solar Rooftop Municipal Bonus"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Scheme Title (Hindi)</label>
                    <input
                      type="text"
                      value={newSchemeTitleHi}
                      onChange={e => setNewSchemeTitleHi(e.target.value)}
                      placeholder="हिंदी शीर्षक"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Governance Level</label>
                    <select
                      value={newSchemeLevel}
                      onChange={e => setNewSchemeLevel(e.target.value as GovernanceLevel)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    >
                      <option value="district_indore">Level 4: Indore Collectorate</option>
                      <option value="urban_imc">Level 5: IMC Urban Wards</option>
                      <option value="rural_janpad">Level 6: Rural Janpad</option>
                      <option value="state_mp">Level 3: MP State</option>
                      <option value="national">Level 2: National</option>
                      <option value="international">Level 1: International</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                    <input
                      type="text"
                      value={newSchemeDepartment}
                      onChange={e => setNewSchemeDepartment(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Benefit Amount (₹)</label>
                    <input
                      type="number"
                      min={0}
                      value={newSchemeAmount}
                      onChange={e => setNewSchemeAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Official Portal URL</label>
                    <input
                      type="url"
                      value={newSchemePortalUrl}
                      onChange={e => setNewSchemePortalUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Benefits Summary</label>
                  <input
                    type="text"
                    value={newSchemeBenefits}
                    onChange={e => setNewSchemeBenefits(e.target.value)}
                    placeholder="Direct benefit summary shown to citizens"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddScheme(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingScheme}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingScheme && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save & Broadcast Live</span>
                  </button>
                </div>
              </form>
            )}

            {/* Official Portals Reachability Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Official Government Scheme Portals ({schemesRealtimeReport?.portals.length ?? 0} Unique Domains)</span>
                <span className="text-[11px] font-normal text-slate-500">
                  Live server-side HTTP HEAD/GET verification
                </span>
              </div>
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 text-xs">
                {(schemesRealtimeReport?.portals || []).map(portal => (
                  <div
                    key={portal.portalUrl}
                    className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <a
                        href={portal.portalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-semibold text-slate-900 hover:text-amber-700 inline-flex items-center gap-1"
                      >
                        <span>{portal.portalUrl}</span>
                        <ExternalLink className="w-3 h-3 text-slate-400" />
                      </a>
                      <div className="text-[11px] text-slate-500">
                        Covers <strong>{portal.schemeCount}</strong> scheme{portal.schemeCount > 1 ? 's' : ''}
                        {portal.checkedAt ? ` · Checked ${new Date(portal.checkedAt).toLocaleTimeString('en-IN')}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {portal.latencyMs !== null && (
                        <span className="text-[11px] font-mono text-slate-500">{portal.latencyMs}ms</span>
                      )}
                      {portal.httpStatus !== null && (
                        <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                          HTTP {portal.httpStatus}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          portal.status === 'reachable'
                            ? 'bg-emerald-100 text-emerald-800'
                            : portal.status === 'unchecked'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {portal.status === 'reachable' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : portal.status === 'unchecked' ? (
                          <AlertCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>{portal.status}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE SPATIAL HEATMAP & WARD/JANPAD MATRIX */}
      {adminTab === 'spatial' && (
        <div className="space-y-8">
          <IndoreSpatialHeatmap
            currentLanguage={currentLanguage}
            wardMetrics={wardMetrics}
            onSelectWardFilter={onFilterWardSchemes}
          />

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 font-heading flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  <span>Live Jurisdiction Directory: Indore IMC & Janpads</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time counts strictly derived from SQLite applications and Samagra households.
                </p>
              </div>

              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setSelectedAreaTab('urban_wards')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    selectedAreaTab === 'urban_wards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  IMC Urban (Wards 1-85)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAreaTab('rural_janpads')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    selectedAreaTab === 'rural_janpads' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Rural Janpads (4 Blocks)
                </button>
              </div>
            </div>

            {selectedAreaTab === 'urban_wards' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-3">
                  <input
                    type="text"
                    value={wardSearch}
                    onChange={e => setWardSearch(e.target.value)}
                    placeholder="Filter ward by number, name or zone..."
                    className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                    {filteredWards.length}/85
                  </span>
                </div>

                <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-11 lg:grid-cols-13 gap-1.5 max-h-[260px] overflow-y-auto p-2 border rounded-2xl bg-slate-50">
                  {filteredWards.map(ward => {
                    const isSelected = selectedWard.number === ward.number;
                    const count = wardMetrics[ward.number]?.applicationsCount || 0;
                    const color =
                      count >= 3
                        ? 'bg-amber-500 text-white'
                        : count > 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300';

                    return (
                      <button
                        key={ward.number}
                        type="button"
                        onClick={() => setSelectedWard(ward)}
                        className={`h-11 rounded-lg text-xs font-black font-mono flex flex-col items-center justify-center transition cursor-pointer ${color} ${
                          isSelected ? 'ring-4 ring-slate-900 scale-105 z-10' : ''
                        }`}
                      >
                        <span className="text-[11px]">W{ward.number}</span>
                        <span className="text-[8px] font-sans">{count} app</span>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="text-lg font-black text-slate-900">
                        Ward {selectedWard.number}: {selectedWard.name} (Zone {selectedWard.zone})
                      </h4>
                      <p className="text-xs text-slate-500">{selectedWard.areaDescription}</p>
                    </div>
                    <div className="text-right font-mono text-xs text-slate-600">
                      <div className="text-purple-700 font-bold">{selectedWard.zonalOffice}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500">Live Applications</div>
                      <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                        {selectedWardLive.applicationsCount}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500">Live DBT Disbursed</div>
                      <div className="text-lg font-black text-amber-600 font-mono mt-0.5">
                        ₹{selectedWardLive.dbtDisbursedInr.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-slate-200">
                      <div className="text-xs text-slate-500">Registered Samagra Families</div>
                      <div className="text-lg font-black text-emerald-600 font-mono mt-0.5">
                        {selectedWardLive.registeredFamiliesCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {JANPAD_BLOCKS.map(block => {
                  const live = janpadMetrics[block.name];
                  return (
                    <div key={block.name} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                            Janpad Panchayat
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-1">{block.name} Block</h4>
                        </div>
                        <span className="text-xs font-mono font-bold bg-white px-2 py-1 rounded border">
                          {block.panchayatCount} Panchayats
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <div className="text-[10px] text-slate-500">Apps</div>
                          <div className="font-mono font-black text-slate-900">{live?.applicationsCount || 0}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <div className="text-[10px] text-slate-500">Families</div>
                          <div className="font-mono font-black text-blue-700">{live?.registeredFamiliesCount || 0}</div>
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                          <div className="text-[10px] text-slate-500">DBT (₹)</div>
                          <div className="font-mono font-black text-emerald-700">
                            {(live?.dbtDisbursedInr || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500">
                        <strong>HQ:</strong> {block.headquarters} · Helpline: <strong className="font-mono">{block.helpline}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
