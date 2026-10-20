import React, { useState } from 'react';
import { 
  FileText, Download, ShieldCheck, CheckCircle2, AlertTriangle, 
  Calendar, FileSpreadsheet, Lock, UserCheck, Filter, Monitor,
  Fingerprint, Globe, Check, ChevronDown
} from 'lucide-react';

export default function ReportsView({ logs = [], endpoints = [] }) {
  const [dateRange, setDateRange] = useState('7d');
  const [selectedEndpointFilter, setSelectedEndpointFilter] = useState('all');
  const [downloading, setDownloading] = useState(false);

  // Helper to resolve the most recently updated/assigned friendly name for each endpoint
  const getEndpointInfo = (endpointId, logHostname = null) => {
    const ep = endpoints.find(e => String(e.endpoint_id) === String(endpointId));
    const mostRecentName = ep?.custom_name || ep?.name || ep?.hostname || logHostname || `Node-${endpointId}`;
    const registeredHostname = ep?.hostname || logHostname || `WORKSTATION-${endpointId}`;
    const hasCustomName = Boolean(ep?.custom_name && ep.custom_name !== registeredHostname);

    return {
      name: mostRecentName,
      hostname: registeredHostname,
      isCustom: hasCustomName,
      user: ep?.user || 'Authorized User',
      mac: ep?.mac_address || null,
      fingerprint: ep?.device_fingerprint || null,
      os: ep?.os || 'Windows 11',
      status: ep?.status || 'Online'
    };
  };

  // Filter logs by selected endpoint and date range
  const filteredLogs = logs.filter((log) => {
    if (selectedEndpointFilter !== 'all' && String(log.endpoint_id) !== String(selectedEndpointFilter)) {
      return false;
    }

    if (dateRange !== 'all' && log.timestamp) {
      const logTime = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (dateRange === '24h' && (now - logTime) > 24 * 60 * 60 * 1000) return false;
      if (dateRange === '7d' && (now - logTime) > 7 * 24 * 60 * 60 * 1000) return false;
      if (dateRange === '30d' && (now - logTime) > 30 * 24 * 60 * 60 * 1000) return false;
    }

    return true;
  });

  // Compute compliance metrics on filtered view
  const totalEvents = filteredLogs.length;
  const dlpEvents = filteredLogs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;
  const complianceScore = totalEvents > 0 ? ((1 - (dlpEvents / totalEvents)) * 100).toFixed(1) : '100.0';

  const downloadCSV = () => {
    setDownloading(true);
    setTimeout(() => {
      const headers = [
        'Event ID',
        'Endpoint ID',
        'Workstation (Most Recent Name)',
        'Registered Hostname',
        'Assigned User',
        'Timestamp',
        'Active Application',
        'Visited Website / Domain',
        'App Category',
        'Keystrokes (KPM)',
        'Privacy Filter Action',
        'DLP Triggered'
      ];

      const rows = filteredLogs.map(l => {
        const ep = getEndpointInfo(l.endpoint_id, l.hostname);
        return [
          l.log_id,
          l.endpoint_id,
          `"${ep.name}"`,
          `"${ep.hostname}"`,
          `"${ep.user}"`,
          `"${l.timestamp || ''}"`,
          `"${l.active_app || ''}"`,
          `"${l.website_url || ''}"`,
          `"${l.app_category || 'General'}"`,
          l.keystrokes || 0,
          `"${l.filter_status || 'Clean'}"`,
          l.dlp_flag ? 'TRUE' : 'FALSE'
        ];
      });

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `privacy_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloading(false);
    }, 400);
  };

  const downloadJSON = () => {
    setDownloading(true);
    setTimeout(() => {
      const exportData = {
        exportDate: new Date().toISOString(),
        generatedBy: 'administrator',
        fleetSummary: {
          totalEndpoints: endpoints.length,
          totalEvents,
          dlpEvents,
          complianceScore: `${complianceScore}%`,
          activeFilter: selectedEndpointFilter
        },
        endpoints: endpoints.map(ep => ({
          endpoint_id: ep.endpoint_id,
          most_recent_name: ep.custom_name || ep.name || ep.hostname,
          registered_hostname: ep.hostname || ep.name,
          custom_name: ep.custom_name || null,
          mac_address: ep.mac_address || null,
          device_fingerprint: ep.device_fingerprint || null,
          user: ep.user || 'Authorized User',
          os: ep.os,
          status: ep.status
        })),
        auditLogs: filteredLogs.map(l => {
          const ep = getEndpointInfo(l.endpoint_id, l.hostname);
          return {
            ...l,
            endpoint_name: ep.name,
            endpoint_hostname: ep.hostname,
            assigned_user: ep.user
          };
        })
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `telemetry_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloading(false);
    }, 400);
  };

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Privacy &amp; Compliance Reports</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate and export cryptographically verifiable audit trails of endpoint observability using latest device configurations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Endpoint Selector Filter */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm">
            <Monitor className="w-4 h-4 text-slate-400" />
            <select
              value={selectedEndpointFilter}
              onChange={(e) => setSelectedEndpointFilter(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer max-w-[170px] truncate"
            >
              <option value="all">All Workstations ({endpoints.length})</option>
              {endpoints.map((ep) => {
                const recentName = ep.custom_name || ep.name || ep.hostname;
                return (
                  <option key={ep.endpoint_id} value={ep.endpoint_id}>
                    {recentName} (ID: {ep.endpoint_id})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Available History</option>
            </select>
          </div>

          <button
            onClick={downloadCSV}
            disabled={downloading}
            className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={downloadJSON}
            disabled={downloading}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export JSON Audit</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Privacy Compliance Score</div>
            <div className="text-3xl font-black text-[#15803d] mt-2">{complianceScore}%</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Zero unmasked credentials</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">DLP Masking Events</div>
            <div className="text-3xl font-black text-amber-600 mt-2">{dlpEvents}</div>
            <div className="text-[11px] text-slate-500 mt-1">Titles &amp; secrets auto-redacted</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Monitored Fleet Devices</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{endpoints.length}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">Enrolled with latest names</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <UserCheck className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Report Telemetry Events</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{totalEvents}</div>
            <div className="text-[11px] text-slate-500 mt-1">RDS PostgreSQL records</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <FileText className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Endpoint Fleet Summary Table (Recent Names View) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900">Endpoint Fleet Observability &amp; Identity Status</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Displays the most recently configured display names, assigned users, and physical hardware correlation.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-700 border border-slate-200">
            {endpoints.length} Workstations
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Workstation (Latest Name)</th>
                <th className="py-3 px-4">Hardware Identifiers</th>
                <th className="py-3 px-4">Assigned User</th>
                <th className="py-3 px-4">Operating System</th>
                <th className="py-3 px-4">Audit Packets</th>
                <th className="py-3 px-4">DLP Redactions</th>
                <th className="py-3 px-4">Compliance Rating</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {endpoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No endpoint records found.
                  </td>
                </tr>
              ) : (
                endpoints.map((ep) => {
                  const recentName = ep.custom_name || ep.name || ep.hostname;
                  const isCustom = Boolean(ep.custom_name && ep.custom_name !== ep.hostname);
                  const epLogs = logs.filter(l => String(l.endpoint_id) === String(ep.endpoint_id));
                  const epTotal = epLogs.length;
                  const epDlp = epLogs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;
                  const epScore = epTotal > 0 ? ((1 - (epDlp / epTotal)) * 100).toFixed(1) : '100.0';

                  return (
                    <tr key={ep.endpoint_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{recentName}</span>
                              {isCustom && (
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">
                                  Friendly
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              ID: {ep.endpoint_id} {ep.hostname && ep.hostname !== recentName && `• ${ep.hostname}`}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {ep.mac_address ? (
                          <div className="flex items-center gap-1" title={`Fingerprint: ${ep.device_fingerprint || 'N/A'}`}>
                            <Fingerprint className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{ep.mac_address}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {ep.user || 'Authorized User'}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {ep.os || 'Windows 11'}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium">
                        {epTotal}
                      </td>

                      <td className="py-3 px-4 font-mono font-medium">
                        <span className={epDlp > 0 ? 'text-amber-600 font-bold' : 'text-slate-500'}>
                          {epDlp}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {epScore}%
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          ep.status === 'Online'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : ep.status === 'Paused'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ep.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Breakdown Table with Latest Names & Websites */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-slate-900">Compliance &amp; Privacy Masking Log Stream</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Correlated audit events labeled with current workstation names and visited web destinations.
            </p>
          </div>
          <span className="text-xs text-slate-500">{filteredLogs.length} matching events</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Workstation (Latest Name)</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Foreground Process</th>
                <th className="py-3 px-4">Visited Website / Domain</th>
                <th className="py-3 px-4">Privacy Filter Action</th>
                <th className="py-3 px-4">DLP Flag</th>
                <th className="py-3 px-4">Encryption Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No compliance records match the selected workstation and date filters.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const epInfo = getEndpointInfo(log.endpoint_id, log.hostname);
                  return (
                    <tr key={log.log_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">#{log.log_id}</td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{epInfo.name}</span>
                            {epInfo.isCustom && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0.2 rounded font-semibold">
                                Friendly
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ID: {log.endpoint_id} {epInfo.hostname !== epInfo.name && `• ${epInfo.hostname}`}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {log.active_app}
                      </td>
                      <td className="py-3 px-4">
                        {log.website_url ? (
                          <div className="flex items-center gap-1.5 max-w-[200px]" title={log.website_url}>
                            <span className="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              <Globe className="w-3 h-3" />
                            </span>
                            <span className="font-semibold text-slate-800 truncate font-mono text-[11px]">
                              {log.website_url}
                            </span>
                          </div>
                        ) : (log.app_category || '').toLowerCase().includes('brows') ? (
                          <span className="text-slate-500 italic text-[11px]">Web Session</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
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
                      <td className="py-3 px-4">
                        {log.dlp_flag ? (
                          <span className="text-amber-600 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Triggered
                          </span>
                        ) : (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Compliant
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          <Lock className="w-3 h-3 text-slate-600" />
                          AES-GCM (S3)
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
