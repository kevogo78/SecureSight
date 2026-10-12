import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ScreenshotModal from './components/ScreenshotModal';
import AddEndpointModal from './components/AddEndpointModal';
import SessionPlayerModal from './components/SessionPlayerModal';

import FleetOverviewView from './components/views/FleetOverviewView';
import EndpointsView from './components/views/EndpointsView';
import EndpointDetailView from './components/views/EndpointDetailView';
import ActivityView from './components/views/ActivityView';
import ReportsView from './components/views/ReportsView';
import SettingsView from './components/views/SettingsView';

import { 
  getAuditLogs, 
  fetchEndpoints,
  getConsentedEndpoints, 
  saveConsentedEndpoints, 
  getKickedEndpointIds,
  kickEndpointApi,
  pauseEndpointApi,
  resumeEndpointApi,
  INITIAL_LOGS 
} from './services/api';

export default function App() {
  // Authentication State (Persisted in localStorage)
  const [auth, setAuth] = useState(() => {
    try {
      const stored = localStorage.getItem('edmt_auth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [endpointsViewMode, setEndpointsViewMode] = useState('all');

  const handleNavigate = (tab, subMode = 'all') => {
    setActiveTab(tab);
    if (tab === 'endpoints') {
      setEndpointsViewMode(subMode);
      if (endpoints.length > 0 && !selectedEndpoint) {
        setSelectedEndpoint(endpoints[0]);
      }
    }
  };
  
  // Data State - Enforce consent policy: Only real endpoints that granted consent are loaded
  const [endpoints, setEndpoints] = useState(() => {
    const list = getConsentedEndpoints();
    return list.filter(e => e.name !== 'WORKSTATION-WIN11' && e.name !== 'MACBOOK-PRO-M2' && !String(e.name || '').toLowerCase().includes('ubuntu'));
  });
  const [selectedEndpoint, setSelectedEndpoint] = useState(() => {
    const list = getConsentedEndpoints().filter(e => e.name !== 'WORKSTATION-WIN11' && e.name !== 'MACBOOK-PRO-M2' && !String(e.name || '').toLowerCase().includes('ubuntu'));
    return list.length > 0 ? list[0] : null;
  });
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [activeCapture, setActiveCapture] = useState(null);
  const [isAddEndpointOpen, setIsAddEndpointOpen] = useState(false);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);

  // Polling loop: fetch endpoints and telemetry logs every 5 seconds when authenticated
  useEffect(() => {
    if (!auth) return;

    loadTelemetryLogs();
    const intervalId = setInterval(() => {
      loadTelemetryLogs();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [auth]);

  // Keep selected endpoint valid if endpoints change
  useEffect(() => {
    if (endpoints.length > 0 && (!selectedEndpoint || !endpoints.find(e => String(e.endpoint_id) === String(selectedEndpoint.endpoint_id)))) {
      setSelectedEndpoint(endpoints[0]);
    }
  }, [endpoints]);

  const loadTelemetryLogs = async () => {
    setIsRefreshing(true);
    try {
      const kicked = getKickedEndpointIds();
      const [endpointsData, logsData] = await Promise.all([
        fetchEndpoints(),
        getAuditLogs(100)
      ]);

      if (Array.isArray(logsData)) {
        setLogs(logsData);
      }

      setEndpoints((prevEndpoints) => {
        const now = Date.now();
        const incomingList = Array.isArray(endpointsData) && endpointsData.length > 0 
          ? endpointsData 
          : prevEndpoints;

        const map = new Map();

        incomingList.forEach(ep => {
          const epId = String(ep.endpoint_id);
          if (kicked.includes(epId)) return;
          if (ep.name && (ep.name === 'WORKSTATION-WIN11' || ep.name === 'MACBOOK-PRO-M2' || ep.name.toLowerCase().includes('ubuntu'))) return;

          const lastSeenTs = ep.lastSeenDate ? new Date(ep.lastSeenDate).getTime() : 0;
          const isStale = (now - lastSeenTs) > 40000; // 40 seconds timeout
          const isPaused = ep.status === 'Paused' || ep.consent_paused === true || ep.consent_status === 'Paused';

          let computedStatus = 'Offline';
          if (!isStale) {
            computedStatus = isPaused ? 'Paused' : (ep.status === 'Offline' ? 'Offline' : 'Online');
          }

          let relativeLastSeen = ep.lastSeen || 'Just now';
          if (lastSeenTs > 0) {
            const diffSec = Math.max(0, Math.round((now - lastSeenTs) / 1000));
            if (diffSec < 15) relativeLastSeen = 'Just now';
            else if (diffSec < 60) relativeLastSeen = `${diffSec}s ago`;
            else if (diffSec < 3600) relativeLastSeen = `${Math.floor(diffSec / 60)}m ago`;
            else if (diffSec < 86400) relativeLastSeen = `${Math.floor(diffSec / 3600)}h ago`;
            else relativeLastSeen = `${Math.floor(diffSec / 86400)}d ago`;
          }

          // Enrich with matching telemetry audit logs if present
          let epCpu = ep.cpu;
          let epRam = ep.ram;
          let epApp = ep.app;
          let epCategory = ep.category;
          let epIp = ep.ipAddress || ep.ip_address || `192.168.1.${100 + (Number(epId) % 150)}`;

          if (Array.isArray(logsData)) {
            const matchingLogs = logsData.filter(l => String(l.endpoint_id) === epId);
            if (matchingLogs.length > 0) {
              const latest = matchingLogs[0];
              if (latest.cpu_percent !== undefined) epCpu = latest.cpu_percent;
              if (latest.ram_percent !== undefined) epRam = latest.ram_percent;
              if (latest.active_app) epApp = latest.active_app;
              if (latest.app_category) epCategory = latest.app_category;
              if (latest.ip_address) epIp = latest.ip_address;
            }
          }

          map.set(epId, {
            ...ep,
            ipAddress: epIp,
            ip_address: epIp,
            status: computedStatus,
            lastSeen: relativeLastSeen,
            cpu: computedStatus === 'Offline' ? 0.0 : (epCpu || 0.0),
            ram: computedStatus === 'Offline' ? 0.0 : (epRam || 0.0),
            app: computedStatus === 'Offline' ? 'Idle / Disconnected' : (epApp || 'Agent Active'),
            category: epCategory || 'Development',
            consent_granted: true,
            consent_paused: isPaused,
            consent_status: isPaused ? 'Paused' : 'Granted'
          });
        });

        const merged = Array.from(map.values());
        saveConsentedEndpoints(merged);
        return merged;
      });
    } catch (err) {
      console.warn('Fleet data refresh notice:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogin = (authData) => {
    setAuth(authData);
    try {
      localStorage.setItem('edmt_auth', JSON.stringify(authData));
    } catch (e) {
      console.warn('Failed to persist auth:', e);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    try {
      localStorage.removeItem('edmt_auth');
    } catch (e) {
      console.warn('Failed to clear auth:', e);
    }
  };

  const handleKickEndpoint = async (endpointId) => {
    await kickEndpointApi(endpointId);
    setEndpoints((prev) => {
      const remaining = prev.filter(ep => String(ep.endpoint_id) !== String(endpointId));
      saveConsentedEndpoints(remaining);
      return remaining;
    });
    if (selectedEndpoint && String(selectedEndpoint.endpoint_id) === String(endpointId)) {
      setSelectedEndpoint(null);
      handleNavigate('endpoints', 'all');
    }
  };

  const handleTogglePauseEndpoint = async (endpointId) => {
    let nowPaused = false;
    setEndpoints((prev) => {
      const updated = prev.map(ep => {
        if (String(ep.endpoint_id) === String(endpointId)) {
          const currentlyPaused = ep.status === 'Paused' || ep.consent_paused === true;
          nowPaused = !currentlyPaused;
          return {
            ...ep,
            status: nowPaused ? 'Paused' : 'Online',
            consent_paused: nowPaused,
            consent_status: nowPaused ? 'Paused' : 'Granted'
          };
        }
        return ep;
      });
      saveConsentedEndpoints(updated);
      return updated;
    });

    try {
      if (nowPaused) {
        await pauseEndpointApi(endpointId);
      } else {
        await resumeEndpointApi(endpointId);
      }
    } catch (e) {
      console.warn('Error syncing pause state with backend:', e);
    }
  };

  const handleAddEndpoint = (newEp) => {
    const consentedEp = {
      ...newEp,
      consent_granted: true,
      consent_timestamp: new Date().toISOString()
    };
    setEndpoints((prev) => {
      const filtered = prev.filter(
        ep => ep.name !== consentedEp.name && String(ep.endpoint_id) !== String(consentedEp.endpoint_id)
      );
      const updated = [consentedEp, ...filtered];
      saveConsentedEndpoints(updated);
      return updated;
    });
    setSelectedEndpoint(consentedEp);
  };
  const handleSelectEndpoint = (ep) => {
    setSelectedEndpoint(ep);
    setActiveTab('endpoint-detail');
  };

  // If not logged in, render the Administrator Login Page
  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex min-h-screen bg-[#f1f5f9] font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* ================= SIDEBAR ================= */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => handleNavigate(tab, 'all')}
        onLogout={handleLogout}
        endpointsCount={endpoints.filter(e => !e.kicked && (e.status === 'Online' || e.status === 'Paused')).length}
      />

      {/* ================= MAIN VIEWPORT ================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar Header */}
        <Header
          user={auth}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {activeTab === 'dashboard' && (
            <FleetOverviewView
              endpoints={endpoints}
              logs={logs}
              onSelectEndpoint={handleSelectEndpoint}
              onNavigate={handleNavigate}
              onRefresh={loadTelemetryLogs}
              isRefreshing={isRefreshing}
              onViewScreenshot={setActiveCapture}
            />
          )}

          {activeTab === 'endpoints' && (
            <EndpointsView
              endpoints={endpoints}
              onSelectEndpoint={handleSelectEndpoint}
              onKickEndpoint={handleKickEndpoint}
              onTogglePauseEndpoint={handleTogglePauseEndpoint}
              logs={logs}
              initialViewMode={endpointsViewMode}
            />
          )}

          {activeTab === 'endpoint-detail' && (
            <EndpointDetailView
              endpoint={selectedEndpoint || endpoints[0]}
              onBack={() => handleNavigate('endpoints', 'all')}
              logs={logs}
              onViewScreenshot={setActiveCapture}
              onViewRecording={() => setIsRecordingModalOpen(true)}
              onKickEndpoint={handleKickEndpoint}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityView
              logs={logs}
              endpoints={endpoints}
              onViewScreenshot={setActiveCapture}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              logs={logs}
              endpoints={endpoints}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </div>
      </main>

      {/* ================= MODALS ================= */}
      {/* 1. S3 Decrypted Screenshot Evidence Modal */}
      {activeCapture && (
        <ScreenshotModal
          capture={activeCapture}
          onClose={() => setActiveCapture(null)}
        />
      )}

      {/* 2. Add New Workstation Endpoint Modal */}
      <AddEndpointModal
        isOpen={isAddEndpointOpen}
        onClose={() => setIsAddEndpointOpen(false)}
        onAddEndpoint={handleAddEndpoint}
      />

      {/* 3. Encrypted Session Screen Stream Player Modal */}
      <SessionPlayerModal
        isOpen={isRecordingModalOpen}
        onClose={() => setIsRecordingModalOpen(false)}
        endpointName={selectedEndpoint?.name || 'WORKSTATION-WIN11'}
      />
    </div>
  );
}
