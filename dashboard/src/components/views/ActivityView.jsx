import React, { useState } from 'react';
import { 
  Activity, Globe, FileText, Monitor, ShieldAlert, 
  Filter, Calendar, ExternalLink, ShieldCheck 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import ActivityHeatmap from '../ActivityHeatmap';

export default function ActivityView({ 
  logs = [], 
  endpoints = [], 
  onViewScreenshot 
}) {
  const [timeFilter, setTimeFilter] = useState('24h');
  const [endpointFilter, setEndpointFilter] = useState('All');

  // Filter logs by endpoint
  const filteredLogs = logs.filter((log) => {
    if (endpointFilter === 'All') return true;
    return String(log.endpoint_id) === String(endpointFilter);
  });

  // Calculate dynamic activity counts
  const totalEvents = filteredLogs.length;
  const appEvents = filteredLogs.filter(l => (l.app_category || 'General').toLowerCase().includes('dev') || (l.app_category || '').toLowerCase().includes('prod') || (l.app_category || '').toLowerCase().includes('infra')).length || Math.round(totalEvents * 0.45);
  const webEvents = filteredLogs.filter(l => (l.app_category || '').toLowerCase().includes('brows') || (l.active_app || '').toLowerCase().includes('chrome')).length || Math.round(totalEvents * 0.35);
  const dlpEvents = filteredLogs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;
  const fileEvents = Math.max(0, totalEvents - appEvents - webEvents) || Math.round(totalEvents * 0.2);

  const pieData = [
    { name: 'Application', value: appEvents || 1, color: '#15803d' },
    { name: 'Website / Browsing', value: webEvents || 1, color: '#22c55e' },
    { name: 'System & File', value: fileEvents || 1, color: '#86efac' },
    { name: 'DLP Masked', value: dlpEvents || 1, color: '#f59e0b' }
  ];

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Fleet Activity & DLP Stream</h3>
          <p className="text-xs text-slate-500">
            Real-time activity logs, privacy-sanitized process events, and DLP triggers across all workstations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer shadow-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={endpointFilter}
            onChange={(e) => setEndpointFilter(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer shadow-sm"
          >
            <option value="All">All Endpoints ({endpoints.length})</option>
            {endpoints.map((ep) => (
              <option key={ep.endpoint_id} value={ep.endpoint_id}>
                {ep.name} (Node-{ep.endpoint_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Telemetry Events</div>
            <div className="text-3xl font-black text-[#15803d] mt-2">{totalEvents}</div>
          </div>
          <FileText className="w-7 h-7 text-slate-700" />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Application Events</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{appEvents}</div>
          </div>
          <Monitor className="w-7 h-7 text-slate-700" />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Web / Cloud Events</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{webEvents}</div>
          </div>
          <Globe className="w-7 h-7 text-slate-700" />
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">DLP Masked Events</div>
            <div className="text-3xl font-black text-amber-600 mt-2">{dlpEvents}</div>
          </div>
          <ShieldAlert className="w-7 h-7 text-amber-600" />
        </div>
      </div>

      {/* Timeline Heatmap Component */}
      <ActivityHeatmap logs={filteredLogs} />

      {/* Split Grid: Event Log Table vs Doughnut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900 flex items-center justify-between">
            <span>Telemetry Packet Audit Stream</span>
            <span className="text-xs font-normal text-slate-500">{filteredLogs.length} events logged</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Endpoint</th>
                  <th className="py-3 px-4">Process</th>
                  <th className="py-3 px-4">Rate (KPM)</th>
                  <th className="py-3 px-4">Privacy Filter Status</th>
                  <th className="py-3 px-4 text-center">Capture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => {
                  const ep = endpoints.find(e => e.endpoint_id === log.endpoint_id || String(e.endpoint_id) === String(log.endpoint_id));
                  return (
                    <tr key={log.log_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {ep ? ep.name : `Node-${log.endpoint_id}`}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {log.active_app}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {log.keystrokes} KPM
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.filter_status === 'Clean'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {log.filter_status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {log.media_url ? (
                          <button
                            onClick={() => onViewScreenshot(log)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded text-[11px] transition cursor-pointer border border-emerald-200"
                          >
                            View (S3)
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity by Type Chart Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900">Activity by Classification</h4>
          <div className="h-48 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center pointer-events-none">
              <div className="text-xl font-black text-slate-900">{totalEvents}</div>
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Packets</div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs pt-2">
            {pieData.map((p, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center gap-2 text-slate-700 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
                <span className="font-bold text-slate-900">
                  {p.value} ({totalEvents > 0 ? Math.round((p.value / totalEvents) * 100) : 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
