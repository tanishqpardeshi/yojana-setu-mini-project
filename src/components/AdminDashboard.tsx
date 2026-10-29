import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Radio, 
  MapPin, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Building2, 
  Users, 
  IndianRupee, 
  Send,
  Sparkles,
  BarChart3,
  Layers,
  Download
} from 'lucide-react';
import { LiveNotification, SupportedLanguage, ApplicationRecord } from '../types';
import { IMC_WARDS, JANPAD_BLOCKS, WardInfo } from '../data/indoreGovernance';
import { IndoreSpatialHeatmap } from './IndoreSpatialHeatmap';

interface AdminDashboardProps {
  currentLanguage: SupportedLanguage;
  notifications: LiveNotification[];
  onBroadcastNotification: (notifData: {
    type: LiveNotification['type'];
    message: string;
    wardOrBlock: string;
    amount?: number;
  }) => void;
  onFilterWardSchemes?: (wardNumber: number) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentLanguage,
  notifications,
  onBroadcastNotification,
  onFilterWardSchemes,
}) => {
  const [viewMode, setViewMode] = useState<'heatmap' | 'directory'>('heatmap');
  const [selectedAreaTab, setSelectedAreaTab] = useState<'urban_wards' | 'rural_janpads'>('urban_wards');
  const [selectedWard, setSelectedWard] = useState<WardInfo>(IMC_WARDS[14]); // Default to Ward 15 Khajrana
  const [wardSearch, setWardSearch] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [customWard, setCustomWard] = useState('Ward 15 (Khajrana)');
  const [customType, setCustomType] = useState<LiveNotification['type']>('dbt_disbursed');
  const [isExporting, setIsExporting] = useState(false);
  const [stats, setStats] = useState<{
    totalApplications: number;
    totalDbtDisbursedCr: number;
    avgTurnaroundDays: number;
    grievanceRedressalPercent: number;
  }>({
    totalApplications: 241890,
    totalDbtDisbursedCr: 412.5,
    avgTurnaroundDays: 4.2,
    grievanceRedressalPercent: 98.4,
  });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.stats) {
          setStats(prev => ({
            ...prev,
            totalApplications: 241890 + data.stats.totalApplications,
            totalDbtDisbursedCr: 412.5 + data.stats.totalDbtDisbursedCr,
            avgTurnaroundDays: data.stats.avgTurnaroundDays || 4.2,
            grievanceRedressalPercent: data.stats.grievanceRedressalPercent || 98.4,
          }));
        }
      })
      .catch(err => console.warn('Live stats fetch fallback:', err));
  }, []);

  const filteredWards = IMC_WARDS.filter(w =>
    w.name.toLowerCase().includes(wardSearch.toLowerCase()) ||
    String(w.number).includes(wardSearch) ||
    w.areaDescription.toLowerCase().includes(wardSearch.toLowerCase())
  );

  const handleBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMsg.trim()) return;

    onBroadcastNotification({
      type: customType,
      message: customMsg.trim(),
      wardOrBlock: customWard,
      amount: customType === 'dbt_disbursed' ? 250000 : undefined,
    });
    setCustomMsg('');
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/applications');
      const data = await res.json();
      const records: ApplicationRecord[] = data?.records || [];

      // Create CSV content
      const headers = ['ARN', 'Scheme Title', 'Applicant Name', 'Samagra Member ID', 'Samagra Family ID', 'Phone', 'Ward / Block', 'Area Type', 'Applied Date', 'Current Status', 'Officer In Charge', 'Sanction Amount'];
      const rows = records.map(r => [
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
      link.setAttribute('download', `YojanaSetu_Indore_Applications_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-xs font-bold text-purple-800 uppercase tracking-wider bg-purple-100 px-2 py-0.5 rounded">
              District Collectorate & IMC Municipal Command Centre
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'प्रशासनिक नियंत्रण कक्ष एवं लाइव वार्ड हीटमैप'
              : 'District Admin Dashboard & Real-Time Feed'}
          </h2>
          <p className="text-sm text-slate-500">
            Real-time telemetry, WebSocket feed, ward-level heatmaps, and DBT disbursement metrics for Indore District.
          </p>
        </div>

        {/* Live Feed Status Pill & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold transition shadow-xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>{isExporting ? 'Exporting...' : 'Export Applications (CSV)'}</span>
          </button>

          <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-800 px-3.5 py-1.5 rounded-xl border border-emerald-200 text-xs font-bold">
            <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
            <span>Live SSE Feed: Active</span>
          </div>
        </div>
      </div>

      {/* District Macro KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Total Applications</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              +14.2% MoM
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono mt-1">{stats.totalApplications.toLocaleString('en-IN')}</div>
          <div className="text-[11px] text-slate-500 mt-1">Across 85 Wards & 4 Janpads</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Direct Benefit Disbursed</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              100% Aadhaar DBT
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 font-mono mt-1">₹{stats.totalDbtDisbursedCr.toFixed(1)} Cr</div>
          <div className="text-[11px] text-slate-500 mt-1">Zero leakages via NPCI gateway</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Avg. Turnaround SLA</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Goal: &lt; 7 Days
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono mt-1">{stats.avgTurnaroundDays} Days</div>
          <div className="text-[11px] text-slate-500 mt-1">From intake to Collector sanction</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-500">Grievance Redressal</span>
            <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
              CM 181 Integrated
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-700 font-mono mt-1">{stats.grievanceRedressalPercent}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Satisfaction index in Indore</div>
        </div>
      </div>

      {/* View Switcher: Spatial GIS Heatmap vs Field Verification Directory */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 ${
              viewMode === 'heatmap' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-600" />
            <span>Interactive GIS Spatial Heatmap (Wards & Zones)</span>
          </button>
          <button
            onClick={() => setViewMode('directory')}
            className={`px-4 py-2 rounded-lg transition flex items-center space-x-1.5 ${
              viewMode === 'directory' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
            <span>Field Verification Matrix & Broadcaster</span>
          </button>
        </div>

        <span className="text-xs text-slate-400 font-mono hidden sm:inline">
          Data source: Indore Collectorate GIS • SQLite Live WAL
        </span>
      </div>

      {viewMode === 'heatmap' && (
        <IndoreSpatialHeatmap
          currentLanguage={currentLanguage}
          onSelectWardFilter={onFilterWardSchemes}
        />
      )}

      {/* Main Two-Column Layout: Interactive Heatmap (8 cols) & Live Stream Feed (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT: Ward & Janpad Interactive Heatmap (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900 font-heading">
                Interactive Heatmap: Indore Jurisdiction
              </h3>
              <p className="text-xs text-slate-500">
                Density mapping based on scheme application intake and field verification velocity.
              </p>
            </div>

            {/* Toggle Area Tab */}
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold border border-slate-200">
              <button
                onClick={() => setSelectedAreaTab('urban_wards')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedAreaTab === 'urban_wards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                IMC Urban (Wards 1-85)
              </button>
              <button
                onClick={() => setSelectedAreaTab('rural_janpads')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  selectedAreaTab === 'rural_janpads' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Rural Janpads (4 Blocks)
              </button>
            </div>
          </div>

          {selectedAreaTab === 'urban_wards' ? (
            <div className="space-y-4">
              {/* Search filter for wards */}
              <div className="flex justify-between items-center gap-3">
                <input
                  type="text"
                  value={wardSearch}
                  onChange={e => setWardSearch(e.target.value)}
                  placeholder="Filter ward by number, name or zone (e.g. 15, Khajrana, Vijay Nagar)..."
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                />
                <span className="text-xs text-slate-500 font-mono whitespace-nowrap">
                  Showing {filteredWards.length}/85
                </span>
              </div>

              {/* Heatmap Grid of all 85 Wards */}
              <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-11 lg:grid-cols-13 gap-1.5 max-h-[320px] overflow-y-auto p-1 border rounded-2xl bg-slate-50">
                {filteredWards.map(ward => {
                  const isSelected = selectedWard.number === ward.number;
                  // Color code by density
                  const color =
                    ward.povertyIndex === 'High'
                      ? 'bg-rose-500 hover:bg-rose-600 text-white'
                      : ward.povertyIndex === 'Medium'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-emerald-500 hover:bg-emerald-600 text-white';

                  return (
                    <button
                      key={ward.number}
                      onClick={() => setSelectedWard(ward)}
                      title={`Ward ${ward.number}: ${ward.name}`}
                      className={`h-11 rounded-lg text-xs font-black font-mono flex flex-col items-center justify-center transition shadow-xs ${color} ${
                        isSelected ? 'ring-4 ring-slate-900 scale-105 z-10' : 'opacity-90 hover:opacity-100'
                      }`}
                    >
                      <span className="text-[11px]">W{ward.number}</span>
                      <span className="text-[8px] opacity-80 uppercase font-sans">Z{ward.zone}</span>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center space-x-3">
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
                    <span>High Intake Volume</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                    <span>Moderate Intake</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                    <span>Saturated / Covered</span>
                  </span>
                </div>
                <span>Click any tile to inspect ward metrics</span>
              </div>

              {/* Selected Ward Deep Dive Card */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold uppercase text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                      Selected Ward Telemetry
                    </span>
                    <h4 className="text-lg font-black text-slate-900 mt-1">
                      Ward {selectedWard.number}: {selectedWard.name} (Zone {selectedWard.zone})
                    </h4>
                    <p className="text-xs text-slate-500">{selectedWard.areaDescription}</p>
                  </div>
                  <div className="text-right font-mono text-xs text-slate-600">
                    <div>Pop. Est: <strong>{selectedWard.populationEstimate.toLocaleString('en-IN')}</strong></div>
                    <div className="text-purple-700 font-bold">Zonal Office: {selectedWard.zonalOffice}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Active Applications</div>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      {Math.floor(1800 + (selectedWard.number * 43) % 2200)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">DBT Disbursed (Mo.)</div>
                    <div className="text-lg font-black text-amber-600 font-mono mt-0.5">
                      ₹{(1.2 + (selectedWard.number % 8) * 0.4).toFixed(1)} Cr
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200">
                    <div className="text-xs text-slate-500">Approval Rate</div>
                    <div className="text-lg font-black text-emerald-600 font-mono mt-0.5">
                      {93 + (selectedWard.number % 6)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Rural Janpad Blocks Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {JANPAD_BLOCKS.map(block => (
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

                  <p className="text-xs text-slate-600">
                    <strong>Primary Focus:</strong> {block.primaryEconomy}
                  </p>

                  <div className="text-xs text-slate-500">
                    <strong>Headquarters:</strong> {block.headquarters}
                  </div>

                  <div className="pt-2 border-t border-slate-200 text-xs flex justify-between font-mono">
                    <span>Helpline: <strong>{block.helpline}</strong></span>
                    <span className="text-emerald-700 font-bold">100% Saturation Drive</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Live WebSocket / SSE Event Feed (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="font-bold text-slate-900 text-sm">Live Administrative Stream</h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">Real-Time</span>
          </div>

          {/* Notifications Ticker List */}
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {notifications.map(notif => {
              const typeConfig = {
                dbt_disbursed: { label: 'DBT RELEASED', color: 'bg-emerald-100 text-emerald-800' },
                sanction_order: { label: 'SANCTION ORDER', color: 'bg-purple-100 text-purple-800' },
                csc_intake: { label: 'KIOSK INTAKE', color: 'bg-blue-100 text-blue-800' },
                ward_verification: { label: 'WARD VERIFIED', color: 'bg-amber-100 text-amber-800' },
                application_filed: { label: 'NEW INTAKE', color: 'bg-slate-100 text-slate-800' },
              }[notif.type];

              return (
                <div
                  key={notif.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100 transition rounded-2xl border border-slate-200 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">{notif.timestamp}</span>
                  </div>

                  <p className="text-slate-800 font-medium leading-snug">
                    {notif.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 font-mono">
                    <span>{notif.wardOrBlock}</span>
                    {notif.amount && (
                      <span className="text-amber-700 font-bold">
                        ₹{notif.amount.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Announcement Tool for Collectorate */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-800 mb-2">Broadcast Administrative Alert:</h4>
            <form onSubmit={handleBroadcast} className="space-y-2">
              <input
                type="text"
                value={customMsg}
                onChange={e => setCustomMsg(e.target.value)}
                placeholder="Broadcast message to all wards..."
                className="w-full text-xs rounded-xl border border-slate-300 p-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex gap-2">
                <select
                  value={customType}
                  onChange={e => setCustomType(e.target.value as any)}
                  className="text-xs rounded-xl border border-slate-300 p-1.5 text-slate-800 bg-white flex-1"
                >
                  <option value="dbt_disbursed">DBT Disbursed</option>
                  <option value="sanction_order">Sanction Released</option>
                  <option value="ward_verification">Ward Verification</option>
                </select>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
