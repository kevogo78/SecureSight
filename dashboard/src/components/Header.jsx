import React, { useState } from 'react';
import { LogOut, Settings, FileText } from 'lucide-react';

export default function Header({ 
  user, 
  onLogout, 
  onNavigate 
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Time of day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Dynamic formatted date
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200 font-sans relative z-30">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          {greeting}, {user?.displayName || 'Administrator'}!
        </h2>
        <p className="text-xs font-medium text-slate-500 mt-0.5">
          Today is {todayFormatted} • Privacy Observability Active
        </p>
      </div>

      <div className="flex items-center gap-4">
        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#0a2312] text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30 shadow-sm">
              AD
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold leading-tight text-slate-900">Administrator</div>
              <div className="text-[11px] text-emerald-600 font-semibold">Authorized</div>
            </div>
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 animate-fadeIn z-50">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-xs font-bold text-slate-900">Signed in as</p>
                <p className="text-xs text-slate-500 truncate">administrator@capstone.ggc</p>
              </div>
              <button
                onClick={() => { onNavigate('reports'); setShowProfileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition text-left cursor-pointer"
              >
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Compliance Reports</span>
              </button>
              <button
                onClick={() => { onNavigate('settings'); setShowProfileMenu(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition text-left cursor-pointer"
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span>Fleet Settings</span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
