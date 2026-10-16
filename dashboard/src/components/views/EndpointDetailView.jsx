import React, { useState } from 'react';
import { 
  Monitor, ChevronRight, Cpu, LayoutDashboard, HardDrive, Wifi, 
  ArrowDown, ArrowUp, Key, Camera, Video, Clock, CheckCircle2, 
  ShieldCheck, AlertTriangle, ExternalLink, Globe, FileText, ArrowLeft,
  UserX
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import ActivityHeatmap from '../ActivityHeatmap';

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
                (endpoint.status === 'Paused' || endpoint.consent_paused)
                  ? 'text-amber-800 bg-amber-50 border border-amber-300'
                  : endpoint.status === 'Online'
                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                    : 'text-slate-600 bg-slate-100'
              }`}>
                {(endpoint.status === 'Paused' || endpoint.consent_paused) ? 'â¸ Consent Paused' : `â— ${endpoint.status}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 mt-2">
              <div>Assigned User: <strong className="text-slate-800">{endpoint.user}</strong></div>
              <div>Operating System: <strong className="text-slate-800">{endpoint.os}</strong></div>
              <div>IP Address: <strong className="text-slate-800 font-mono">{endpoint.ipAddress || endpoint.ip_address || endpoint.ip || `192.168.1.${100 + (Number(endpoint.endpoint_id || 1) % 150)}`}</strong></div>
              <div>Session Uptime: <strong className="text-slate-800">{endpoint.uptime}</strong></div>
              <div>Agent Version: <strong className="text-slate-800 font-mono">{endpoint.agent_ver}</strong></div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={!endpointLogs.some(l => l.media_url)}
              onClick={() => onViewScreenshot(endpointLogs.find(l => l.media_url))}
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
          { id: 'timeline', label: 'Activity Index & DLP Timeline' },
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
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h4 className="font-bold text-sm text-slate-900 mb-4">Hardware Telemetry History</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetryHistory}>
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} unit="%" />
                  <Tooltip />
                  <Area type="monotone" dataKey="cpu" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#cpuGradient)" name="CPU %" />
                  <Area type="monotone" dataKey="ram" stroke="#0ea5e9" strokeWidth={2} fillOpacity={1} fill="url(#ramGradient)" name="RAM %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-1">Active Window &amp; DLP State</h4>
              <p className="text-xs text-slate-500 mb-4">Real-time foreground activity inspection</p>
              
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Foreground Process</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">{activeApp}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Application Classification</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{endpoint.category || 'Productivity'}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Local DLP Filter Status</div>
                  <div className="text-xs font-bold text-emerald-700 mt-0.5">
                    {latestLog.filter_status || 'Clean (Telemetry Streaming)'}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Keystroke Rate:</span>
              <strong className="text-slate-900">{latestLog.keystrokes || 0} KPM</strong>
            </div>
          </div>

          <div className="lg:col-span-3">
            <ActivityHeatmap logs={endpointLogs} />
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 2: APPLICATIONS */}
      {activeSubTab === 'applications' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-slate-900">Application Workload Distribution</h4>
          <div className="space-y-3">
            {appUsage.map((app, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    {app.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">{app.name}</div>
                    <div className="text-[11px] text-slate-500">{app.category}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-900">{app.duration}</div>
                  <div className="text-[11px] text-emerald-600 font-medium">{app.share}% of active session</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB CONTENT 3: ACTIVITY INDEX & DLP TIMELINE (Replaces Websites) */}
      {activeSubTab === 'timeline' && (
        <div className="space-y-4">
          <ActivityHeatmap logs={endpointLogs} />
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
              Launch Session Player â†’
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
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900">System Performance Metrics</h4>
            <span className="text-xs text-slate-500">Live Hardware Utilization (Updated every 5s)</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={telemetryHistory}>
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} unit="%" />
                <Tooltip />
                <Bar dataKey="cpu" fill="#22c55e" name="CPU %" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ram" fill="#0ea5e9" name="RAM %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
