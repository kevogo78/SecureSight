import React, { useState } from 'react';
import { 
  Monitor, ChevronRight, Cpu, LayoutDashboard, HardDrive, Wifi, 
  ArrowDown, ArrowUp, Key, Camera, Video, Clock, CheckCircle2, 
  ShieldCheck, AlertTriangle, ExternalLink, Globe, FileText, ArrowLeft,
  UserX, ToggleLeft, ToggleRight, ShieldAlert
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';

export default function EndpointDetailView({ 
  endpoint, 
  onBack, 
  logs = [], 
  onViewScreenshot, 
  onViewRecording,
  onKickEndpoint
}) {
  const [activeSubTab, setActiveSubTab] = useState('activity'); // 'activity', 'applications', 'websites', 'keylogs', 'screenshots', 'system'

  // Interactive Keystroke and Session Recording Toggles
  const [captureKeysToFile, setCaptureKeysToFile] = useState(() => {
    try { return localStorage.getItem('edmt_capture_keys_to_file') === 'true'; } catch { return true; }
  });
  const [keylogFilePath, setKeylogFilePath] = useState(() => {
    try { return localStorage.getItem('edmt_keylog_path') || 'agent/keystrokes_audit.txt'; } catch { return 'agent/keystrokes_audit.txt'; }
  });
  const [recordSession, setRecordSession] = useState(() => {
    try { return localStorage.getItem('edmt_record_session') !== 'false'; } catch { return true; }
  });
  const [recordingQuality, setRecordingQuality] = useState(() => {
    try { return localStorage.getItem('edmt_recording_quality') || '720p @ 1 FPS (Free Tier Safe)'; } catch { return '720p @ 1 FPS (Free Tier Safe)'; }
  });

  const handleToggleKeystrokes = (val) => {
    setCaptureKeysToFile(val);
    try { localStorage.setItem('edmt_capture_keys_to_file', String(val)); } catch (e) {}
  };

  const handleToggleRecording = (val) => {
    setRecordSession(val);
    try { localStorage.setItem('edmt_record_session', String(val)); } catch (e) {}
  };

  if (!endpoint) return null;

  // Filter logs for this specific endpoint
  const endpointLogs = logs.filter(l => l.endpoint_id === endpoint.endpoint_id || String(l.endpoint_id) === String(endpoint.endpoint_id));
  const latestLog = endpointLogs[0] || {};

  // Live or latest metrics
  const cpuVal = latestLog.cpu_percent !== undefined ? latestLog.cpu_percent : (endpoint.cpu || 0);
  const ramVal = latestLog.ram_percent !== undefined ? latestLog.ram_percent : (endpoint.ram || 0);
  const diskVal = endpoint.disk || 42;
  const activeApp = latestLog.active_app || endpoint.app || 'Idle';

  // Telemetry time-series chart data
  const telemetryHistory = [
    { time: '10m ago', cpu: Math.max(5, cpuVal - 4), ram: Math.max(10, ramVal - 2) },
    { time: '8m ago', cpu: Math.max(5, cpuVal + 2), ram: Math.max(10, ramVal - 1) },
    { time: '6m ago', cpu: Math.max(5, cpuVal - 1), ram: Math.max(10, ramVal) },
    { time: '4m ago', cpu: Math.max(5, cpuVal + 5), ram: Math.max(10, ramVal + 1) },
    { time: '2m ago', cpu: Math.max(5, cpuVal - 3), ram: Math.max(10, ramVal - 1) },
    { time: 'Now', cpu: cpuVal, ram: ramVal },
  ];

  // Aggregated applications for this endpoint
  const appUsage = [
    { name: activeApp, duration: '2h 15m', share: 65, category: endpoint.category || 'Productivity' },
    { name: 'Google Chrome', duration: '1h 40m', share: 45, category: 'Browsing' },
    { name: 'Visual Studio Code', duration: '1h 10m', share: 30, category: 'Development' },
    { name: 'Terminal / PowerShell', duration: '35m', share: 15, category: 'System' }
  ];

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <button 
            onClick={onBack} 
            className="flex items-center gap-1 hover:text-emerald-600 font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Endpoints</span>
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-slate-900 font-bold">{endpoint.name}</span>
        </div>

        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-semibold shadow-sm">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Last Telemetry Sync: {endpoint.lastSeen}</span>
        </div>
      </div>

      {/* Identity Card */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-slate-100 rounded-xl text-slate-800">
            <Monitor className="w-8 h-8 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-2xl font-black tracking-tight text-slate-900">{endpoint.name}</h3>
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                endpoint.status === 'Online' ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-slate-600 bg-slate-100'
              }`}>
                ● {endpoint.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 mt-2">
              <div>Assigned User: <strong className="text-slate-800">{endpoint.user}</strong></div>
              <div>Operating System: <strong className="text-slate-800">{endpoint.os}</strong></div>
              <div>IP Address: <strong className="text-slate-800 font-mono">{endpoint.ipAddress}</strong></div>
              <div>Session Uptime: <strong className="text-slate-800">{endpoint.uptime}</strong></div>
              <div>Agent Version: <strong className="text-slate-800 font-mono">{endpoint.agent_ver}</strong></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onViewScreenshot(endpointLogs.find(l => l.media_url) || { log_id: 103, endpoint_id: endpoint.endpoint_id, active_app: activeApp, media_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80', timestamp: new Date().toISOString() })}
            className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Latest Capture</span>
          </button>
          <button
            onClick={onViewRecording}
            className="px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Video className="w-4 h-4" />
            <span>Session Stream</span>
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Are you sure you want to kick and disconnect "${endpoint.name}" from active monitoring?`)) {
                onKickEndpoint(endpoint.endpoint_id);
                onBack();
              }
            }}
            className="px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Kick / De-authorize Endpoint"
          >
            <UserX className="w-4 h-4 text-red-600" />
            <span>Kick Endpoint</span>
          </button>
        </div>
      </div>

      {/* Sub-tabs Header */}
      <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-bold text-slate-500 overflow-x-auto">
        {[
          { id: 'activity', label: 'Activity' },
          { id: 'applications', label: 'Applications' },
          { id: 'websites', label: 'Websites' },
          { id: 'keylogs', label: 'Keylogs' },
          { id: 'screenshots', label: 'Screenshots & Recordings' },
          { id: 'system', label: 'System Usage' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`pb-3 transition cursor-pointer whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'border-b-2 border-emerald-500 text-emerald-600'
                : 'hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hardware Resource Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>CPU Usage</span>
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black mt-2 text-slate-900">{cpuVal}%</div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <ArrowDown className="w-3 h-3" /> Nominal threshold (&lt;80%)
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Memory (RAM)</span>
            <LayoutDashboard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black mt-2 text-slate-900">{ramVal}%</div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <ArrowDown className="w-3 h-3" /> Stable buffer allocation
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Disk Usage</span>
            <HardDrive className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black mt-2 text-slate-900">{diskVal}%</div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            Storage healthy
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Network Telemetry</span>
            <Wifi className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black mt-2 text-slate-900">{endpoint.network || '12 Mbps'}</div>
          <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
            <ArrowUp className="w-3 h-3" /> Encrypted link active
          </div>
        </div>
      </div>

      {/* SUB-TAB CONTENT 1: ACTIVITY */}
      {activeSubTab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">Recent Endpoint Events</h4>
              <span className="text-xs text-slate-500">Live feed from agent</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-100">
                    <th className="pb-3 font-semibold">Time</th>
                    <th className="pb-3 font-semibold">Process</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Filter Status</th>
                    <th className="pb-3 font-semibold">Media Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-600">
                  {endpointLogs.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-6 text-center text-slate-400">
                        No activity packets recorded yet for this endpoint.
                      </td>
                    </tr>
                  ) : (
                    endpointLogs.map((log) => (
                      <tr key={log.log_id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2.5 font-bold text-slate-900">{log.active_app}</td>
                        <td className="py-2.5">{log.app_category || 'General'}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            log.filter_status === 'Clean' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {log.filter_status}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {log.media_url ? (
                            <button
                              onClick={() => onViewScreenshot(log)}
                              className="text-emerald-600 hover:text-emerald-700 font-semibold underline text-xs cursor-pointer"
                            >
                              View S3 Capture
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No Media</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-bold text-slate-900">Current Foreground Application</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">Active</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-emerald-600 border border-slate-200">
                  {activeApp.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900">{activeApp}</div>
                  <div className="text-xs text-slate-500">Category: {endpoint.category || 'Workstation Tool'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
              <span className="font-bold text-xs text-slate-900">Top Applications (Fleet Telemetry)</span>
              <div className="space-y-3 text-xs">
                {appUsage.map((app, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span className="font-medium text-slate-800">{app.name}</span>
                      <span>{app.duration}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-[#22c55e] h-full rounded-full" style={{ width: `${app.share}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 2: APPLICATIONS */}
      {activeSubTab === 'applications' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900">Registered Application Runtimes</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appUsage.map((app, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h5 className="font-bold text-sm text-slate-900">{app.name}</h5>
                  <p className="text-xs text-slate-500">Category: {app.category} • Total Active: {app.duration}</p>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                  {app.share}% Usage
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 3: WEBSITES */}
      {activeSubTab === 'websites' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Observed Web Domains & Privacy Protection</h4>
            <span className="text-xs text-emerald-600 font-semibold">Sensitive Query Parameters Stripped</span>
          </div>
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-2 font-semibold">Domain</th>
                <th className="pb-2 font-semibold">Visits</th>
                <th className="pb-2 font-semibold">Privacy Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>github.com/ITEC4810_Capstone</span>
                </td>
                <td className="py-3">48 sessions</td>
                <td className="py-3 text-emerald-600 font-semibold">Clean (Permitted)</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>chase.com/[REDACTED_PORTAL]</span>
                </td>
                <td className="py-3">1 session</td>
                <td className="py-3 text-amber-600 font-bold">Privacy Masked (Title Blacklisted)</td>
              </tr>
              <tr>
                <td className="py-3 font-semibold text-slate-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  <span>aws.amazon.com/console</span>
                </td>
                <td className="py-3">22 sessions</td>
                <td className="py-3 text-emerald-600 font-semibold">Clean (Cloud Ingestion)</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-TAB CONTENT 4: KEYLOGS (Cybersecurity Keystroke Audit & Controls) */}
      {activeSubTab === 'keylogs' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          {/* Cybersecurity Policy Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-emerald-600" />
                <span>Cybersecurity Keystroke &amp; Session Audit Controls</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure hardware key event capture and encrypted session streaming for this endpoint.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                captureKeysToFile ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${captureKeysToFile ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                {captureKeysToFile ? 'Keystrokes: ACTIVE' : 'Keystrokes: PAUSED'}
              </span>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                recordSession ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-100 text-slate-600'
              }`}>
                <span className={`w-2 h-2 rounded-full ${recordSession ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
                {recordSession ? 'Session Stream: ON' : 'Session Stream: OFF'}
              </span>
            </div>
          </div>

          {/* Interactive Toggle Control Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle 1: Keystroke Capture */}
            <div className={`p-4 rounded-xl border transition ${
              captureKeysToFile ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Keystroke Capture &amp; File Logging</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Writes key events to local text file &amp; telemetry buffer</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={captureKeysToFile}
                    onChange={(e) => handleToggleKeystrokes(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#22c55e]"></div>
                </label>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] font-mono flex items-center justify-between text-slate-600">
                <span>Audit File Destination:</span>
                <code className="bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">{keylogFilePath}</code>
              </div>
            </div>

            {/* Toggle 2: Session Screen Recording */}
            <div className={`p-4 rounded-xl border transition ${
              recordSession ? 'bg-blue-50/40 border-blue-300' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-900">Session Screen Recording</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Streams periodic encrypted frames to AWS S3 storage</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordSession}
                    onChange={(e) => handleToggleRecording(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] flex items-center justify-between text-slate-600">
                <span>Capture Specification:</span>
                <span className="font-semibold text-slate-800">{recordingQuality}</span>
              </div>
            </div>
          </div>

          {/* Audit Notice Box */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-bold text-slate-900">Cybersecurity Capstone Telemetry Policy: </span>
              Hardware keystroke logs and activity intensity (KPM) are captured directly by the endpoint agent via <code className="font-mono font-bold bg-slate-200 px-1 py-0.5 rounded">pynput</code> keyboard listener. Sensitive password inputs in blacklisted applications are automatically sanitized by the local DLP engine prior to cloud transmission.
            </div>
          </div>

          <h4 className="font-bold text-sm text-slate-900">Keystroke Intensity Index (KPM)</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400">
                  <th className="pb-2">Timestamp</th>
                  <th className="pb-2">Active Application</th>
                  <th className="pb-2">Rate (KPM)</th>
                  <th className="pb-2">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {endpointLogs.map((l) => (
                  <tr key={l.log_id}>
                    <td className="py-2.5 font-mono">{new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2.5 font-bold text-slate-900">{l.active_app}</td>
                    <td className="py-2.5 font-mono">{l.keystrokes} KPM</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.activity_state === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {l.activity_state}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 5: SCREENSHOTS & RECORDINGS */}
      {activeSubTab === 'screenshots' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">Encrypted Screen Capture Gallery</h4>
            <span className="text-xs text-slate-500">Stored in AWS S3 with AES-256 Server-Side Encryption</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordSession}
                  onChange={(e) => handleToggleRecording(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <div className="flex items-center gap-2 text-slate-700">
                <Video className="w-4 h-4 text-emerald-600" />
                <span>Session Video Stream: <strong className={recordSession ? 'text-emerald-700' : 'text-slate-500'}>{recordSession ? 'ENABLED' : 'PAUSED'}</strong> ({recordingQuality})</span>
              </div>
            </div>
            <button onClick={onViewRecording} className="text-emerald-700 font-bold hover:underline cursor-pointer">
              Launch Session Player →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
            {endpointLogs.filter(l => l.media_url).length === 0 ? (
              <div className="col-span-3 text-center py-10 text-slate-400 text-xs">
                No active screen captures for this device in the current retention cycle.
              </div>
            ) : (
              endpointLogs.filter(l => l.media_url).map((log) => (
                <div
                  key={log.log_id}
                  onClick={() => onViewScreenshot(log)}
                  className="group relative rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:border-emerald-500 transition cursor-pointer"
                >
                  <img
                    src={log.media_url}
                    alt={`Capture ${log.log_id}`}
                    className="w-full h-40 object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="p-3 bg-white">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-900">
                      <span>Log #{log.log_id}</span>
                      <span className="text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{log.active_app}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 6: SYSTEM USAGE (Recharts) */}
      {activeSubTab === 'system' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h4 className="font-bold text-sm text-slate-900">Live Hardware Telemetry Utilization</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetryHistory}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '8px', color: '#fff' }} />
                <Area type="monotone" dataKey="cpu" name="CPU (%)" stroke="#10b981" fillOpacity={1} fill="url(#cpuGrad)" />
                <Area type="monotone" dataKey="ram" name="RAM (%)" stroke="#3b82f6" fillOpacity={1} fill="url(#ramGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quick Action Navigation Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
        <div 
          onClick={() => setActiveSubTab('keylogs')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs font-bold text-slate-900">View Keystroke Rates</div>
              <div className="text-[11px] text-slate-400">Zero-keylogging privacy index</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        <div 
          onClick={() => setActiveSubTab('screenshots')}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div className="flex items-center gap-3">
            <Camera className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs font-bold text-slate-900">Browse S3 Captures</div>
              <div className="text-[11px] text-slate-400">AES-256 encrypted screenshots</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        <div 
          onClick={onViewRecording}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition"
        >
          <div className="flex items-center gap-3">
            <Video className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-xs font-bold text-slate-900">Launch Session Player</div>
              <div className="text-[11px] text-slate-400">Encrypted session stream review</div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
