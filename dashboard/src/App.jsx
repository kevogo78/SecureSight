import React, { useState } from 'react';
import { 
  Shield, LayoutDashboard, Monitor, Activity, FileText, Settings, LogOut,
  Search, Bell, Plus, ExternalLink, ChevronRight, ArrowDown, ArrowUp,
  Cpu, HardDrive, Wifi, Radio, Power, Eye, Globe, Key, Camera, Video,
  Clock, CheckCircle2, AlertCircle, FileSpreadsheet, Download, Trash2
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('endpoints'); // 'dashboard', 'endpoints', 'endpoint-detail', 'activity'
  const [selectedEndpoint, setSelectedEndpoint] = useState('KEVIN-PC');

  // Sample Endpoints List
  const endpoints = [
    { name: 'John-PC', user: 'John', os: 'Windows 11', osType: 'win', status: 'Online', lastSeen: '2 minutes ago', cpu: '29%', ram: '62%', app: 'Google Chrome', icon: 'chrome' },
    { name: 'PC-102', user: 'Marketing', os: 'Windows 11', osType: 'win', status: 'Offline', lastSeen: '2 hours ago', cpu: '35%', ram: '24%', app: 'Microsoft Word', icon: 'word' },
    { name: 'PC-103', user: 'IT', os: 'Ubuntu 22.04', osType: 'linux', status: 'Online', lastSeen: '5 minutes ago', cpu: '18%', ram: '42%', app: 'Wireshark', icon: 'terminal' },
    { name: 'PC-104', user: 'HR', os: 'macOS Sonoma', osType: 'mac', status: 'Online', lastSeen: '12 minutes ago', cpu: '33%', ram: '32%', app: 'Google Chrome', icon: 'chrome' },
    { name: 'PC-105', user: 'Sales', os: 'Windows 11', osType: 'win', status: 'Offline', lastSeen: '5 hours ago', cpu: '31%', ram: '57%', app: 'Adobe Photoshop', icon: 'photoshop' },
    { name: 'Kevin-PC', user: 'Kevin', os: 'Windows 10', osType: 'win', status: 'Online', lastSeen: '1 minute ago', cpu: '27%', ram: '33%', app: 'Outlook', icon: 'outlook' },
    { name: 'PC-107', user: 'Finance', os: 'Windows 11', osType: 'win', status: 'Online', lastSeen: '8 minutes ago', cpu: '21%', ram: '48%', app: 'Microsoft Excel', icon: 'excel' },
    { name: 'PC-108', user: 'Design', os: 'Windows 10', osType: 'win', status: 'Online', lastSeen: '3 minutes ago', cpu: '16%', ram: '38%', app: 'Figma', icon: 'figma' },
    { name: 'PC-109', user: 'Operations', os: 'macOS Sonoma', osType: 'mac', status: 'Online', lastSeen: '9 minutes ago', cpu: '42%', ram: '71%', app: 'Microsoft Teams', icon: 'teams' },
    { name: 'PC-110', user: 'Support', os: 'Windows 11', osType: 'win', status: 'Offline', lastSeen: '7 hours ago', cpu: '12%', ram: '28%', app: 'Slack', icon: 'slack' }
  ];

  const activityData = [
    { name: 'Application', value: 430, color: '#166534' },
    { name: 'Website', value: 312, color: '#22c55e' },
    { name: 'File', value: 506, color: '#86efac' }
  ];

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] font-sans text-slate-800">
      {/* ================= SIDEBAR ================= */}
      <aside className="w-64 bg-[#0a2312] text-white flex flex-col justify-between shrink-0 shadow-lg">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-6 py-6 border-b border-emerald-900/40">
            <div className="p-2 rounded-xl bg-emerald-500 text-black">
              <Shield className="w-6 h-6 fill-black stroke-emerald-500" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">Privacy Monitor</h1>
              <p className="text-xs text-emerald-400/80">Endpoint Monitoring</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeTab === 'dashboard' ? 'bg-[#22c55e] text-white shadow-sm' : 'text-slate-300 hover:bg-emerald-950/60'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('endpoints')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeTab === 'endpoints' || activeTab === 'endpoint-detail'
                  ? 'bg-[#22c55e] text-white shadow-sm'
                  : 'text-slate-300 hover:bg-emerald-950/60'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span>Endpoints</span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition ${
                activeTab === 'activity' ? 'bg-[#22c55e] text-white shadow-sm' : 'text-slate-300 hover:bg-emerald-950/60'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span>Activity</span>
            </button>

            <button
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-950/60 transition"
            >
              <FileText className="w-5 h-5" />
              <span>Reports</span>
            </button>

            <button
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-emerald-950/60 transition"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-emerald-900/40">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="w-10 h-10 rounded-full bg-[#1b4329] border border-emerald-500/30 flex items-center justify-center font-bold text-sm text-emerald-300">
              JD
            </div>
            <div>
              <div className="text-sm font-semibold">John Doe</div>
              <div className="text-xs text-emerald-400/70">Administrator</div>
            </div>
          </div>
          <button className="w-full mt-2 flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white rounded-md hover:bg-emerald-950/40 transition">
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {/* Top Navbar */}
        <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-slate-200">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Good Morning, John!</h2>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Today is Friday, September 4, 2026</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search endpoints..." 
                className="pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-64"
              />
            </div>
            <button className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 relative">
              <Bell className="w-4 h-4" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" />
            </button>
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                JD
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-bold leading-tight">John Doe</div>
                <div className="text-[11px] text-slate-500">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        {/* VIEW 1: ENDPOINTS LIST (EDMT-UI1) */}
        {(activeTab === 'dashboard' || activeTab === 'endpoints') && (
          <div className="p-8 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Total Endpoints</div>
                  <div className="text-3xl font-black text-[#15803d] mt-2">16</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                  <Monitor className="w-7 h-7" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Online Endpoints</div>
                  <div className="text-3xl font-black text-[#16a34a] mt-2">12</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                  <Radio className="w-7 h-7" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Offline Endpoints</div>
                  <div className="text-3xl font-black text-slate-900 mt-2">4</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                  <Power className="w-7 h-7" />
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Active Applications</div>
                  <div className="text-3xl font-black text-[#16a34a] mt-2">8</div>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
                  <LayoutDashboard className="w-7 h-7" />
                </div>
              </div>
            </div>

            {/* Table Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Endpoints</h3>
                <div className="flex items-center gap-3">
                  <select className="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none">
                    <option>All Statuses</option>
                    <option>Online</option>
                    <option>Offline</option>
                  </select>
                  <button className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm">
                    <Plus className="w-4 h-4" />
                    <span>Add Endpoint</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="py-3.5 px-4">Computer Name</th>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Operating System</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Last Seen</th>
                      <th className="py-3.5 px-4">CPU</th>
                      <th className="py-3.5 px-4">RAM</th>
                      <th className="py-3.5 px-4">Active Application</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {endpoints.map((ep, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4 flex items-center gap-2 font-semibold text-slate-900">
                          <Monitor className="w-4 h-4 text-slate-500" />
                          <span>{ep.name}</span>
                        </td>
                        <td className="py-3.5 px-4">{ep.user}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="font-semibold text-[10px] text-blue-600">■</span>
                            {ep.os}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span className={`w-2 h-2 rounded-full ${ep.status === 'Online' ? 'bg-[#22c55e]' : 'bg-red-500'}`} />
                            {ep.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{ep.lastSeen}</td>
                        <td className="py-3.5 px-4">{ep.cpu}</td>
                        <td className="py-3.5 px-4">{ep.ram}</td>
                        <td className="py-3.5 px-4 flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-600">●</span>
                          <span>{ep.app}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button 
                            onClick={() => { setSelectedEndpoint(ep.name.toUpperCase()); setActiveTab('endpoint-detail'); }}
                            className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold text-xs transition"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination Footer */}
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>Showing 1–10 of 16 endpoints</div>
                <div className="flex items-center gap-1">
                  <button className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50">‹</button>
                  <button className="px-2.5 py-1 rounded bg-[#22c55e] text-white font-bold">1</button>
                  <button className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50">2</button>
                  <button className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50">›</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: INDIVIDUAL ENDPOINT DETAIL (EDMT-UI2) */}
        {activeTab === 'endpoint-detail' && (
          <div className="p-8 space-y-6">
            {/* Breadcrumb Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <button onClick={() => setActiveTab('endpoints')} className="hover:underline">Endpoints</button>
                <ChevronRight className="w-3.5 h-3.5" />
                <span className="text-slate-900 font-bold">{selectedEndpoint}</span>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 font-semibold shadow-sm">
                <span>Sep 4, 2026</span>
              </div>
            </div>

            {/* Device Identity Card */}
            <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 rounded-xl text-slate-800">
                  <Monitor className="w-9 h-9" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black tracking-tight">{selectedEndpoint}</h3>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ● Online
                    </span>
                  </div>
                  <div className="flex items-center gap-8 text-xs text-slate-500 mt-2">
                    <div>User: <span className="font-semibold text-slate-800">Kevin</span></div>
                    <div>Operating System: <span className="font-semibold text-slate-800">Windows 11</span></div>
                    <div>Last Seen: <span className="font-semibold text-slate-800">Sep 4, 2026 2:34 PM</span></div>
                    <div>IP Address: <span className="font-semibold text-slate-800">192.168.1.101</span></div>
                    <div>Uptime: <span className="font-semibold text-slate-800">3 hours 12 minutes</span></div>
                  </div>
                </div>
              </div>
              <button className="text-slate-400 hover:text-slate-600">···</button>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-6 border-b border-slate-200 text-xs font-bold text-slate-500">
              <button className="pb-3 border-b-2 border-emerald-500 text-emerald-600">Activity</button>
              <button className="pb-3 hover:text-slate-800">Applications</button>
              <button className="pb-3 hover:text-slate-800">Websites</button>
              <button className="pb-3 hover:text-slate-800">File Activity</button>
              <button className="pb-3 hover:text-slate-800">Keylogs</button>
              <button className="pb-3 hover:text-slate-800">Screenshots & Recordings</button>
              <button className="pb-3 hover:text-slate-800">System Usage</button>
            </div>

            {/* Resource Gauges */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>CPU Usage</span>
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="text-3xl font-black mt-2">24%</div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                  <ArrowDown className="w-3 h-3" /> 12%
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Memory Usage</span>
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div className="text-3xl font-black mt-2">61%</div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                  <ArrowDown className="w-3 h-3" /> 8%
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Disk Usage</span>
                  <HardDrive className="w-4 h-4" />
                </div>
                <div className="text-3xl font-black mt-2">42%</div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5 mt-1">
                  <ArrowDown className="w-3 h-3" /> 5%
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 text-xs">
                  <span>Network Usage</span>
                  <Wifi className="w-4 h-4" />
                </div>
                <div className="text-3xl font-black mt-2">12 Mbps</div>
                <div className="text-[11px] text-red-500 font-semibold flex items-center gap-0.5 mt-1">
                  <ArrowUp className="w-3 h-3" /> 3%
                </div>
              </div>
            </div>

            {/* Split Grid: Recent Activity vs Applications & Websites */}
            <div className="grid grid-cols-3 gap-6">
              {/* Left Column: Recent Activity Feed */}
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                <h4 className="font-bold text-sm text-slate-900 mb-4">Recent Activity</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100">
                        <th className="pb-3 font-semibold">Time</th>
                        <th className="pb-3 font-semibold">Type</th>
                        <th className="pb-3 font-semibold">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-slate-600">
                      <tr>
                        <td className="py-2.5">2:33 PM</td>
                        <td className="py-2.5 font-medium">Application</td>
                        <td className="py-2.5 text-slate-900 font-semibold">Google Chrome (active)</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:28 PM</td>
                        <td className="py-2.5 font-medium">Website</td>
                        <td className="py-2.5 text-blue-600">youtube.com</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:25 PM</td>
                        <td className="py-2.5 font-medium">File</td>
                        <td className="py-2.5">Opened: Project_Report.docx</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:20 PM</td>
                        <td className="py-2.5 font-medium">Application</td>
                        <td className="py-2.5 text-slate-900">Visual Studio Code</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:18 PM</td>
                        <td className="py-2.5 font-medium">Website</td>
                        <td className="py-2.5 text-blue-600">stackoverflow.com</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:15 PM</td>
                        <td className="py-2.5 font-medium">File</td>
                        <td className="py-2.5">Downloaded: lab_instructions.pdf</td>
                      </tr>
                      <tr>
                        <td className="py-2.5">2:10 PM</td>
                        <td className="py-2.5 font-medium">Application</td>
                        <td className="py-2.5 text-slate-900">Microsoft Teams</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Active App & Usage Meters */}
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="font-bold text-slate-900">Current Active Application</span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold">Active</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-blue-600">
                      G
                    </div>
                    <div>
                      <div className="text-sm font-bold">Google Chrome</div>
                      <div className="text-xs text-slate-500">Active for 12 minutes</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Top Applications (Today)</span>
                    <button className="text-emerald-600 font-bold hover:underline">View All</button>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Google Chrome</span>
                        <span>3h 12m</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#22c55e] h-full rounded-full" style={{ width: '80%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>Visual Studio Code</span>
                        <span>1h 24m</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#22c55e] h-full rounded-full" style={{ width: '45%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1">
                        <span>File Explorer</span>
                        <span>52m</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#22c55e] h-full rounded-full" style={{ width: '25%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Action Tiles */}
            <div className="grid grid-cols-3 gap-6 pt-2">
              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-slate-600" />
                  <div>
                    <div className="text-xs font-bold">View Keylogs</div>
                    <div className="text-[11px] text-slate-400">See typed activity and keystrokes</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-slate-600" />
                  <div>
                    <div className="text-xs font-bold">View Screenshots</div>
                    <div className="text-[11px] text-slate-400">Browse captured screenshots</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition">
                <div className="flex items-center gap-3">
                  <Video className="w-5 h-5 text-slate-600" />
                  <div>
                    <div className="text-xs font-bold">View Recordings</div>
                    <div className="text-[11px] text-slate-400">Watch screen recordings</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: ACTIVITY DASHBOARD (EDMT-UI3) */}
        {activeTab === 'activity' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold tracking-tight text-slate-900">Activity</h3>
                <p className="text-xs text-slate-500">View and analyze endpoint activity across all devices.</p>
              </div>
              <div className="flex items-center gap-3">
                <select className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white">
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                </select>
                <select className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-white">
                  <option>All Endpoints</option>
                  <option>Kevin-PC</option>
                </select>
              </div>
            </div>

            {/* Metric Counters */}
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Total Events</div>
                  <div className="text-3xl font-black text-[#15803d] mt-2">1,248</div>
                </div>
                <FileText className="w-7 h-7 text-slate-700" />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Application Events</div>
                  <div className="text-3xl font-black text-[#16a34a] mt-2">430</div>
                </div>
                <Monitor className="w-7 h-7 text-slate-700" />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">Website Visits</div>
                  <div className="text-3xl font-black text-[#16a34a] mt-2">312</div>
                </div>
                <Globe className="w-7 h-7 text-slate-700" />
              </div>

              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-slate-500">File Events</div>
                  <div className="text-3xl font-black text-[#16a34a] mt-2">506</div>
                </div>
                <FileSpreadsheet className="w-7 h-7 text-slate-700" />
              </div>
            </div>

            {/* Split Grid: Event Log Table vs Doughnut Chart */}
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
                  Recent Activity
                </div>
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Endpoint</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    <tr>
                      <td className="py-3 px-4">9:42 AM</td>
                      <td className="py-3 px-4 font-semibold">John-PC</td>
                      <td className="py-3 px-4">John</td>
                      <td className="py-3 px-4">Application</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">Google Chrome (active)</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">9:40 AM</td>
                      <td className="py-3 px-4 font-semibold">PC-102</td>
                      <td className="py-3 px-4">Marketing</td>
                      <td className="py-3 px-4">Website</td>
                      <td className="py-3 px-4 text-blue-600">youtube.com</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">9:38 AM</td>
                      <td className="py-3 px-4 font-semibold">PC-103</td>
                      <td className="py-3 px-4">IT</td>
                      <td className="py-3 px-4">File</td>
                      <td className="py-3 px-4">Opened: budget.xlsx</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">9:36 AM</td>
                      <td className="py-3 px-4 font-semibold">Kevin-PC</td>
                      <td className="py-3 px-4">Kevin</td>
                      <td className="py-3 px-4">System</td>
                      <td className="py-3 px-4">Windows Update</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4">9:34 AM</td>
                      <td className="py-3 px-4 font-semibold">PC-104</td>
                      <td className="py-3 px-4">HR</td>
                      <td className="py-3 px-4">Website</td>
                      <td className="py-3 px-4 text-blue-600">indeed.com</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Activity by Type Chart Card */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                <h4 className="font-bold text-sm text-slate-900">Activity by Type</h4>
                <div className="h-44 relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activityData}
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {activityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute text-center">
                    <div className="text-lg font-black text-slate-900">1,248</div>
                    <div className="text-[10px] text-slate-400 font-semibold">Total Events</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#166534]" /> Application
                    </span>
                    <span className="font-semibold text-slate-600">430 (34%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> Website
                    </span>
                    <span className="font-semibold text-slate-600">312 (25%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#86efac]" /> File
                    </span>
                    <span className="font-semibold text-slate-600">506 (41%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}