import React, { useState } from 'react';
import { 
  Settings, Key, Shield, Sliders, RefreshCw, Copy, Check, 
  Plus, Trash2, Globe, Wifi, CheckCircle2, AlertCircle, Save,
  FileText, Video, Lock, AlertTriangle
} from 'lucide-react';
import { checkBackendHealth } from '../../services/api';

export default function SettingsView() {
  const [pollingInterval, setPollingInterval] = useState(10);
  const [screenshotTicks, setScreenshotTicks] = useState(6);
  const [cryptoKey, setCryptoKey] = useState('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  // New Toggles: Capture keys to text file & Record session
  const [captureKeysToFile, setCaptureKeysToFile] = useState(() => {
    try {
      const stored = localStorage.getItem('edmt_capture_keys_to_file');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const [keylogFilePath, setKeylogFilePath] = useState('agent/keystrokes_audit.txt');

  // Blacklist state matching agent/config/blacklist.json
  const [blacklistedProcesses, setBlacklistedProcesses] = useState([
    'keepass.exe', '1password.exe', 'bitwarden.exe', 'banking_portal.exe'
  ]);
  const [blacklistedTitles, setBlacklistedTitles] = useState([
    'chase online banking', 'bank of america', 'wellsfargo', 'password manager', 'credential'
  ]);
  const [newProcess, setNewProcess] = useState('');
  const [newTitle, setNewTitle] = useState('');

  // DLP rule toggles
  const [maskCreditCards, setMaskCreditCards] = useState(true);
  const [maskSSN, setMaskSSN] = useState(true);
  const [maskPasswords, setMaskPasswords] = useState(true);

  // Diagnostics state
  const [backendUrl, setBackendUrl] = useState('http://127.0.0.1:8000');
  const [pingStatus, setPingStatus] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  const handleCopyKey = () => {
    navigator.clipboard.writeText(cryptoKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateNewKey = () => {
    const chars = '0123456789abcdef';
    let key = '';
    for (let i = 0; i < 64; i++) {
      key += chars[Math.floor(Math.random() * chars.length)];
    }
    setCryptoKey(key);
  };

  const addProcess = (e) => {
    e.preventDefault();
    if (newProcess.trim() && !blacklistedProcesses.includes(newProcess.trim().toLowerCase())) {
      setBlacklistedProcesses([...blacklistedProcesses, newProcess.trim().toLowerCase()]);
      setNewProcess('');
    }
  };

  const removeProcess = (proc) => {
    setBlacklistedProcesses(blacklistedProcesses.filter(p => p !== proc));
  };

  const addTitle = (e) => {
    e.preventDefault();
    if (newTitle.trim() && !blacklistedTitles.includes(newTitle.trim().toLowerCase())) {
      setBlacklistedTitles([...blacklistedTitles, newTitle.trim().toLowerCase()]);
      setNewTitle('');
    }
  };

  const removeTitle = (title) => {
    setBlacklistedTitles(blacklistedTitles.filter(t => t !== title));
  };

  const handlePing = async () => {
    setIsPinging(true);
    setPingStatus(null);
    const result = await checkBackendHealth();
    setIsPinging(false);
    setPingStatus(result);
  };

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('edmt_capture_keys_to_file', String(captureKeysToFile));
      localStorage.setItem('edmt_keylog_path', keylogFilePath);
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-slate-900">System &amp; Privacy Configuration</h3>
          <p className="text-xs text-slate-500">
            Manage endpoint polling intervals, keystroke capture options, session video recordings, and active DLP inspection rules.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saved ? 'Changes Saved' : 'Save Fleet Configuration'}</span>
        </button>
      </div>

      {/* NEW SECTION: Keystroke File Capture & Session Recording Toggles */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <FileText className="w-5 h-5 text-emerald-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Keystroke Capture &amp; Session Screen Recording Controls</h4>
            <p className="text-xs text-slate-500">Toggle whether client workstations write keystrokes to text files or stream session recordings.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Toggle 1: Capture keys to a text file */}
          <div className={`p-4 rounded-xl border transition ${
            captureKeysToFile ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2.5 cursor-pointer font-bold text-xs text-slate-900">
                <input
                  type="checkbox"
                  checked={captureKeysToFile}
                  onChange={(e) => setCaptureKeysToFile(e.target.checked)}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                />
                <span>Capture Keys to a Text File</span>
              </label>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                captureKeysToFile ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-600'
              }`}>
                {captureKeysToFile ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
              When enabled, keystrokes are recorded directly to a local text file on the endpoint machine before privacy filtration.
            </p>

            {captureKeysToFile && (
              <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                <label className="block text-[11px] font-semibold text-slate-700">Target Output Text File Path:</label>
                <input
                  type="text"
                  value={keylogFilePath}
                  onChange={(e) => setKeylogFilePath(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-mono text-slate-800"
                />
                <p className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3 h-3" />
                  Warning: Text file contains unmasked keypress data for diagnostic auditing.
                </p>
              </div>
            )}
          </div>

          {/* Video recording is configured on the endpoint, not in browser storage. */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <h4 className="font-bold text-xs text-slate-900">Video Recordings</h4>
            <p className="text-[11px] text-slate-600 mt-2">The agent records 15-second clips every 5 minutes after consent, at up to 720p and 2 FPS without audio. Pause/revoke on the endpoint stops recording.</p>
            <p className="text-[11px] text-slate-500 mt-2">Review uploaded clips from the endpoint's Video Recordings button. Recording settings are configured on the agent.</p>
          </div>
        </div>
      </div>

      {/* Grid of Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Agent Polling & Timers */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <Sliders className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">Agent Telemetry Timing</h4>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Telemetry Reporting Frequency</span>
              <span className="text-emerald-600 font-bold">{pollingInterval} seconds</span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              step="2"
              value={pollingInterval}
              onChange={(e) => setPollingInterval(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">Interval between endpoint HTTP POST payloads to FastAPI.</p>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
              <span>Encrypted Screenshot Trigger</span>
              <span className="text-emerald-600 font-bold">Every {screenshotTicks} ticks ({screenshotTicks * pollingInterval}s)</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={screenshotTicks}
              onChange={(e) => setScreenshotTicks(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-400 mt-1">Screen buffers are redacted in memory before S3 upload.</p>
          </div>
        </div>

        {/* Section 2: Cryptographic Engine Settings */}
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <Key className="w-5 h-5 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">AES-256-GCM Master Encryption Key</h4>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">Active Key Hex (256-bit)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={cryptoKey}
                className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyKey}
                title="Copy Key"
                className="p-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 transition cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Shared between client agent and dashboard for verifiable decrypting.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={generateNewKey}
              className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Regenerate Random 256-bit Key</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 3: Privacy Blacklist Manager */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <Shield className="w-5 h-5 text-emerald-600" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Privacy Filter Blacklist Manager</h4>
            <p className="text-xs text-slate-500">
              When matched, foreground capture is instantly suspended and screenshots are suppressed.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Blacklisted Executables */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-700">Blacklisted Process Executables</h5>
            <form onSubmit={addProcess} className="flex gap-2">
              <input
                type="text"
                value={newProcess}
                onChange={(e) => setNewProcess(e.target.value)}
                placeholder="e.g. keepass.exe"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              {blacklistedProcesses.map((proc) => (
                <span
                  key={proc}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-mono border border-slate-200"
                >
                  {proc}
                  <button onClick={() => removeProcess(proc)} className="text-slate-400 hover:text-red-500 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Blacklisted Window Titles */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-slate-700">Blacklisted Window Title Keywords</h5>
            <form onSubmit={addTitle} className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. chase online banking"
                className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-1">
              {blacklistedTitles.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-800 rounded-md text-xs font-semibold border border-amber-200"
                >
                  {t}
                  <button onClick={() => removeTitle(t)} className="text-amber-500 hover:text-red-500 cursor-pointer">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* DLP Rule Toggles */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <h5 className="text-xs font-bold text-slate-700">Real-time DLP Pattern Redaction</h5>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={maskCreditCards}
                onChange={(e) => setMaskCreditCards(e.target.checked)}
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">Credit Card Masks (16-digit)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={maskSSN}
                onChange={(e) => setMaskSSN(e.target.checked)}
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">Social Security Masks (SSN)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 p-3 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={maskPasswords}
                onChange={(e) => setMaskPasswords(e.target.checked)}
                className="accent-emerald-600 w-4 h-4 rounded cursor-pointer"
              />
              <span className="font-semibold text-slate-800">Credentials &amp; API Keys</span>
            </label>
          </div>
        </div>
      </div>

      {/* Section 4: Backend API & AWS Health Check */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-900">Backend API Diagnostics</h4>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={backendUrl}
            onChange={(e) => setBackendUrl(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
          />
          <button
            type="button"
            onClick={handlePing}
            disabled={isPinging}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>{isPinging ? 'Pinging API...' : 'Test Backend /health'}</span>
          </button>
        </div>

        {pingStatus && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
            pingStatus.connected 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            {pingStatus.connected ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="font-bold">
                {pingStatus.connected ? 'FastAPI Service Operational' : 'FastAPI Offline / Using Telemetry Cache'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                {pingStatus.connected
                  ? `Response latency: ${pingStatus.latency}ms â€¢ Status: ${pingStatus.data?.status || 'healthy'}`
                  : `Notice: ${pingStatus.error}. Dashboard active via cached telemetry.`
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
