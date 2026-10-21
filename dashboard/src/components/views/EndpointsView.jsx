import React, { useState, useEffect } from 'react';
import { 
  Monitor, Radio, Power, Pause, Play, ShieldCheck, UserCheck, 
  UserX, Clock, History, LayoutDashboard, AlertCircle, Eye,
  Settings2, Fingerprint, Trash2, X, CheckCircle2, Save, Link2
} from 'lucide-react';
import { fetchEndpointHistoryApi } from '../../services/api';

export default function EndpointsView({ 
  endpoints = [], 
  onSelectEndpoint, 
  onKickEndpoint, 
  onTogglePauseEndpoint,
  onUpdateEndpoint,
  onDeleteEndpoint,
  logs = [],
  initialViewMode = 'all'
}) {
  // Navigation / View modes: 'all' (default), 'connected', or 'offline'
  const [viewMode, setViewMode] = useState(initialViewMode || 'all');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [feedback, setFeedback] = useState(null);

  // Edit Options Modal State
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [editForm, setEditForm] = useState({
    display_name: '',
    mac_address: '',
    device_fingerprint: '',
    user: ''
  });
  const [endpointHistory, setEndpointHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleOpenEditModal = async (ep) => {
    setEditingEndpoint(ep);
    setEditForm({
      display_name: ep.custom_name || ep.name || ep.hostname || '',
      mac_address: ep.mac_address || '',
      device_fingerprint: ep.device_fingerprint || '',
      user: ep.user || ''
    });
    setConfirmDelete(false);
    setLoadingHistory(true);
    try {
      const history = await fetchEndpointHistoryApi(ep.endpoint_id);
      setEndpointHistory(history);
    } catch {
      setEndpointHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSaveEdit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingEndpoint) return;
    setIsSaving(true);
    try {
      if (onUpdateEndpoint) {
        await onUpdateEndpoint(editingEndpoint.endpoint_id, editForm);
      }
      setFeedback({
        type: 'success',
        message: `Endpoint configuration updated and device identifiers successfully linked!`
      });
      // Refresh connection history with updated links
      try {
        const updatedHistory = await fetchEndpointHistoryApi(editingEndpoint.endpoint_id);
        setEndpointHistory(updatedHistory);
      } catch {}
      setTimeout(() => {
        setEditingEndpoint(null);
        setFeedback(null);
      }, 1600);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update endpoint configuration.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEndpointConfirm = async () => {
    if (!editingEndpoint) return;
    setIsDeleting(true);
    try {
      if (onDeleteEndpoint) {
        await onDeleteEndpoint(editingEndpoint.endpoint_id);
      }
      setFeedback({
        type: 'success',
        message: `Endpoint "${editingEndpoint.name}" was safely removed from the database.`
      });
      setTimeout(() => {
        setEditingEndpoint(null);
        setFeedback(null);
        setConfirmDelete(false);
      }, 1500);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to delete endpoint.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
      {/* Verification Feedback Banner */}
      {feedback && !editingEndpoint && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-sm shadow-sm transition ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

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
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Live streaming &rarr;</div>
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
            <div className="text-[11px] text-slate-500 mt-1">Connection history &rarr;</div>
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
              {viewMode === 'connected' && 'Workstations currently reporting active telemetry and responsive to heartbeats.'}
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
                              {ep.mac_address && (
                                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-0.5" title={`Hardware MAC: ${ep.mac_address}`}>
                                  <Fingerprint className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                  <span>{ep.mac_address}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Assigned User */}
                        <td className="py-3.5 px-4 font-medium text-slate-800">{ep.user || 'Authorized User'}</td>

                        {/* Operating System */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              ep.osType === 'mac' ? 'bg-slate-700' : 'bg-blue-600'
                            }`} />
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
                              <span className="text-slate-600 font-bold">Offline</span>
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

                            <button
                              onClick={() => handleOpenEditModal(ep)}
                              className="px-2.5 py-1 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-lg font-semibold text-xs transition cursor-pointer border border-slate-200 flex items-center gap-1"
                              title="Edit Endpoint Options & Device Linking"
                            >
                              <Settings2 className="w-3 h-3 text-slate-500" />
                              <span>Edit</span>
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
                Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, displayedEndpoints.length)} of {displayedEndpoints.length} workstations
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  &lsaquo;
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
                  &rsaquo;
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit Options Modal */}
      {editingEndpoint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Endpoint Configuration &amp; Device Linking
                  </h3>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    Endpoint ID #{editingEndpoint.endpoint_id} &bull; Hostname: {editingEndpoint.hostname || editingEndpoint.name}
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setEditingEndpoint(null); setFeedback(null); }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Feedback Alert */}
            {feedback && (
              <div className={`mx-6 mt-4 p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                feedback.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}

            {/* Modal Form Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* Basic Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  General Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Display / Friendly Name
                    </label>
                    <input
                      type="text"
                      value={editForm.display_name}
                      onChange={(e) => setEditForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder="e.g. Finance-Laptop-01"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Assigned User
                    </label>
                    <input
                      type="text"
                      value={editForm.user}
                      onChange={(e) => setEditForm(f => ({ ...f, user: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Hardware Identifiers */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Physical Hardware Identification &amp; Re-linking
                  </h4>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Logins across different accounts or re-registrations from this same physical machine are automatically unified and linked together via persistent device fingerprint and network adapter MAC address.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      MAC Address
                    </label>
                    <input
                      type="text"
                      value={editForm.mac_address}
                      onChange={(e) => setEditForm(f => ({ ...f, mac_address: e.target.value }))}
                      placeholder="00:1A:2B:3C:4D:5E"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Device Fingerprint
                    </label>
                    <input
                      type="text"
                      value={editForm.device_fingerprint}
                      onChange={(e) => setEditForm(f => ({ ...f, device_fingerprint: e.target.value }))}
                      placeholder="SHA256 hardware identifier"
                      className="w-full px-3 py-2 font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Linked Physical Machine Connection History */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Linked Physical Device Connection History
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {endpointHistory.length} recorded session{endpointHistory.length === 1 ? '' : 's'}
                  </span>
                </div>

                {loadingHistory ? (
                  <div className="py-6 text-center text-slate-400 flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin" />
                    <span>Loading connection history...</span>
                  </div>
                ) : endpointHistory.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs">
                    No historical sessions found for this physical device.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">Session Time</th>
                          <th className="py-2 px-3">User</th>
                          <th className="py-2 px-3">IP Address</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3">Linked By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {endpointHistory.map((item, idx) => {
                          const isFpMatch = item.device_fingerprint && editForm.device_fingerprint && item.device_fingerprint === editForm.device_fingerprint;
                          const isMacMatch = item.mac_address && editForm.mac_address && item.mac_address.toLowerCase() === editForm.mac_address.toLowerCase();

                          return (
                            <tr key={item.connection_id || idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {item.connected_at ? new Date(item.connected_at).toLocaleString() : 'Recent'}
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-800">
                                {item.username || `User #${item.user_id || 1}`}
                              </td>
                              <td className="py-2 px-3 font-mono text-slate-600">
                                {item.ip_address || '127.0.0.1'}
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                  (item.status || '').toLowerCase().includes('online') 
                                    ? 'bg-emerald-50 text-emerald-700' 
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {(item.status || '').toLowerCase().includes('online') ? 'Online' : 'Offline'}
                                </span>
                              </td>
                              <td className="py-2 px-3">
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                                  <Link2 className="w-2.5 h-2.5 text-slate-400" />
                                  {isFpMatch ? 'Fingerprint' : isMacMatch ? 'MAC' : 'Endpoint ID'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Danger Zone: Safe Deletion */}
              <div className="pt-4 border-t border-red-100">
                <div className="p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-red-900 text-xs flex items-center gap-1.5">
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        <span>Safely Remove Endpoint from Database</span>
                      </div>
                      <p className="text-[11px] text-red-700/80 mt-0.5">
                        Deletes endpoint record and cascades removal of associated telemetry and audit logs.
                      </p>
                    </div>

                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-xs transition cursor-pointer shadow-sm"
                      >
                        Delete Endpoint
                      </button>
                    ) : null}
                  </div>

                  {confirmDelete && (
                    <div className="p-3 bg-red-100/70 border border-red-300 rounded-lg flex items-center justify-between gap-4">
                      <div className="text-[11px] font-semibold text-red-900">
                        Confirm permanent deletion of "{editingEndpoint.name}"?
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={isDeleting}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded border border-slate-300 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteEndpointConfirm}
                          disabled={isDeleting}
                          className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
                        >
                          {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setEditingEndpoint(null); setFeedback(null); }}
                disabled={isSaving || isDeleting}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSaving || isDeleting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save &amp; Link Endpoint</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
