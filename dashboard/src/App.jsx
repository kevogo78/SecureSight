import React, { useState, useEffect } from 'react';
import FleetStatusCard from './components/FleetStatusCard';
import ActivityHeatmap from './components/ActivityHeatmap';
import AuditLogTable from './components/AuditLogTable';
import ScreenshotModal from './components/ScreenshotModal';
import { getAuditLogs } from './services/api';
import { RefreshCw, Server, AlertCircle } from 'lucide-react';

export default function App() {
  const [logs, setLogs] = useState([]);
  const [selectedCapture, setSelectedCapture] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Fetch telemetry logs from the backend API
  const fetchTelemetry = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAuditLogs(50);
      setLogs(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch telemetry logs:', err);
      setError('Unable to retrieve logs from backend API. Please verify EC2 server status.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load and periodic polling every 10 seconds
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute aggregate metrics for summary display
  const maskedCount = logs.filter((log) => log.filter_status !== 'Clean').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Endpoint Observability & DLP Console
              </h1>
              <p className="text-xs text-slate-400">
                AWS Hybrid Fleet Telemetry &bull; Privacy by Design
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {lastUpdated && (
              <span className="text-xs text-slate-400 hidden sm:inline">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchTelemetry}
              disabled={isLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
              <span>{isLoading ? 'Polling...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {/* Error Notification Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/50 border border-red-800 text-red-300 text-sm flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Fleet KPI Metric Cards */}
        <FleetStatusCard totalLogs={logs.length} maskedCount={maskedCount} />

        {/* Activity & KPM Heatmap Timeline */}
        <section className="mb-8">
          <ActivityHeatmap logs={logs} />
        </section>

        {/* Real-Time Telemetry Audit Table */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Audit Log Feed</h2>
              <p className="text-xs text-slate-400">
                Live stream of keystroke activity indexes, foreground apps, and automated DLP masking events.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Showing {logs.length} records
            </span>
          </div>

          <AuditLogTable 
            logs={logs} 
            onViewCapture={(capture) => setSelectedCapture(capture)} 
          />
        </section>
      </main>

      {/* Presigned S3 Media Modal */}
      {selectedCapture && (
        <ScreenshotModal 
          capture={selectedCapture} 
          onClose={() => setSelectedCapture(null)} 
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 text-center text-xs text-slate-500">
        Privacy-Centric Endpoint Observability System &bull; Deployed on AWS EC2, RDS PostgreSQL, and S3
      </footer>
    </div>
  );
}