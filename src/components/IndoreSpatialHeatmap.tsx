import React, { useState } from 'react';
import { 
  MapPin, 
  Layers, 
  TrendingUp, 
  Users, 
  IndianRupee, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  ChevronRight,
  Filter
} from 'lucide-react';
import { IMC_WARDS, WardInfo } from '../data/indoreGovernance';
import { SupportedLanguage } from '../types';

interface IndoreSpatialHeatmapProps {
  currentLanguage: SupportedLanguage;
  onSelectWardFilter?: (wardNumber: number) => void;
}

// Compute deterministic metrics for each ward
export const getWardMetrics = (w: WardInfo) => {
  const baseSaturation = w.povertyIndex === 'High' ? 96 : w.povertyIndex === 'Medium' ? 88 : 82;
  const saturationPercentage = Math.min(99, baseSaturation + (w.number % 4));
  const activeApplications = Math.round(w.populationEstimate * 0.042) + (w.number * 7);
  const dbtDisbursedCr = Number(((activeApplications * 2800) / 10000000 + 1.2).toFixed(1));
  const topSchemes = w.povertyIndex === 'High' 
    ? ['Ladli Behna (₹1,250/m)', 'PMAY-Urban (₹2.5L)', 'Sambal 2.0']
    : w.povertyIndex === 'Medium'
    ? ['Ladli Behna', 'PM SVANidhi (₹10k-50k)', 'Ayushman Bharat (₹5L)']
    : ['IMC Solar Net-Metering', 'Ladli Laxmi 2.0', 'Seekho Kamao'];
  
  return { saturationPercentage, activeApplications, dbtDisbursedCr, topSchemes };
};

export const IndoreSpatialHeatmap: React.FC<IndoreSpatialHeatmapProps> = ({
  currentLanguage,
  onSelectWardFilter,
}) => {
  const [metricMode, setMetricMode] = useState<'saturation' | 'applications' | 'dbt' | 'poverty'>('saturation');
  const [selectedWard, setSelectedWard] = useState<WardInfo>(IMC_WARDS[14]); // Ward 15 Khajrana
  const [selectedZone, setSelectedZone] = useState<number | 'all'>('all');

  // Group wards by IMC 19 Zones
  const zones = Array.from(new Set(IMC_WARDS.map(w => w.zone))).sort((a, b) => a - b);

  const displayedWards = selectedZone === 'all' 
    ? IMC_WARDS 
    : IMC_WARDS.filter(w => w.zone === selectedZone);

  // Helper for color coding based on active metric
  const getHeatmapColor = (ward: WardInfo) => {
    const metrics = getWardMetrics(ward);

    if (metricMode === 'saturation') {
      if (metrics.saturationPercentage >= 95) return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      if (metrics.saturationPercentage >= 88) return 'bg-emerald-400 hover:bg-emerald-500 text-slate-900';
      if (metrics.saturationPercentage >= 80) return 'bg-amber-400 hover:bg-amber-500 text-slate-900';
      return 'bg-orange-400 hover:bg-orange-500 text-slate-900';
    }

    if (metricMode === 'applications') {
      if (metrics.activeApplications >= 1800) return 'bg-indigo-600 hover:bg-indigo-700 text-white';
      if (metrics.activeApplications >= 1200) return 'bg-indigo-400 hover:bg-indigo-500 text-white';
      return 'bg-indigo-200 hover:bg-indigo-300 text-slate-900';
    }

    if (metricMode === 'dbt') {
      if (metrics.dbtDisbursedCr >= 5) return 'bg-amber-600 hover:bg-amber-700 text-white';
      if (metrics.dbtDisbursedCr >= 3.5) return 'bg-amber-400 hover:bg-amber-500 text-slate-900';
      return 'bg-amber-200 hover:bg-amber-300 text-slate-900';
    }

    // Poverty Index
    if (ward.povertyIndex === 'High') return 'bg-rose-500 hover:bg-rose-600 text-white';
    if (ward.povertyIndex === 'Medium') return 'bg-amber-400 hover:bg-amber-500 text-slate-900';
    return 'bg-emerald-400 hover:bg-emerald-500 text-slate-900';
  };

  const selectedMetrics = getWardMetrics(selectedWard);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-6">
      {/* Top Controller Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded">
              GIS Spatial Intelligence
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 font-heading mt-1">
            Indore Municipal Spatial Heatmap (Wards 1–85 & Zones 1–19)
          </h3>
          <p className="text-xs text-slate-500">
            Interactive GIS tile matrix of all municipal wards and Janpads with live entitlement metrics.
          </p>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setMetricMode('saturation')}
            className={`px-3 py-1.5 rounded-lg transition ${
              metricMode === 'saturation' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saturation %
          </button>
          <button
            onClick={() => setMetricMode('applications')}
            className={`px-3 py-1.5 rounded-lg transition ${
              metricMode === 'applications' ? 'bg-white text-indigo-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Applications
          </button>
          <button
            onClick={() => setMetricMode('dbt')}
            className={`px-3 py-1.5 rounded-lg transition ${
              metricMode === 'dbt' ? 'bg-white text-amber-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            DBT (₹ Cr)
          </button>
          <button
            onClick={() => setMetricMode('poverty')}
            className={`px-3 py-1.5 rounded-lg transition ${
              metricMode === 'poverty' ? 'bg-white text-rose-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Poverty Index
          </button>
        </div>
      </div>

      {/* Zone Filter Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
        <span className="font-bold text-slate-400 shrink-0 text-[11px]">Filter Zone:</span>
        <button
          onClick={() => setSelectedZone('all')}
          className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition ${
            selectedZone === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All 85 Wards
        </button>
        {zones.map(z => (
          <button
            key={z}
            onClick={() => setSelectedZone(z)}
            className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition ${
              selectedZone === z ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Zone {z}
          </button>
        ))}
      </div>

      {/* 2-Column Layout: Grid Tiles (Left) & Ward Inspector Detail (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Tile Grid (7 cols) */}
        <div className="lg:col-span-7 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-700">
              Showing {displayedWards.length} Wards (Click any tile to inspect):
            </span>
            <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono">
              <span className="inline-block w-2.5 h-2.5 rounded bg-emerald-500"></span> High Saturation
              <span className="inline-block w-2.5 h-2.5 rounded bg-amber-400 ml-1"></span> Moderate
              <span className="inline-block w-2.5 h-2.5 rounded bg-rose-400 ml-1"></span> Action Needed
            </div>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-1.5 max-h-[360px] overflow-y-auto p-1">
            {displayedWards.map(w => {
              const isSelected = selectedWard.number === w.number;
              const colorClass = getHeatmapColor(w);
              const m = getWardMetrics(w);

              return (
                <button
                  key={w.number}
                  onClick={() => setSelectedWard(w)}
                  title={`Ward ${w.number}: ${w.name} (${m.saturationPercentage}% saturated)`}
                  className={`h-11 rounded-xl flex flex-col items-center justify-center font-mono transition transform hover:scale-105 shadow-xs ${colorClass} ${
                    isSelected ? 'ring-3 ring-slate-900 ring-offset-1 font-black' : ''
                  }`}
                >
                  <span className="text-xs font-bold">W-{w.number}</span>
                  <span className="text-[9px] opacity-80">
                    {metricMode === 'saturation'
                      ? `${m.saturationPercentage}%`
                      : metricMode === 'applications'
                      ? `${(m.activeApplications / 1000).toFixed(1)}k`
                      : metricMode === 'dbt'
                      ? `₹${m.dbtDisbursedCr}Cr`
                      : w.povertyIndex[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Ward Inspector Panel (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                IMC Zone {selectedWard.zone} • Ward #{selectedWard.number}
              </span>
              <h4 className="text-lg font-black font-heading mt-0.5">{selectedWard.name}</h4>
              <p className="text-xs text-slate-400">{selectedWard.areaDescription}</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-mono font-bold">
              {selectedMetrics.saturationPercentage}% Saturated
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400">Active Applications</span>
              <div className="text-base font-black font-mono text-white mt-0.5">
                {selectedMetrics.activeApplications.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
              <span className="text-[10px] text-slate-400">Total DBT Disbursed</span>
              <div className="text-base font-black font-mono text-amber-400 mt-0.5">
                ₹{selectedMetrics.dbtDisbursedCr} Crores
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
              <span className="text-slate-400">Poverty Index:</span>
              <span className={`font-semibold ${selectedWard.povertyIndex === 'High' ? 'text-rose-400' : selectedWard.povertyIndex === 'Medium' ? 'text-amber-400' : 'text-emerald-400'}`}>
                {selectedWard.povertyIndex} Priority
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
              <span className="text-slate-400">Population (Est.):</span>
              <span className="font-mono text-white">{selectedWard.populationEstimate.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800 text-slate-300">
              <span className="text-slate-400">Zonal Office:</span>
              <span className="text-right text-slate-300 max-w-[200px] truncate">{selectedWard.zonalOffice}</span>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top Availed Schemes in this Ward:</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedMetrics.topSchemes.map((ts, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-medium text-slate-200"
                >
                  {ts}
                </span>
              ))}
            </div>
          </div>

          {onSelectWardFilter && (
            <button
              onClick={() => onSelectWardFilter(selectedWard.number)}
              className="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filter Schemes for Ward {selectedWard.number}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
