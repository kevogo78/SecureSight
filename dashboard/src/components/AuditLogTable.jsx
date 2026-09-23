import React from 'react';

export default function AuditLogTable({ logs }) {
  return (
    <div className="overflow-x-auto bg-slate-800 border border-slate-700 rounded-lg">
      <table className="min-w-full divide-y divide-slate-700 text-sm text-left">
        <thead className="bg-slate-900/50 text-slate-400 uppercase font-medium">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Host ID</th>
            <th className="px-4 py-3">Foreground App</th>
            <th className="px-4 py-3">Keystroke Index</th>
            <th className="px-4 py-3">Status Filter</th>
            <th className="px-4 py-3">Evidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700 text-slate-300">
          {logs.map((log) => (
            <tr key={log.log_id} className="hover:bg-slate-700/50">
              <td className="px-4 py-3 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
              <td className="px-4 py-3 font-mono">NODE-{log.endpoint_id}</td>
              <td className="px-4 py-3 font-semibold text-white">{log.active_app}</td>
              <td className="px-4 py-3">{log.keystrokes} KPM</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  log.filter_status === 'Clean' 
                    ? 'bg-green-900/50 text-green-300 border border-green-700' 
                    : 'bg-amber-900/50 text-amber-300 border border-amber-700'
                }`}>
                  {log.filter_status}
                </span>
              </td>
              <td className="px-4 py-3">
                {log.media_url ? (
                  <a 
                    href={log.media_url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-blue-400 underline hover:text-blue-300 text-xs"
                  >
                    View Capture (S3)
                  </a>
                ) : (
                  <span className="text-slate-500 text-xs italic">Suppressed</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}