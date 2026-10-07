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
  
  // Data State - Enforce consent policy: Only endpoints that granted consent are loaded
  const [endpoints, setEndpoints] = useState(() => getConsentedEndpoints());
  const [selectedEndpoint, setSelectedEndpoint] = useState(() => {
    const list = getConsentedEndpoints();
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
        const currentMap = new Map();

        // 1. Preserve existing endpoints in local state that are not kicked
        prevEndpoints.forEach(ep => {
          const epId = String(ep.endpoint_id);
          if (!kicked.includes(epId)) {
            currentMap.set(epId, { ...ep });
          }
        });

        // 2. Ingest endpoints from the dedicated backend /endpoints API (consent-registered machines)
        if (Array.isArray(endpointsData)) {
          endpointsData.forEach(ep => {
            const epId = String(ep.endpoint_id);
            if (kicked.includes(epId)) return;
            const existing = currentMap.get(epId);
            const resolvedIp = ep.ipAddress || ep.ip_address || (existing && existing.ipAddress) || `192.168.1.${100 + (Number(epId) % 150)}`;
            const isPaused = ep.status === 'Paused' || ep.consent_paused === true || (existing && (existing.status === 'Paused' || existing.consent_paused === true));
            if (existing) {
              currentMap.set(epId, {
                ...existing,
                ...ep,
                ipAddress: resolvedIp,
                consent_granted: true,
                consent_paused: isPaused,
                status: isPaused ? 'Paused' : (ep.status || existing.status || 'Online')
              });
            } else {
              currentMap.set(epId, {
                ...ep,
                ipAddress: resolvedIp,
                consent_granted: true,
                consent_paused: isPaused,
                status: isPaused ? 'Paused' : (ep.status || 'Online')
              });
            }
          });
        }

        // 3. Auto-discover and enrich active endpoints dynamically from telemetry audit logs
        if (Array.isArray(logsData)) {
          logsData.forEach(log => {
            const epId = String(log.endpoint_id);
            if (kicked.includes(epId)) return;

            const existing = currentMap.get(epId);
            const isLogPaused = (log.activity_state === 'Privacy_Suspended' && log.filter_status === 'User_Suspended');
            const resolvedIp = log.ip_address || (existing && existing.ipAddress) || `192.168.1.${100 + (Number(epId) % 150)}`;

            if (existing) {
              const currentStatus = isLogPaused ? 'Paused' : (existing.status || 'Online');
              currentMap.set(epId, {
                ...existing,
                ipAddress: resolvedIp,
                cpu: log.cpu_percent !== undefined ? log.cpu_percent : existing.cpu,
                ram: log.ram_percent !== undefined ? log.ram_percent : existing.ram,
                app: log.active_app || existing.app,
                category: log.app_category || existing.category,
                lastSeen: 'Just now',
                lastSeenDate: log.timestamp || new Date().toISOString(),
                status: currentStatus,
                consent_paused: isLogPaused || existing.consent_paused || currentStatus === 'Paused'
              });
            } else {
              const isMac = (log.os_type || '').toLowerCase().includes('mac');
              const newEp = {
                endpoint_id: log.endpoint_id,
                name: log.hostname || (log.endpoint_id === 2 ? 'MACBOOK-PRO-M2' : `WORKSTATION-EP${log.endpoint_id}`),
                user: log.user || 'Authorized User',
                os: log.os_type || (isMac ? 'macOS 14.5 Sonoma' : 'Windows 11 Enterprise'),
                osType: isMac ? 'mac' : 'win',
                agent_ver: '1.0.0',
                status: isLogPaused ? 'Paused' : 'Online',
                lastSeen: 'Just now',
                lastSeenDate: log.timestamp || new Date().toISOString(),
                ipAddress: resolvedIp,
                uptime: 'Active Session',
                cpu: log.cpu_percent || 12.0,
                ram: log.ram_percent || 45.0,
                disk: 42,
                network: '14 Mbps',
                app: log.active_app || 'Agent Active',
                category: log.app_category || 'Development',
                consent_granted: true,
                consent_paused: isLogPaused,
                consent_timestamp: log.timestamp || new Date().toISOString()
              };
              currentMap.set(epId, newEp);
            }
          });
        }

        const merged = Array.from(currentMap.values());
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
      setActiveTab('endpoints');
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
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'endpoints' && endpoints.length > 0 && !selectedEndpoint) {
            setSelectedEndpoint(endpoints[0]);
          }
        }}
        onLogout={handleLogout}
        endpointsCount={endpoints.length}
      />

      {/* ================= MAIN VIEWPORT ================= */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar Header */}
        <Header
          user={auth}
          onLogout={handleLogout}
          onNavigate={setActiveTab}
          logs={logs}
        />

        {/* Scrollable View Area */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {activeTab === 'dashboard' && (
            <FleetOverviewView
              endpoints={endpoints}
              logs={logs}
              onSelectEndpoint={handleSelectEndpoint}
              onNavigate={setActiveTab}
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
            />
          )}

          {activeTab === 'endpoint-detail' && (
            <EndpointDetailView
              endpoint={selectedEndpoint || endpoints[0]}
              onBack={() => setActiveTab('endpoints')}
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
