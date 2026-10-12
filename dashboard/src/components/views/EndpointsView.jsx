import React, { useState, useEffect } from 'react';
import { 
  Monitor, Radio, Power, Pause, Play, ShieldCheck, UserCheck, 
  UserX, Clock, History, LayoutDashboard, AlertCircle, Eye 
} from 'lucide-react';

export default function EndpointsView({ 
  endpoints = [], 
  onSelectEndpoint, 
  onKickEndpoint, 
  onTogglePauseEndpoint,
  logs = [],
  initialViewMode = 'all'
}) {
  // Navigation / View modes: 'all' (default), 'connected', or 'offline'
  const [viewMode, setViewMode] = useState(initialViewMode || 'all');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
      setStatusFilter('All');
      setCurrentPage(1);
    }
  }, [initialViewMode]);

  const isConsentPaused = (ep) => {
    return ep.status === 'Paused' || ep.consent_paused === true || ep.consent_status === 'Paused';
  };

  // Connected endpoints are actively alive (Online or Paused)
  const connectedEndpoints = endpoints.filter((ep) => {
    if (!ep) return false;
    const s = (ep.status || '').toLowerCase();
    return s === 'online' || s === 'paused' || isConsentPaused(ep);
  });

  // Offline / Suspended endpoints: past devices that gave consent but are currently disconnected
  const offlineEndpoints = endpoints.filter((ep) => {
    if (!ep) return false;
    const s = (ep.status || '').toLowerCase();
    return s.includes('offline') || s.includes('disconnect') || s.includes('kicked') || (!s.includes('online') && !isConsentPaused(ep));
  });

  // Calculate dynamic fleet metrics
  const totalConnected = connectedEndpoints.length;
  const onlineCount = connectedEndpoints.filter(e => !isConsentPaused(e) && e.status === 'Online').length;
  const pausedCount = connectedEndpoints.filter(e => isConsentPaused(e)).length;
  const offlineCount = offlineEndpoints.length;

  // Filter endpoints based on viewMode and dropdown selection
  const displayedEndpoints = (() => {
    let baseList = [];
    if (viewMode === 'connected') {
      baseList = connectedEndpoints;
    } else if (viewMode === 'offline') {
      baseList = offlineEndpoints;
    } else {
      baseList = endpoints;
    }

    if (statusFilter === 'All') return baseList;
    if (statusFilter === 'Online') return baseList.filter(e => !isConsentPaused(e) && e.status === 'Online');
    if (statusFilter === 'Paused') return baseList.filter(e => isConsentPaused(e));
    if (statusFilter === 'Offline') return baseList.filter(e => e.status !== 'Online' && !isConsentPaused(e));
    return baseList;
  })();

  const totalPages = Math.ceil(displayedEndpoints.length / itemsPerPage) || 1;
  const paginatedEndpoints = displayedEndpoints.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => { setViewMode('connected'); setCurrentPage(1); }}
          className={`bg-white rounded-xl p-5 border shadow-sm flex items-center justify-between cursor-pointer transition ${
            viewMode === 'connected' ? 'border-[#15803d] ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Connected Endpoints</div>
            <div className="text-3xl font-black text-[#15803d] mt-2">{totalConnected}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Live streaming →</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
            <Monitor className="w-7 h-7" />
          </div>
        </div>

        <div 
          onClick={() => { setViewMode('connected'); setStatusFilter('Online'); setCurrentPage(1); }}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Online &amp; Streaming</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{onlineCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Heartbeat active</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Radio className="w-7 h-7" />
          </div>
        </div>

        <div 
          onClick={() => { setViewMode('connected'); setStatusFilter('Paused'); setCurrentPage(1); }}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-300 transition"
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Consent Paused</div>
            <div className="text-3xl font-black text-amber-600 mt-2">{pausedCount}</div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">Privacy suspension</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Pause className="w-7 h-7" />
          </div>
        </div>

        <div 
          onClick={() => { setViewMode('offline'); setStatusFilter('All'); setCurrentPage(1); }}
          className={`bg-white rounded-xl p-5 border shadow-sm flex items-center justify-between cursor-pointer transition ${
            viewMode === 'offline' ? 'border-slate-700 ring-2 ring-slate-400/20' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <div className="text-xs font-semibold text-slate-500">Offline / Suspended</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{offlineCount}</div>
            <div className="text-[11px] text-slate-500 mt-1">Connection history →</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Power className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header with Segmented Navigation Tabs and Filter */}
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-slate-900">
                {viewMode === 'connected' && 'Connected Fleet Workstations'}
                {viewMode === 'offline' && 'Offline / Suspended Devices History'}
                {viewMode === 'all' && 'All Consented Fleet Devices'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {displayedEndpoints.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {viewMode === 'connected' && 'Workstations currently streaming live telemetry and responsive to heartbeats.'}
              {viewMode === 'offline' && 'Past workstations that granted consent with recorded telemetry and connection history.'}
              {viewMode === 'all' && 'Overview of all consented workstations across active and historical states.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Segmented Controls */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => { setViewMode('connected'); setStatusFilter('All'); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'connected' 
                    ? 'bg-white text-emerald-800 shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                <span>Connected ({totalConnected})</span>
              </button>

              <button
                onClick={() => { setViewMode('offline'); setStatusFilter('All'); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'offline' 
                    ? 'bg-white text-slate-900 shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span>Offline / History ({offlineCount})</span>
              </button>

              <button
                onClick={() => { setViewMode('all'); setStatusFilter('All'); setCurrentPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'all' 
                    ? 'bg-white text-slate-900 shadow-sm font-bold' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>All ({endpoints.length})</span>
              </button>
            </div>

            {/* Filter Dropdown */}
            {viewMode === 'connected' && (
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="All">All Connected ({totalConnected})</option>
                <option value="Online">Online Only ({onlineCount})</option>
                <option value="Paused">Consent Paused ({pausedCount})</option>
              </select>
            )}

            {viewMode === 'all' && (
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none cursor-pointer"
              >
                <option value="All">All Fleet ({endpoints.length})</option>
                <option value="Online">Online Only ({onlineCount})</option>
                <option value="Paused">Consent Paused ({pausedCount})</option>
                <option value="Offline">Offline / Standby ({offlineCount})</option>
              </select>
            )}
          </div>
        </div>

        {/* Empty States */}
        {displayedEndpoints.length === 0 ? (
          <div className="py-16 px-6 text-center max-w-lg mx-auto space-y-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
              viewMode === 'connected' 
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' 
                : 'bg-slate-100 border border-slate-200 text-slate-600'
            }`}>
              {viewMode === 'connected' ? <UserCheck className="w-7 h-7" /> : <Power className="w-7 h-7" />}
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">
                {viewMode === 'connected' && 'No Connected Endpoints'}
                {viewMode === 'offline' && 'No Offline Devices'}
                {viewMode === 'all' && 'No Endpoints Enrolled'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {viewMode === 'connected' && 'No active workstation connections detected. Only connected machines currently reporting heartbeat telemetry appear here.'}
                {viewMode === 'offline' && 'All consented workstations in your fleet are currently active and connected.'}
                {viewMode === 'all' && 'No workstations match the selected filter.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="py-3.5 px-4">Computer Name</th>
                    <th className="py-3.5 px-4">Assigned User</th>
                    <th className="py-3.5 px-4">Operating System</th>
                    <th className="py-3.5 px-4">IP Address</th>
                    <th className="py-3.5 px-4">Consent Status</th>
                    <th className="py-3.5 px-4">Connection Status</th>
                    <th className="py-3.5 px-4">Last Seen</th>
                    {viewMode === 'offline' ? (
                      <th className="py-3.5 px-4">Connection &amp; Telemetry History</th>
                    ) : (
                      <>
                        <th className="py-3.5 px-4">CPU %</th>
                        <th className="py-3.5 px-4">RAM %</th>
                        <th className="py-3.5 px-4">Active Application</th>
                      </>
                    )}
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedEndpoints.map((ep) => {
                    const paused = isConsentPaused(ep);
                    const isOffline = !ep.status || ep.status.toLowerCase().includes('offline') || ep.status.toLowerCase().includes('kicked') || (ep.status !== 'Online' && !paused);
                    const epLogs = logs.filter(
                      l => l.endpoint_id === ep.endpoint_id || String(l.endpoint_id) === String(ep.endpoint_id)
                    );
                    const totalCycles = epLogs.length;

                    return (
                      <tr key={ep.endpoint_id} className="hover:bg-slate-50/70 transition">
                        {/* Computer Name */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            {isOffline ? (
                              <Power className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <Monitor className="w-4 h-4 text-emerald-600 shrink-0" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{ep.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {ep.endpoint_id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Assigned User */}
                        <td className="py-3.5 px-4 font-medium text-slate-800">{ep.user || 'Authorized User'}</td>

                        {/* Operating System */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span className={`text-[10px] ${
                              ep.osType === 'mac' ? 'text-slate-700' : 'text-blue-600'
                            }`}>■</span>
                            {ep.os}
                          </span>
                        </td>

                        {/* IP Address */}
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {ep.ipAddress || ep.ip_address || '192.168.1.100'}
                        </td>

                        {/* Consent Status */}
                        <td className="py-3.5 px-4">
                          {paused ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 shadow-sm">
                              <Pause className="w-3 h-3 text-amber-600 fill-amber-600" />
                              Paused
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              Granted
                            </span>
                          )}
                        </td>

                        {/* Connection Status */}
                        <td className="py-3.5 px-4">
                          {isOffline ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span className="text-slate-600 font-bold">Offline / Standby</span>
                            </span>
                          ) : paused ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                              <span className="text-amber-700 font-bold">Paused</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
                              <span className="text-emerald-700 font-bold">Online</span>
                            </span>
                          )}
                        </td>

                        {/* Last Seen */}
                        <td className="py-3.5 px-4 text-slate-500" title={ep.lastSeenDate || ''}>
                          {ep.lastSeen || 'Unknown'}
                        </td>

                        {/* Telemetry Details */}
                        {viewMode === 'offline' ? (
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-800 flex items-center gap-1">
                                <History className="w-3 h-3 text-slate-400" />
                                <span>{totalCycles > 0 ? `${totalCycles} telemetry logs recorded` : 'Consent Enrolled'}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                Last active: {ep.app || 'Idle'}
                              </div>
                            </div>
                          </td>
                        ) : (
                          <>
                            <td className="py-3.5 px-4 font-mono font-medium">
                              {ep.cpu > 0 ? `${ep.cpu}%` : '0%'}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-medium">
                              {ep.ram > 0 ? `${ep.ram}%` : '0%'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2 max-w-[180px] truncate">
                                <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                                <span className="font-semibold text-slate-800 truncate">{ep.app || 'Agent Active'}</span>
                              </div>
                            </td>
                          </>
                        )}

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onSelectEndpoint(ep)}
                              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold text-xs transition cursor-pointer border border-emerald-200 flex items-center gap-1"
                              title="View Endpoint Timeline & Activity"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{viewMode === 'offline' ? 'History' : 'View'}</span>
                            </button>

                            {!isOffline && (
                              <button
                                onClick={() => onTogglePauseEndpoint && onTogglePauseEndpoint(ep.endpoint_id)}
                                className={`px-2 py-1 rounded-lg font-semibold text-xs transition cursor-pointer border flex items-center gap-1 ${
                                  paused
                                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200'
                                }`}
                                title={paused ? "Resume Monitoring Consent" : "Pause Monitoring Consent"}
                              >
                                {paused ? <Play className="w-3 h-3 text-emerald-600" /> : <Pause className="w-3 h-3 text-amber-600" />}
                                <span>{paused ? 'Resume' : 'Pause'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to de-authorize and kick workstation "${ep.name}"?`)) {
                                  onKickEndpoint(ep.endpoint_id);
                                }
                              }}
                              className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold text-xs transition cursor-pointer border border-red-200 flex items-center gap-1"
                              title="Kick / De-authorize Endpoint"
                            >
                              <UserX className="w-3 h-3 text-red-600" />
                              <span>Kick</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, displayedEndpoints.length)} of {displayedEndpoints.length} workstations
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx + 1}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      currentPage === idx + 1 ? 'bg-[#22c55e] text-white' : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
