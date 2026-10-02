import React, { useState } from 'react';
import { X, Monitor, Plus, Copy, Check, Terminal, Shield, Download, Laptop } from 'lucide-react';

export default function AddEndpointModal({ isOpen, onClose, onAddEndpoint }) {
  const [hostname, setHostname] = useState('');
  const [userName, setUserName] = useState('');
  const [osType, setOsType] = useState('Windows 11 Pro');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!hostname.trim() || !userName.trim()) return;

    let iconType = 'win';
    if (osType.toLowerCase().includes('mac')) iconType = 'mac';
    if (osType.toLowerCase().includes('linux')) iconType = 'linux';

    const newEndpoint = {
      endpoint_id: Date.now(),
      name: hostname.trim().toUpperCase(),
      user: userName.trim(),
      os: osType,
      osType: iconType,
      agent_ver: '1.0.0',
      status: 'Online',
      lastSeen: 'Just now',
      lastSeenDate: new Date().toISOString(),
      ipAddress: `192.168.1.${Math.floor(Math.random() * 150) + 50}`,
      uptime: '12 minutes',
      cpu: Math.round(Math.random() * 20 + 5),
      ram: Math.round(Math.random() * 30 + 20),
      disk: Math.round(Math.random() * 40 + 20),
      network: '10 Mbps',
      app: 'AgentOrchestrator.exe',
      category: 'Agent System'
    };

    onAddEndpoint(newEndpoint);
    onClose();
  };

  const agentCommand = `python -m pip install -r agent\\Requirements.txt; python agent\\src\\main.py --endpoint-id "${hostname || 'NEW-ENDPOINT'}"`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(agentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Enroll New Endpoint</h3>
              <p className="text-xs text-slate-400">Register a client workstation into the observability fleet</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Workstation / Computer Name</label>
            <input
              type="text"
              required
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. WORKSTATION-DEV04"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Assigned User / Role</label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="e.g. Alice / Engineering"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Operating System</label>
              <select
                value={osType}
                onChange={(e) => setOsType(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Windows 11 Enterprise">Windows 11 Enterprise</option>
                <option value="Windows 11 Pro">Windows 11 Pro</option>
                <option value="Windows 10 Enterprise">Windows 10 Enterprise</option>
                <option value="macOS 14.5 Sonoma">macOS 14.5 Sonoma</option>
                <option value="Red Hat Enterprise Linux 9">Red Hat Enterprise Linux 9</option>
              </select>
            </div>
          </div>

          {/* Downloadable Installers Section */}
          <div className="mt-4 p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Download className="w-4 h-4 text-emerald-400" />
                Download Agent Installers for Test Devices
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">Consent UI Included</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Run directly on test machines to automatically install prerequisites and launch the Consent Authorization Dialog.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Windows Standalone EXE */}
              <a
                href="/downloads/EDMT_Agent_Windows.exe"
                download="EDMT_Agent_Windows.exe"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition font-semibold group"
              >
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Windows .EXE</div>
                    <div className="text-[10px] text-slate-400">Standalone (No Python needed)</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </a>

              {/* Mac 1-Click Command */}
              <a
                href="/downloads/install_agent_mac.command"
                download="install_agent_mac.command"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition font-semibold group"
              >
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-slate-300 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">macOS .COMMAND</div>
                    <div className="text-[10px] text-slate-400">Double-click in Finder</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </a>

              {/* Windows 1-Click Batch */}
              <a
                href="/downloads/install_agent_windows.bat"
                download="install_agent_windows.bat"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition font-semibold group"
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Windows .BAT</div>
                    <div className="text-[10px] text-slate-400">1-Click Auto Setup</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </a>

              {/* Complete Agent ZIP Package */}
              <a
                href="/downloads/EDMT_Agent_Package.zip"
                download="EDMT_Agent_Package.zip"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white transition font-semibold group"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                  <div className="text-left">
                    <div className="text-xs font-bold">Full Agent .ZIP</div>
                    <div className="text-[10px] text-slate-400">Windows + Mac Portable</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 shrink-0" />
              </a>
            </div>
          </div>

          {/* Setup Command Snippet */}
          <div className="mt-3 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Terminal className="w-3.5 h-3.5" />
                Workstation Onboarding Script (CLI)
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="font-mono text-[11px] text-slate-300 overflow-x-auto whitespace-pre-wrap p-2 bg-slate-900 rounded">
              {agentCommand}
            </pre>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll Workstation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
