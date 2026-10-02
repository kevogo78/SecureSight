import React, { useState } from 'react';
import { Monitor, Radio, Power, LayoutDashboard, Plus, ChevronRight, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';

export default function EndpointsView({ 
  endpoints = [], 
  onSelectEndpoint, 
  onOpenAddModal, 
  onOpenConsentModal,
  logs = []
}) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter endpoints by status
  const filteredEndpoints = endpoints.filter((ep) => {
    if (statusFilter === 'All') return true;
    return ep.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const totalPages = Math.ceil(filteredEndpoints.length / itemsPerPage) || 1;
  const paginatedEndpoints = filteredEndpoints.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Dynamic fleet metrics
  const totalCount = endpoints.length;
  const onlineCount = endpoints.filter(e => e.status === 'Online').length;
  const offlineCount = endpoints.filter(e => e.status === 'Offline').length;
  const uniqueAppsCount = new Set(endpoints.map(e => e.app).filter(Boolean)).size;

  return (
    <div className="p-8 space-y-6 font-sans">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">Authorized Endpoints</div>
            <div className="text-3xl font-black text-[#15803d] mt-2">{totalCount}</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Monitor className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">Online &amp; Streaming</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{onlineCount}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Radio className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">Offline / Suspended</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{offlineCount}</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <Power className="w-7 h-7" />
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200 flex items-center justify-between shadow-sm">
          <div>
            <div className="text-xs font-semibold text-slate-500">Active Applications</div>
            <div className="text-3xl font-black text-[#16a34a] mt-2">{uniqueAppsCount}</div>
          </div>
          <div className="p-3 bg-slate-100 rounded-xl text-slate-700">
            <LayoutDashboard className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Consent-Authorized Fleet Workstations</h3>
            <p className="text-xs text-slate-500">Only workstations with verified user consent are recorded and monitored</p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses ({totalCount})</option>
              <option value="Online">Online ({onlineCount})</option>
              <option value="Offline">Offline ({offlineCount})</option>
            </select>

            {/* Run Consent UI Button */}
            <button
              onClick={onOpenConsentModal}
              className="flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Run Agent Consent UI</span>
            </button>

            {/* Add Endpoint Button */}
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Endpoint</span>
            </button>
          </div>
        </div>

        {/* Empty State when no endpoints have run consent yet */}
        {endpoints.length === 0 ? (
          <div className="py-16 px-6 text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <UserCheck className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-900">No Authorized Endpoints Listed</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                By capstone privacy policy, endpoints do not appear in this portal unless a workstation user runs the 
                <strong> Agent Consent UI</strong> dialog and explicitly checks <em>"I acknowledge and authorize session monitoring"</em>.
              </p>
            </div>
            <div className="pt-2">
              <button
                onClick={onOpenConsentModal}
                className="inline-flex items-center gap-2 bg-[#22c55e] hover:bg-[#16a34a] text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Launch Agent Consent UI Now</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <th className="py-3.5 px-4">Computer Name</th>
                    <th className="py-3.5 px-4">Assigned User</th>
                    <th className="py-3.5 px-4">Operating System</th>
                    <th className="py-3.5 px-4">Consent Status</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Last Seen</th>
                    <th className="py-3.5 px-4">CPU %</th>
                    <th className="py-3.5 px-4">RAM %</th>
                    <th className="py-3.5 px-4">Active Application</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {paginatedEndpoints.map((ep) => (
                    <tr key={ep.endpoint_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4 text-slate-500 shrink-0" />
                          <span>{ep.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{ep.user}</td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className={`text-[10px] ${
                            ep.osType === 'win' ? 'text-blue-600' : 'text-slate-700'
                          }`}>■</span>
                          {ep.os}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          Granted
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <span className={`w-2 h-2 rounded-full ${ep.status === 'Online' ? 'bg-[#22c55e]' : 'bg-slate-400'}`} />
                          <span className={ep.status === 'Online' ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                            {ep.status}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{ep.lastSeen}</td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {ep.cpu > 0 ? `${ep.cpu}%` : '0%'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium">
                        {ep.ram > 0 ? `${ep.ram}%` : '0%'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 max-w-[180px] truncate">
                          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                          <span className="font-semibold text-slate-800 truncate">{ep.app || 'Agent Active'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => onSelectEndpoint(ep)}
                          className="px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-semibold text-xs transition cursor-pointer border border-emerald-200"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredEndpoints.length)} of {filteredEndpoints.length} endpoints
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx + 1}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-2.5 py-1 rounded font-bold cursor-pointer ${
                      currentPage === idx + 1 ? 'bg-[#22c55e] text-white' : 'border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
