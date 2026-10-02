import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ScreenshotModal from './components/ScreenshotModal';
import AddEndpointModal from './components/AddEndpointModal';
import SessionPlayerModal from './components/SessionPlayerModal';
import ConsentModal from './components/ConsentModal';

import FleetOverviewView from './components/views/FleetOverviewView';
import EndpointsView from './components/views/EndpointsView';
import EndpointDetailView from './components/views/EndpointDetailView';
import ActivityView from './components/views/ActivityView';
import ReportsView from './components/views/ReportsView';
import SettingsView from './components/views/SettingsView';

import { getAuditLogs, getConsentedEndpoints, saveConsentedEndpoints, INITIAL_LOGS } from './services/api';

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
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);

  // Fetch telemetry logs on mount
  useEffect(() => {
    if (auth) {
      loadTelemetryLogs();
    }
  }, [auth]);

  const loadTelemetryLogs = async () => {
    setIsRefreshing(true);
    try {
      const data = await getAuditLogs(100);
      if (Array.isArray(data) && data.length > 0) {
        setLogs(data);

        // Update latest endpoint app and metrics from logs
        setEndpoints((prevEndpoints) => {
          return prevEndpoints.map((ep) => {
            const matchingLog = data.find(
              (l) => l.endpoint_id === ep.endpoint_id || String(l.endpoint_id) === String(ep.endpoint_id)
            );
            if (matchingLog) {
              return {
                ...ep,
                cpu: matchingLog.cpu_percent !== undefined ? matchingLog.cpu_percent : ep.cpu,
                ram: matchingLog.ram_percent !== undefined ? matchingLog.ram_percent : ep.ram,
                app: matchingLog.active_app || ep.app,
                category: matchingLog.app_category || ep.category,
                lastSeen: 'Just now'
              };
            }
            return ep;
          });
        });
      }
    } catch (err) {
      console.warn('Using baseline telemetry cache:', err);
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

  const handleAcceptConsent = (newEndpoint) => {
    setEndpoints((prev) => {
      const filtered = prev.filter(
        ep => ep.name !== newEndpoint.name && String(ep.endpoint_id) !== String(newEndpoint.endpoint_id)
      );
      const updated = [newEndpoint, ...filtered];
      saveConsentedEndpoints(updated);
      return updated;
    });
    setSelectedEndpoint(newEndpoint);
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
          if (tab === 'endpoints' && endpoints.length > 0) {
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
              onOpenConsentModal={() => setIsConsentModalOpen(true)}
            />
          )}

          {activeTab === 'endpoints' && (
            <EndpointsView
              endpoints={endpoints}
              onSelectEndpoint={handleSelectEndpoint}
              onOpenAddModal={() => setIsAddEndpointOpen(true)}
              onOpenConsentModal={() => setIsConsentModalOpen(true)}
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

      {/* 4. Native Agent Consent UI Modal */}
      <ConsentModal
        isOpen={isConsentModalOpen}
        onClose={() => setIsConsentModalOpen(false)}
        onAcceptConsent={handleAcceptConsent}
      />
    </div>
  );
}