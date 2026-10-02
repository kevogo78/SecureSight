import React, { useState } from 'react';
import { Search, Bell, Shield, LogOut, Settings, FileText, CheckCircle2, AlertTriangle, User } from 'lucide-react';

export default function Header({ 
  user, 
  onLogout, 
  onNavigate, 
  searchQuery, 
  setSearchQuery,
  logs = [] 
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);

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

  // Recent notification items derived from actual logs and fleet events
  const notifications = [
    {
      id: 1,
      title: 'DLP Incident Masked',
      desc: 'Password control input suppressed on WORKSTATION-WIN11',
      time: '9 mins ago',
      type: 'alert'
    },
    {
      id: 2,
      title: 'Title Blacklist Enforced',
      desc: 'Banking application foreground capture suspended',
      time: '25 mins ago',
      type: 'alert'
    },
    {
      id: 3,
      title: 'Endpoint Check-in Confirmed',
      desc: 'MACBOOK-PRO-M2 heartbeat acknowledged by FastAPI',
      time: '14 mins ago',
      type: 'info'
    },
    {
      id: 4,
      title: 'S3 Presigned Media Decrypted',
      desc: 'AES-256-GCM screenshot buffer verified',
      time: '1 hour ago',
      type: 'info'
    }
  ];

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
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search endpoints, apps, logs..." 
            className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64 text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button 
            onClick={() => { setShowNotifications(!showNotifications); setShowProfileMenu(false); }}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 relative cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5 ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn z-50">
              <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">Fleet Security Alerts</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={() => setUnreadCount(0)}
                    className="text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 hover:bg-slate-50 transition flex items-start gap-2.5">
                    {n.type === 'alert' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="text-xs font-bold text-slate-900">{n.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{n.desc}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{n.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  onClick={() => { onNavigate('activity'); setShowNotifications(false); }}
                  className="text-xs font-bold text-emerald-600 hover:underline cursor-pointer"
                >
                  View Full Event Stream →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button 
            onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
            className="flex items-center gap-3 pl-2 border-l border-slate-200 cursor-pointer"
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
