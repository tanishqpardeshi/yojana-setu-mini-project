import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Filter,
  Building2,
  Users,
  IndianRupee,
  TrendingUp,
  Search,
  CheckCircle2,
  X,
} from 'lucide-react';
import { IMC_WARDS, WardInfo } from '../data/indoreGovernance';
import { SupportedLanguage, WardLiveMetric } from '../types';

interface IndoreSpatialHeatmapProps {
  currentLanguage: SupportedLanguage;
  wardMetrics: Record<number, WardLiveMetric>;
  onSelectWardFilter?: (wardNumber: number) => void;
}

export const IndoreSpatialHeatmap: React.FC<IndoreSpatialHeatmapProps> = ({
  currentLanguage,
  wardMetrics,
  onSelectWardFilter,
}) => {
  const [selectedZone, setSelectedZone] = useState<number | 'all'>('all');
  const [selectedWard, setSelectedWard] = useState<WardInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [metricView, setMetricView] = useState<'applications' | 'families' | 'dbt'>('applications');

  const zones = useMemo(() => {
    const zoneMap = new Map<number, WardInfo[]>();
    IMC_WARDS.forEach(w => {
      if (!zoneMap.has(w.zone)) zoneMap.set(w.zone, []);
      zoneMap.get(w.zone)!.push(w);
    });
    return Array.from(zoneMap.entries()).sort((a, b) => a[0] - b[0]);
  }, []);

  const enrichedWards = useMemo(() => {
    return IMC_WARDS.map(w => {
      const live = wardMetrics[w.number] || {
        wardNumber: w.number,
        applicationsCount: 0,
        approvedCount: 0,
        dbtDisbursedInr: 0,
        registeredFamiliesCount: 0,
        approvalRatePercent: null,
      };
      return {
        ...w,
        live,
      };
    });
  }, [wardMetrics]);

  const filteredWards = useMemo(() => {
    return enrichedWards.filter(w => {
      const matchesZone = selectedZone === 'all' || w.zone === selectedZone;
      const matchesSearch =
        !searchQuery.trim() ||
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(w.number).includes(searchQuery) ||
        w.areaDescription.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesZone && matchesSearch;
    });
  }, [enrichedWards, selectedZone, searchQuery]);

  const getTileColorClass = (w: typeof enrichedWards[0]) => {
    const val =
      metricView === 'applications'
        ? w.live.applicationsCount
        : metricView === 'families'
        ? w.live.registeredFamiliesCount
        : w.live.dbtDisbursedInr;

    if (val === 0) {
      return 'bg-slate-200 hover:bg-slate-300 text-slate-700 border-slate-300';
    }
    if (metricView === 'applications') {
      if (val >= 5) return 'bg-rose-600 hover:bg-rose-700 text-white border-rose-700';
      if (val >= 2) return 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600';
      return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700';
    }
    if (metricView === 'families') {
      if (val >= 3) return 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700';
      return 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700';
    }
    if (val >= 10000) return 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700';
    return 'bg-teal-600 hover:bg-teal-700 text-white border-teal-700';
  };

  const selectedWardLive = selectedWard
    ? wardMetrics[selectedWard.number] || {
        wardNumber: selectedWard.number,
        applicationsCount: 0,
        approvedCount: 0,
        dbtDisbursedInr: 0,
        registeredFamiliesCount: 0,
        approvalRatePercent: null,
      }
    : null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header Toolbar */}
      <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
            <MapPin className="w-4 h-4" />
            <span>IMC Live Spatial Grid • 19 Zones / 85 Wards</span>
          </div>
          <h3 className="text-xl font-black mt-1 font-heading">
            {currentLanguage === 'hi'
              ? 'इंदौर नगर निगम (IMC) लाइव वार्ड मानचित्र'
              : 'Indore Municipal Corporation (IMC) Live Ward Matrix'}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Every ward tile reflects real-time counts from SQLite applications, DBT approvals, and Samagra registrations.
          </p>
        </div>

        {/* Metric Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
          <button
            type="button"
            onClick={() => setMetricView('applications')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 cursor-pointer ${
              metricView === 'applications' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Applications</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricView('families')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 cursor-pointer ${
              metricView === 'families' ? 'bg-blue-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Samagra Families</span>
          </button>
          <button
            type="button"
            onClick={() => setMetricView('dbt')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1 cursor-pointer ${
              metricView === 'dbt' ? 'bg-emerald-500 text-white shadow-xs' : 'text-slate-300 hover:text-white'
            }`}
          >
            <IndianRupee className="w-3.5 h-3.5" />
            <span>DBT Released</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search Ward 1-85, locality (e.g. Khajrana, Vijay Nagar)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={selectedZone}
            onChange={e => setSelectedZone(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All 19 IMC Zones (85 Wards)</option>
            {zones.map(([zoneNum, wardsList]) => (
              <option key={zoneNum} value={zoneNum}>
                Zone {zoneNum} ({wardsList.length} Wards) — {wardsList[0]?.zonalOffice.split(',')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className={selectedWard ? 'lg:col-span-8' : 'lg:col-span-12'}>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-slate-700">Live Activity Legend:</span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 border border-slate-300 inline-block"></span>
                <span>0 Live Records</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block"></span>
                <span>Active Live Activity</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                <span>High Intake</span>
              </span>
            </div>
            <span className="font-mono font-semibold text-slate-600">
              Showing {filteredWards.length} of 85 Wards
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-9 md:grid-cols-11 lg:grid-cols-13 gap-1.5 p-2 rounded-2xl bg-slate-100 border border-slate-200">
            {filteredWards.map(w => {
              const isSelected = selectedWard?.number === w.number;
              const badgeVal =
                metricView === 'applications'
                  ? `${w.live.applicationsCount} app`
                  : metricView === 'families'
                  ? `${w.live.registeredFamiliesCount} fam`
                  : `₹${w.live.dbtDisbursedInr}`;

              return (
                <button
                  key={w.number}
                  type="button"
                  onClick={() => setSelectedWard(w)}
                  title={`Ward ${w.number}: ${w.name} (Zone ${w.zone}) — ${badgeVal}`}
                  className={`relative h-12 rounded-xl border text-[11px] font-black font-mono flex flex-col items-center justify-center transition-all cursor-pointer ${getTileColorClass(w)} ${
                    isSelected ? 'ring-4 ring-slate-900 scale-105 z-10 shadow-lg' : 'opacity-95 hover:opacity-100'
                  }`}
                >
                  <span className="leading-none">W{w.number}</span>
                  <span className="text-[8px] font-sans opacity-90 mt-0.5 leading-none">
                    {metricView === 'applications'
                      ? w.live.applicationsCount
                      : metricView === 'families'
                      ? w.live.registeredFamiliesCount
                      : w.live.dbtDisbursedInr > 0
                      ? 'DBT'
                      : '0'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Ward Live Inspector */}
        {selectedWard && selectedWardLive && (
          <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-start pb-3 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-black uppercase bg-slate-900 text-amber-400 px-2 py-0.5 rounded font-mono">
                  IMC Ward {selectedWard.number} • Zone {selectedWard.zone}
                </span>
                <h4 className="text-base font-black text-slate-900 mt-1.5 leading-snug">
                  {selectedWard.name}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">{selectedWard.areaDescription}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWard(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Live Applications</div>
                <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                  {selectedWardLive.applicationsCount}
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">DBT Disbursed</div>
                <div className="text-lg font-black text-amber-600 font-mono mt-0.5">
                  ₹{selectedWardLive.dbtDisbursedInr.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Registered Families</div>
                <div className="text-lg font-black text-blue-700 font-mono mt-0.5">
                  {selectedWardLive.registeredFamiliesCount}
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Approval Rate</div>
                <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
                  {selectedWardLive.approvalRatePercent !== null
                    ? `${selectedWardLive.approvalRatePercent}%`
                    : '—'}
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                <span>Nodal Zonal Office</span>
              </div>
              <div className="text-slate-600">{selectedWard.zonalOffice}</div>
            </div>

            {onSelectWardFilter && (
              <button
                type="button"
                onClick={() => onSelectWardFilter(selectedWard.number)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Filter Schemes for Ward {selectedWard.number}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
