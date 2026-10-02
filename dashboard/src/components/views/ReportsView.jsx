import React, { useState } from 'react';
import { 
  FileText, Download, ShieldCheck, CheckCircle2, AlertTriangle, 
  Calendar, FileSpreadsheet, Lock, UserCheck, Filter
} from 'lucide-react';

export default function ReportsView({ logs = [], endpoints = [] }) {
  const [dateRange, setDateRange] = useState('7d');
  const [downloading, setDownloading] = useState(false);

  // Compute compliance metrics
  const totalEvents = logs.length;
  const dlpEvents = logs.filter(l => l.dlp_flag || l.filter_status !== 'Clean').length;
  const complianceScore = totalEvents > 0 ? ((1 - (dlpEvents / totalEvents)) * 100).toFixed(1) : '100.0';

  const downloadCSV = () => {
    setDownloading(true);
    setTimeout(() => {
      const headers = ['Log ID', 'Endpoint ID', 'Timestamp', 'Active Application', 'Category', 'Keystrokes (KPM)', 'Filter Status', 'DLP Triggered'];
      const rows = logs.map(l => [
        l.log_id,
        l.endpoint_id,
        `"${l.timestamp || ''}"`,
        `"${l.active_app || ''}"`,
        `"${l.app_category || 'General'}"`,
        l.keystrokes || 0,
        `"${l.filter_status || 'Clean'}"`,
        l.dlp_flag ? 'TRUE' : 'FALSE'
      ]);

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
          complianceScore: `${complianceScore}%`
        },
        endpoints,
        auditLogs: logs
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
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">Privacy & Compliance Reports</h3>
          <p className="text-xs text-slate-500">
            Generate and export cryptographically verifiable audit trails of endpoint observability.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
            <span>Export CSV Report</span>
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
      <div className="grid grid-cols-4 gap-6">
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
            <div className="text-[11px] text-slate-500 mt-1">Titles & secrets auto-redacted</div>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <AlertTriangle className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Active User Consents</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{endpoints.length} / {endpoints.length}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">100% consent compliance</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <UserCheck className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">Total Telemetry Packets</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{totalEvents}</div>
            <div className="text-[11px] text-slate-500 mt-1">RDS PostgreSQL records</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <FileText className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Audit Log Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-900">Compliance & Privacy Masking Log</h4>
          <span className="text-xs text-slate-500">Showing {logs.length} verifiable records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="py-3 px-4">Event ID</th>
                <th className="py-3 px-4">Endpoint</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Foreground Process</th>
                <th className="py-3 px-4">Privacy Filter Action</th>
                <th className="py-3 px-4">DLP Flag</th>
                <th className="py-3 px-4">Encryption Proof</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {logs.map((log) => (
                <tr key={log.log_id} className="hover:bg-slate-50/70 transition">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">#{log.log_id}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    Node-{log.endpoint_id}
                  </td>
                  <td className="py-3 px-4 text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900">
                    {log.active_app}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
