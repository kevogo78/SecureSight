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

  saveConsentedEndpoints,
  getKickedEndpointIds,
  kickEndpointApi,
  fetchEndpoints
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
  const [endpoints, setEndpoints] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [activeCapture, setActiveCapture] = useState(null);
  const [isAddEndpointOpen, setIsAddEndpointOpen] = useState(false);
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);

  // Polling loop: fetch telemetry logs every 5 seconds when authenticated
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
      const [data, registeredEndpoints] = await Promise.all([
        getAuditLogs(100),
        fetchEndpoints()
      ]);
      setLogs(data);
      setEndpoints(registeredEndpoints);
    } catch (err) {
      console.warn('Failed to load live telemetry:', err);
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

  const handleAddEndpoint = () => {
    // Enrollment completes on the device after the agent receives consent.
    loadTelemetryLogs();
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
              onOpenAddModal={() => setIsAddEndpointOpen(true)}
              onKickEndpoint={handleKickEndpoint}
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
