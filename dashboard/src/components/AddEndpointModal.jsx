import React, { useState } from 'react';
import { X, Monitor, Plus, Copy, Check, Terminal, Shield } from 'lucide-react';

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

          {/* Setup Command Snippet */}
          <div className="mt-4 p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Terminal className="w-3.5 h-3.5" />
                Workstation Onboarding Script
              </span>
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
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
