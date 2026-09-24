import React from 'react';
import { Activity, ShieldAlert, Cpu } from 'lucide-react';

export default function ActivityHeatmap({ logs = [] }) {
  // Sort logs chronologically to display oldest to newest in the timeline
  const timelineLogs = [...logs].reverse();

  // Helper to calculate color intensity based on Keystrokes Per Minute (KPM)
  const getCellColor = (keystrokes, filterStatus) => {
    if (filterStatus !== 'Clean') {
      return 'bg-amber-500/80 border-amber-400 text-amber-950'; // Privacy/Masked indicator
    }
    if (keystrokes === 0) return 'bg-slate-800 border-slate-700 text-slate-500'; // Idle
    if (keystrokes < 40) return 'bg-emerald-950/60 border-emerald-800 text-emerald-400'; // Low activity
    if (keystrokes < 90) return 'bg-emerald-800/80 border-emerald-600 text-emerald-200'; // Moderate activity
    return 'bg-emerald-500 border-emerald-300 text-emerald-950 font-bold'; // High activity
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Activity className="text-emerald-400 w-5 h-5" />
          <h3 className="text-lg font-semibold text-white">Activity Index & DLP Timeline</h3>
        </div>
        <div className="flex items-center space-x-4 text-xs text-slate-400">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></span>
            <span>Idle (0 KPM)</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-800/80 border border-emerald-600"></span>
            <span>Active</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-300"></span>
            <span>High Intensity</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500 border border-amber-400"></span>
            <span>Privacy Masked</span>
          </div>
        </div>
      </div>

      {timelineLogs.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No telemetry cycles recorded yet. Awaiting agent check-in.
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
          {timelineLogs.map((log) => {
            const timeString = new Date(log.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });

            return (
              <div
                key={log.log_id}
                className={`relative group rounded border p-2 flex flex-col justify-between transition-all hover:scale-105 cursor-pointer ${getCellColor(
                  log.keystrokes,
                  log.filter_status
                )}`}
              >
                <div className="flex justify-between items-start">
                  <span className="text-[10px] opacity-80">{timeString}</span>
                  {log.filter_status !== 'Clean' && (
                    <ShieldAlert className="w-3 h-3 text-amber-950 flex-shrink-0" />
                  )}
                </div>

                <div className="mt-2">
                  <p className="text-xs truncate font-mono">{log.active_app || 'Unknown'}</p>
                  <p className="text-sm tracking-tight">{log.keystrokes} KPM</p>
                </div>

                {/* Hover Tooltip Card */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-30 w-48 p-2.5 bg-slate-900 border border-slate-700 rounded shadow-xl text-left pointer-events-none">
                  <p className="text-xs font-semibold text-white border-b border-slate-700 pb-1 mb-1">
                    Node {log.endpoint_id} • {timeString}
                  </p>
                  <p className="text-[11px] text-slate-300 truncate">
                    <span className="text-slate-400">App:</span> {log.active_app}
                  </p>
                  <p className="text-[11px] text-slate-300">
                    <span className="text-slate-400">Volume:</span> {log.keystrokes} Keystrokes
                  </p>
                  <p className="text-[11px] text-slate-300">
                    <span className="text-slate-400">Filter Status:</span>{' '}
                    <span
                      className={
                        log.filter_status === 'Clean' ? 'text-emerald-400' : 'text-amber-400 font-medium'
                      }
                    >
                      {log.filter_status}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}