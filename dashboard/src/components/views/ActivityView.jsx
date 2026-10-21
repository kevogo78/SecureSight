import React, { useState } from 'react';
import { 
  Activity, Globe, FileText, Monitor, ShieldAlert, 
  Filter, Calendar, ExternalLink, ShieldCheck,
  ChevronDown, Check, X, Search
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function ActivityView({ 
  logs = [], 
  endpoints = [], 
  onViewScreenshot 
}) {
  const [timeFilter, setTimeFilter] = useState('24h');
  const [selectedEndpoints, setSelectedEndpoints] = useState([]);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');

  // Toggle selection of a single endpoint
  const toggleEndpoint = (epId) => {
    const strId = String(epId);
    setSelectedEndpoints(prev => {
      if (prev.includes(strId)) {
        return prev.filter(id => id !== strId);
      } else {
        return [...prev, strId];
      }
    });
  };

  const selectAllEndpoints = () => {
    setSelectedEndpoints([]);
  };

  const clearEndpoints = () => {
    setSelectedEndpoints([]);
  };

  // Filter logs by multi-selected endpoints and time filter
  const filteredLogs = logs.filter((log) => {
    if (selectedEndpoints.length > 0) {
      const match = selectedEndpoints.some(id => String(id) === String(log.endpoint_id));
      if (!match) return false;
    }

    if (timeFilter !== 'all' && log.timestamp) {
      const logTime = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (timeFilter === '24h' && (now - logTime) > 24 * 60 * 60 * 1000) return false;
      if (timeFilter === '7d' && (now - logTime) > 7 * 24 * 60 * 60 * 1000) return false;
    }

    return true;
  });

  // Calculate dynamic activity counts
  const totalEvents = filteredLogs.length;
  const webEvents = filteredLogs.filter(l => 
    Boolean(l.website_url) || 
    (l.app_category || '').toLowerCase().includes('brows') || 
    (l.active_app || '').toLowerCase().includes('chrome') ||
    (l.active_app || '').toLowerCase().includes('edge') ||
    (l.active_app || '').toLowerCase().includes('firefox')
  ).length;
  const dlpEvents = filteredLogs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;
  const appEvents = filteredLogs.filter(l => 
    !Boolean(l.website_url) && (
      (l.app_category || 'General').toLowerCase().includes('dev') || 
      (l.app_category || '').toLowerCase().includes('prod') || 
      (l.app_category || '').toLowerCase().includes('infra') ||
      (!l.active_app?.toLowerCase().includes('chrome') && !l.active_app?.toLowerCase().includes('edge'))
    )
  ).length;
  const fileEvents = Math.max(0, totalEvents - appEvents - webEvents);

  const pieData = [
    { name: 'Application', value: appEvents || (totalEvents === 0 ? 0 : 1), color: '#15803d' },
    { name: 'Website / Browsing', value: webEvents || (totalEvents === 0 ? 0 : 1), color: '#22c55e' },
    { name: 'System & File', value: fileEvents || 0, color: '#86efac' },
    { name: 'DLP Masked', value: dlpEvents || 0, color: '#f59e0b' }
  ];

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Fleet Activity &amp; DLP Stream</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time activity logs, privacy-sanitized process events, visited websites, and DLP triggers across workstations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Filter Dropdown */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="all">All Time</option>
          </select>

          {/* Multi-Select Device Filter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDeviceDropdownOpen(!isDeviceDropdownOpen)}
              className="flex items-center gap-2 text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white cursor-pointer shadow-sm hover:border-slate-300 transition"
            >
              <Monitor className="w-3.5 h-3.5 text-slate-500" />
              <span>
                {selectedEndpoints.length === 0
                  ? `All Devices (${endpoints.length})`
                  : selectedEndpoints.length === 1
                    ? (endpoints.find(e => String(e.endpoint_id) === String(selectedEndpoints[0]))?.name || `Node-${selectedEndpoints[0]}`)
                    : `${selectedEndpoints.length} Devices Filtered`}
              </span>
              {selectedEndpoints.length > 0 && (
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {selectedEndpoints.length}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {isDeviceDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-20" 
                  onClick={() => setIsDeviceDropdownOpen(false)} 
                />
                
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-30 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Filter by Devices</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllEndpoints}
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={clearEndpoints}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {endpoints.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search workstations..."
                        value={deviceSearch}
                        onChange={(e) => setDeviceSearch(e.target.value)}
                        className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {endpoints
                      .filter(ep => 
                        !deviceSearch || 
                        (ep.name && ep.name.toLowerCase().includes(deviceSearch.toLowerCase())) ||
                        String(ep.endpoint_id).includes(deviceSearch)
                      )
                      .map((ep) => {
                        const isSelected = selectedEndpoints.includes(String(ep.endpoint_id));
                        return (
                          <div
                            key={ep.endpoint_id}
                            onClick={() => toggleEndpoint(ep.endpoint_id)}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs ${
                              isSelected ? 'bg-emerald-50/80 text-emerald-900 font-medium' : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                                isSelected 
                                  ? 'bg-emerald-600 border-emerald-600 text-white' 
                                  : 'border-slate-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="truncate">
                                <div className="font-semibold truncate">{ep.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">ID: {ep.endpoint_id}</div>
                              </div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ml-2 ${
                              ep.status === 'Online' 
                                ? 'bg-emerald-100/70 text-emerald-700' 
                                : ep.status === 'Paused' 
                                  ? 'bg-amber-100/70 text-amber-700' 
                                  : 'bg-slate-100 text-slate-600'
                            }`}>
                              {ep.status || 'Enrolled'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Selected Devices Active Filter Chips */}
      {selectedEndpoints.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-100 rounded-xl border border-slate-200 text-xs">
          <span className="font-semibold text-slate-600 flex items-center gap-1.5 pl-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filtered Devices ({selectedEndpoints.length}):</span>
          </span>
          {selectedEndpoints.map(id => {
            const ep = endpoints.find(e => String(e.endpoint_id) === String(id));
            const name = ep ? ep.name : `Node-${id}`;
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 font-medium shadow-xs"
              >
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => toggleEndpoint(id)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Remove device filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={clearEndpoints}
            className="text-xs text-emerald-700 hover:text-emerald-800 font-bold ml-auto px-2 py-0.5 cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

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
                  <th className="py-3 px-4">Visited Website / Domain</th>
                  <th className="py-3 px-4">Rate (KPM)</th>
                  <th className="py-3 px-4">Privacy Filter Status</th>
                  <th className="py-3 px-4 text-center">Capture</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No activity events found matching the active device and time filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const ep = endpoints.find(e => e.endpoint_id === log.endpoint_id || String(e.endpoint_id) === String(log.endpoint_id));
                    const isBrowser = (log.app_category || '').toLowerCase().includes('brows') || 
                                      (log.active_app || '').toLowerCase().includes('chrome') || 
                                      (log.active_app || '').toLowerCase().includes('edge') || 
                                      (log.active_app || '').toLowerCase().includes('firefox');
                    return (
                      <tr key={log.log_id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {ep ? ep.name : `Node-${log.endpoint_id}`}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {log.active_app}
                        </td>
                        <td className="py-3 px-4">
                          {log.website_url ? (
                            <div className="flex items-center gap-1.5 max-w-[210px]" title={log.website_url}>
                              <span className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                <Globe className="w-3 h-3" />
                              </span>
                              <span className="font-semibold text-slate-800 truncate font-mono text-[11px]">
                                {log.website_url}
                              </span>
                            </div>
                          ) : isBrowser ? (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="italic">Web Session</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {log.keystrokes ? `${log.keystrokes} KPM` : '0 KPM'}
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
                  })
                )}
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
