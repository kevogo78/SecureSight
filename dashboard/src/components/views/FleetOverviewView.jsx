import React from 'react';
import { 
  Monitor, Radio, Power, LayoutDashboard, ShieldCheck, 
  Activity, ArrowRight, ShieldAlert, RefreshCw, CheckCircle2 
} from 'lucide-react';
import FleetStatusCard from '../FleetStatusCard';
import ActivityHeatmap from '../ActivityHeatmap';

export default function FleetOverviewView({ 
  endpoints = [], 
  logs = [], 
  onSelectEndpoint, 
  onNavigate, 
  onRefresh, 
  isRefreshing, 
  onViewScreenshot,
  onOpenConsentModal 
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
              : 'By policy, endpoints only appear once explicit user consent is granted via the Agent Consent UI dialog. Click "Run Consent UI" to simulate or authorize a workstation.'
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenConsentModal}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Run Consent UI</span>
          </button>
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

      {/* Activity Heatmap Overview */}
      <ActivityHeatmap logs={logs} />

      {/* Quick Fleet Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900">Active Workstation Fleet Preview</h4>
            <p className="text-xs text-slate-500">Only endpoints with explicit consent granted are listed</p>
          </div>
          {totalCount > 0 && (
            <button
              onClick={() => onNavigate('endpoints')}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer"
            >
              View All {totalCount} Endpoints →
            </button>
          )}
        </div>

        {endpoints.length === 0 ? (
          <div className="py-12 px-6 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl flex items-center justify-center mx-auto shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h5 className="text-sm font-bold text-slate-900">No Authorized Endpoints Available</h5>
            <p className="text-xs text-slate-500 leading-relaxed">
              Workstations will not appear on this dashboard unless user consent is authorized through the Agent Consent UI dialog.
            </p>
            <div className="pt-2">
              <button
                onClick={onOpenConsentModal}
                className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Run Agent Consent UI</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Computer Name</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">OS</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">CPU %</th>
                  <th className="py-3 px-4">RAM %</th>
                  <th className="py-3 px-4">Active App</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {endpoints.slice(0, 5).map((ep) => (
                  <tr key={ep.endpoint_id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-slate-500" />
                      <span>{ep.name}</span>
                    </td>
                    <td className="py-3 px-4">{ep.user}</td>
                    <td className="py-3 px-4">{ep.os}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 font-semibold text-xs ${
                        ep.status === 'Online' ? 'text-emerald-700' : 'text-slate-500'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${ep.status === 'Online' ? 'bg-[#22c55e]' : 'bg-slate-400'}`} />
                        {ep.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono">{ep.cpu}%</td>
                    <td className="py-3 px-4 font-mono">{ep.ram}%</td>
                    <td className="py-3 px-4 font-semibold text-slate-900 truncate max-w-[160px]">
                      {ep.app || 'Idle'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onSelectEndpoint(ep)}
                        className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold text-xs transition cursor-pointer border border-emerald-200"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
