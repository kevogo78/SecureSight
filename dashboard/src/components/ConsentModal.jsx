import React, { useState } from 'react';
import { Shield, Check, X, AlertTriangle, Monitor, Laptop } from 'lucide-react';
import { WORKSTATION_PRESETS } from '../services/api';

export default function ConsentModal({ isOpen, onClose, onAcceptConsent }) {
  const [selectedPreset, setSelectedPreset] = useState('WORKSTATION-WIN11');
  const [customHostname, setCustomHostname] = useState('');
  const [customUser, setCustomUser] = useState('');
  const [customOs, setCustomOs] = useState('Windows 11 Enterprise');
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleAccept = () => {
    if (!consentAcknowledged) return;

    let targetEndpoint;
    if (selectedPreset === 'custom') {
      const name = (customHostname || 'NEW-WORKSTATION').trim().toUpperCase();
      const user = (customUser || 'Employee').trim();
      targetEndpoint = {
        endpoint_id: Date.now(),
        name,
        user,
        os: customOs,
        osType: customOs.toLowerCase().includes('mac') ? 'mac' : customOs.toLowerCase().includes('linux') ? 'linux' : 'win',
        agent_ver: '1.0.0',
        status: 'Online',
        lastSeen: 'Just now',
        lastSeenDate: new Date().toISOString(),
        ipAddress: `192.168.1.${Math.floor(Math.random() * 150) + 50}`,
        uptime: 'Just started',
        cpu: Math.round(Math.random() * 15 + 5),
        ram: Math.round(Math.random() * 30 + 30),
        disk: 40,
        network: '12 Mbps',
        app: 'AgentOrchestrator.exe',
        category: 'Client System',
        consent_granted: true,
        consent_timestamp: new Date().toISOString()
      };
    } else {
      const preset = WORKSTATION_PRESETS.find(p => p.name === selectedPreset) || WORKSTATION_PRESETS[0];
      targetEndpoint = {
        ...preset,
        status: 'Online',
        lastSeen: 'Just now',
        lastSeenDate: new Date().toISOString(),
        consent_granted: true,
        consent_timestamp: new Date().toISOString()
      };
    }

    onAcceptConsent(targetEndpoint);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Window matching PyQt6 ConsentModal */}
      <div className="relative z-10 w-full max-w-lg bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden flex flex-col text-slate-900">
        {/* Title Bar (Native UI look) */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700">Endpoint Monitoring &amp; Privacy Authorization</span>
          </div>
          <button onClick={onClose} className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            System Observability &amp; Consent Agreement
          </h3>

          <p className="leading-relaxed">
            This machine is subject to diagnostic and security monitoring. Data collected includes general application names, hardware usage metrics, and periodic activity frequency.
          </p>

          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-1.5 text-slate-700">
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">•</span> Keystroke characters are <strong>NOT</strong> recorded.
            </p>
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">•</span> Password fields and credential apps are masked automatically.
            </p>
            <p className="flex items-center gap-2 font-medium">
              <span className="text-emerald-600 font-bold">•</span> You may revoke consent at any time via the taskbar tray.
            </p>
          </div>

          {/* Workstation Target Selector */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block font-bold text-slate-800 mb-1">Select Workstation Running Agent:</label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSelectedPreset('WORKSTATION-WIN11')}
                className={`p-2 rounded-lg border font-semibold text-center cursor-pointer transition ${
                  selectedPreset === 'WORKSTATION-WIN11'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                WORKSTATION-WIN11 (Kevin)
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('MACBOOK-PRO-M2')}
                className={`p-2 rounded-lg border font-semibold text-center cursor-pointer transition ${
                  selectedPreset === 'MACBOOK-PRO-M2'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                MACBOOK-PRO-M2 (Analyst)
              </button>

              <button
                type="button"
                onClick={() => setSelectedPreset('custom')}
                className={`p-2 rounded-lg border font-semibold text-center cursor-pointer transition ${
                  selectedPreset === 'custom'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                + Custom PC Name
              </button>
            </div>

            {selectedPreset === 'custom' && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="PC Name (e.g. LAPTOP-DEV)"
                  value={customHostname}
                  onChange={(e) => setCustomHostname(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
                <input
                  type="text"
                  placeholder="User Name (e.g. John)"
                  value={customUser}
                  onChange={(e) => setCustomUser(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
                <select
                  value={customOs}
                  onChange={(e) => setCustomOs(e.target.value)}
                  className="px-2 py-1.5 border border-slate-300 rounded text-xs bg-white"
                >
                  <option value="Windows 11 Enterprise">Windows 11 Enterprise</option>
                  <option value="Windows 11 Pro">Windows 11 Pro</option>
                  <option value="macOS 14.5 Sonoma">macOS 14.5 Sonoma</option>
                </select>
              </div>
            )}
          </div>

          {/* Acknowledgement Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer font-bold text-slate-900 select-none">
              <input
                type="checkbox"
                checked={consentAcknowledged}
                onChange={(e) => setConsentAcknowledged(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
              <span>I acknowledge and authorize session monitoring</span>
            </label>
          </div>
        </div>

        {/* Buttons matching PyQt6 layout */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            Decline &amp; Exit
          </button>
          <button
            type="button"
            onClick={handleAccept}
            disabled={!consentAcknowledged}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              consentAcknowledged
                ? 'bg-[#22c55e] hover:bg-[#16a34a] text-white shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Start Monitoring</span>
          </button>
        </div>
      </div>
    </div>
  );
}
