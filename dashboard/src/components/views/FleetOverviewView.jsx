import React from 'react';
import { 
  Monitor, Radio, Power, LayoutDashboard, 
  ArrowRight, RefreshCw 
} from 'lucide-react';
import FleetStatusCard from '../FleetStatusCard';

export default function FleetOverviewView({ 
  endpoints = [], 
  logs = [], 
  onSelectEndpoint, 
  onNavigate, 
  onRefresh, 
  isRefreshing, 
  onViewScreenshot
}) {
  const totalCount = endpoints.length;
  const onlineCount = endpoints.filter(e => e.status === 'Online').length;
  const offlineCount = endpoints.filter(e => e.status === 'Offline').length;
  const uniqueAppsCount = new Set(endpoints.map(e => e.app).filter(Boolean)).size;
  const dlpCount = logs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* Fleet Overview Hero Banner */}
      <div className="bg-gradient-to-r from-[#0a2312] to-slate-900 rounded-2xl p-6 text-white border border-emerald-900/40 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AWS Telemetry Fleet {totalCount > 0 ? 'Online' : 'Standby'}</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Endpoint Privacy &amp; Compliance Control</h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {totalCount > 0
              ? `Live observability active across ${totalCount} monitored workstations. All client screen captures and events are sanitized via local DLP prior to AWS S3 ingestion.`
              : 'By policy, endpoints only appear once explicit user consent is granted via the Agent Consent UI dialog on monitored workstations.'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh Telemetry'}</span>
          </button>
          <button
            onClick={() => onNavigate('reports')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <span>Compliance Audit</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Fleet Status Summary Cards */}
      <FleetStatusCard totalLogs={logs.length} maskedCount={dlpCount} />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => onNavigate('endpoints')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Fleet Endpoints</div>
            <div className="text-3xl font-black text-[#15803d] mt-2">{totalCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Manage Workstations →</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Monitor className="w-7 h-7" />
          </div>
        </div>

        <div 
          onClick={() => onNavigate('endpoints')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Online & Streaming</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{onlineCount}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Heartbeat active</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Radio className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Offline / Suspended</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{offlineCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Standby mode</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Power className="w-7 h-7" />
          </div>
        </div>

        <div 
          onClick={() => onNavigate('activity')}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Unique Active Apps</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{uniqueAppsCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">View Activity Feed →</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <LayoutDashboard className="w-7 h-7" />
          </div>
        </div>
      </div>
    </div>
  );
}
