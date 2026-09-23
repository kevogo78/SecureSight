import React from 'react';
import { ShieldCheck, Activity, EyeOff } from 'lucide-react';

export default function FleetStatusCard({ totalLogs, maskedCount }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center space-x-4">
        <Activity className="text-blue-400 w-8 h-8" />
        <div>
          <p className="text-sm text-slate-400">Total Telemetry Packets</p>
          <h3 className="text-2xl font-bold text-white">{totalLogs}</h3>
        </div>
      </div>
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center space-x-4">
        <ShieldCheck className="text-green-400 w-8 h-8" />
        <div>
          <p className="text-sm text-slate-400">Endpoint Health</p>
          <h3 className="text-2xl font-bold text-white">100% Operational</h3>
        </div>
      </div>
      <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex items-center space-x-4">
        <EyeOff className="text-amber-400 w-8 h-8" />
        <div>
          <p className="text-sm text-slate-400">Privacy Redactions</p>
          <h3 className="text-2xl font-bold text-white">{maskedCount}</h3>
        </div>
      </div>
    </div>
  );
}