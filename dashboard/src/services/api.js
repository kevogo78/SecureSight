import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 6000
});

// Default seed endpoints corresponding to database/seed.sql and project architecture
export const INITIAL_ENDPOINTS = [
  {
    endpoint_id: 1,
    name: 'WORKSTATION-WIN11',
    user: 'Kevin',
    os: 'Windows 11 Enterprise',
    osType: 'win',
    agent_ver: '1.0.0',
    status: 'Online',
    lastSeen: 'Just now',
    lastSeenDate: new Date().toISOString(),
    ipAddress: '192.168.1.101',
    uptime: '4 hours 18 minutes',
    cpu: 14.2,
    ram: 48.5,
    disk: 42,
    network: '14 Mbps',
    app: 'Code.exe',
    category: 'Development'
  },
  {
    endpoint_id: 2,
    name: 'MACBOOK-PRO-M2',
    user: 'analyst_demo',
    os: 'macOS 14.5 Sonoma',
    osType: 'mac',
    agent_ver: '1.0.0',
    status: 'Online',
    lastSeen: '4 minutes ago',
    lastSeenDate: new Date(Date.now() - 4 * 60000).toISOString(),
    ipAddress: '192.168.1.105',
    uptime: '1 day 6 hours',
    cpu: 12.1,
    ram: 41.2,
    disk: 36,
    network: '8 Mbps',
    app: 'Terminal',
    category: 'Development'
  },
  {
    endpoint_id: 3,
    name: 'UBUNTU-SRV-01',
    user: 'devops',
    os: 'Ubuntu 24.04 LTS',
    osType: 'linux',
    agent_ver: '1.0.0',
    status: 'Online',
    lastSeen: '12 minutes ago',
    lastSeenDate: new Date(Date.now() - 12 * 60000).toISOString(),
    ipAddress: '10.0.1.42',
    uptime: '5 days 11 hours',
    cpu: 8.4,
    ram: 28.0,
    disk: 54,
    network: '42 Mbps',
    app: 'dockerd',
    category: 'Infrastructure'
  },
  {
    endpoint_id: 4,
    name: 'FINANCE-PC-102',
    user: 'Auditor',
    os: 'Windows 11 Pro',
    osType: 'win',
    agent_ver: '1.0.0',
    status: 'Offline',
    lastSeen: '3 hours ago',
    lastSeenDate: new Date(Date.now() - 3 * 3600000).toISOString(),
    ipAddress: '192.168.1.118',
    uptime: '0 minutes',
    cpu: 0.0,
    ram: 0.0,
    disk: 65,
    network: '0 Mbps',
    app: 'Excel.exe',
    category: 'Productivity'
  }
];

// Fallback seed audit logs corresponding to database/seed.sql
export const INITIAL_LOGS = [
  {
    log_id: 101,
    endpoint_id: 1,
    timestamp: new Date(Date.now() - 1 * 60000).toISOString(),
    active_app: 'Code.exe',
    app_category: 'Development',
    keystrokes: 142,
    activity_state: 'Active',
    cpu_percent: 14.2,
    ram_percent: 48.5,
    filter_status: 'Clean',
    dlp_flag: false,
    media_url: null
  },
  {
    log_id: 102,
    endpoint_id: 1,
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    active_app: 'chrome.exe',
    app_category: 'Browsing',
    keystrokes: 45,
    activity_state: 'Active',
    cpu_percent: 8.5,
    ram_percent: 52.1,
    filter_status: 'Clean',
    dlp_flag: false,
    media_url: null
  },
  {
    log_id: 103,
    endpoint_id: 1,
    timestamp: new Date(Date.now() - 9 * 60000).toISOString(),
    active_app: 'chrome.exe',
    app_category: 'Browsing',
    keystrokes: 0,
    activity_state: 'Privacy_Suspended',
    cpu_percent: 5.2,
    ram_percent: 51.8,
    filter_status: 'Password_Control_Suppressed',
    dlp_flag: true,
    media_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1200&q=80'
  },
  {
    log_id: 104,
    endpoint_id: 2,
    timestamp: new Date(Date.now() - 14 * 60000).toISOString(),
    active_app: 'Terminal',
    app_category: 'Development',
    keystrokes: 98,
    activity_state: 'Active',
    cpu_percent: 12.1,
    ram_percent: 41.2,
    filter_status: 'Clean',
    dlp_flag: false,
    media_url: null
  },
  {
    log_id: 105,
    endpoint_id: 1,
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    active_app: 'Chase Online Banking - Chrome',
    app_category: 'Banking',
    keystrokes: 0,
    activity_state: 'Privacy_Suspended',
    cpu_percent: 6.8,
    ram_percent: 53.0,
    filter_status: 'Title_Blacklisted',
    dlp_flag: true,
    media_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80'
  },
  {
    log_id: 106,
    endpoint_id: 3,
    timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
    active_app: 'dockerd',
    app_category: 'Infrastructure',
    keystrokes: 18,
    activity_state: 'Active',
    cpu_percent: 8.4,
    ram_percent: 28.0,
    filter_status: 'Clean',
    dlp_flag: false,
    media_url: null
  },
  {
    log_id: 107,
    endpoint_id: 1,
    timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
    active_app: 'notepad.exe',
    app_category: 'Productivity',
    keystrokes: 120,
    activity_state: 'Privacy_Suspended',
    cpu_percent: 3.1,
    ram_percent: 47.9,
    filter_status: 'DLP_Credit_Card_Pattern',
    dlp_flag: true,
    media_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80'
  }
];

export const getAuditLogs = async (limit = 100) => {
  try {
    const response = await api.get(`/audit/logs?limit=${limit}`);
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data;
    }
    return INITIAL_LOGS;
  } catch (error) {
    console.warn('Backend API offline or unreachable, using local telemetry baseline:', error.message);
    return INITIAL_LOGS;
  }
};

export const checkBackendHealth = async () => {
  const startTime = performance.now();
  try {
    const res = await axios.get('/health', { timeout: 3000 });
    const latency = Math.round(performance.now() - startTime);
    return {
      connected: true,
      latency,
      data: res.data
    };
  } catch (error) {
    return {
      connected: false,
      latency: 0,
      error: error.message
    };
  }
};

export default api;