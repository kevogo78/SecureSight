import React from 'react';
import { 
  LayoutDashboard, Monitor, Activity,
  FileText, Settings, LogOut, Radio 
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, onLogout, endpointsCount = 4 }) {
  return (
    <aside className="w-64 bg-[#0a2312] text-white flex flex-col justify-between shrink-0 shadow-xl font-sans">
      <div>
        {/* Brand Header */}
        <div className="px-4 py-5 border-b border-emerald-900/40">
          <h1 className="sr-only">SecureSight</h1>
          <img src="/branding/securesight-logo.png" alt="SecureSight — Visibility. Security. Control." className="w-full h-auto" />
          <p className="text-[10px] text-center text-emerald-400 font-semibold tracking-wider uppercase">Endpoint Observability</p>
        </div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1.5">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-[#22c55e] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </div>
          </button>

          <button
            onClick={() => onTabChange('endpoints')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'endpoints' || activeTab === 'endpoint-detail'
                ? 'bg-[#22c55e] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Monitor className="w-5 h-5" />
              <span>Endpoints</span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 font-mono font-bold">
              {endpointsCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('activity')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-[#22c55e] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Activity className="w-5 h-5" />
              <span>Activity</span>
            </div>
          </button>

          <button
            onClick={() => onTabChange('reports')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-[#22c55e] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <FileText className="w-5 h-5" />
              <span>Reports</span>
            </div>
          </button>

          <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-[#22c55e] text-slate-950 shadow-md shadow-emerald-500/20'
                : 'text-slate-300 hover:bg-emerald-950/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </div>
          </button>
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-emerald-900/40">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="w-10 h-10 rounded-xl bg-[#13381e] border border-emerald-500/30 flex items-center justify-center font-black text-sm text-emerald-300 shadow-inner">
            AD
          </div>
          <div>
            <div className="text-sm font-bold text-white">Administrator</div>
            <div className="text-xs text-emerald-400 font-semibold">Active Session</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full mt-2 flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:bg-red-950/40 hover:border-red-900/40 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-red-400" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
