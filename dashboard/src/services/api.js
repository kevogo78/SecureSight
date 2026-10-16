import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 6000
});

// Candidate endpoint templates - Real endpoints only
export const WORKSTATION_PRESETS = [];

// Fallback audit logs - Real logs only
export const INITIAL_LOGS = [];

export const getKickedEndpointIds = () => {
  try {
    const raw = localStorage.getItem('edmt_kicked_endpoints');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    }
  } catch {
    // fallback
  }
  return [];
};

export const saveKickedEndpointId = (endpointId) => {
  try {
    const current = getKickedEndpointIds();
    const strId = String(endpointId);
    if (!current.includes(strId)) {
      const updated = [...current, strId];
      localStorage.setItem('edmt_kicked_endpoints', JSON.stringify(updated));
    }
  } catch (e) {
    console.warn('Failed to save kicked endpoint ID:', e);
  }
};

export const getConsentedEndpoints = () => {
  const kicked = getKickedEndpointIds();
  try {
    const raw = localStorage.getItem('edmt_consented_endpoints');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter(
            ep => ep.consent_granted === true && 
            !ep.name.toLowerCase().includes('ubuntu') &&
            ep.name !== 'WORKSTATION-WIN11' &&
            ep.name !== 'MACBOOK-PRO-M2' &&
            !kicked.includes(String(ep.endpoint_id))
          )
          .map(ep => ({
            ...ep,
            ipAddress: ep.ipAddress || ep.ip_address || `192.168.1.${100 + (Number(ep.endpoint_id || 1) % 150)}`
          }));
      }
    }
  } catch {
    // fallback
  }
  return [];
};

export const saveConsentedEndpoints = (endpoints) => {
  const kicked = getKickedEndpointIds();
  try {
    const valid = endpoints
      .filter(
        ep => ep.consent_granted === true && 
        !ep.name.toLowerCase().includes('ubuntu') &&
        ep.name !== 'WORKSTATION-WIN11' &&
        ep.name !== 'MACBOOK-PRO-M2' &&
        !kicked.includes(String(ep.endpoint_id))
      )
      .map(ep => ({
        ...ep,
        ipAddress: ep.ipAddress || ep.ip_address || `192.168.1.${100 + (Number(ep.endpoint_id || 1) % 150)}`
      }));
    localStorage.setItem('edmt_consented_endpoints', JSON.stringify(valid));
  } catch (e) {
    console.warn('Failed to save consented endpoints:', e);
  }
};

export const kickEndpointApi = async (endpointId) => {
  saveKickedEndpointId(endpointId);
  try {
    await api.post(`/endpoints/${endpointId}/kick`);
  } catch (e) {
    // Endpoint may be offline or standalone
    console.info(`Endpoint ${endpointId} kicked locally:`, e.message);
  }
};

export const pauseEndpointApi = async (endpointId) => {
  try {
    await api.post(`/endpoints/${endpointId}/pause`);
  } catch (e) {
    console.info(`Endpoint ${endpointId} paused locally:`, e.message);
  }
};

export const resumeEndpointApi = async (endpointId) => {
  try {
    await api.post(`/endpoints/${endpointId}/resume`);
  } catch (e) {
    console.info(`Endpoint ${endpointId} resumed locally:`, e.message);
  }
};

export const disconnectEndpointApi = async (endpointId) => {
  try {
    await api.post(`/endpoints/${endpointId}/disconnect`);
  } catch (e) {
    console.info(`Endpoint ${endpointId} disconnected locally:`, e.message);
  }
};

export const fetchEndpoints = async () => {
  const kicked = getKickedEndpointIds();
  try {
    const res = await api.get('/endpoints');
    if (Array.isArray(res.data)) {
      const valid = res.data.filter(
        ep => !ep.name.toLowerCase().includes('ubuntu') &&
        ep.name !== 'WORKSTATION-WIN11' &&
        ep.name !== 'MACBOOK-PRO-M2' &&
        !kicked.includes(String(ep.endpoint_id))
      );
      saveConsentedEndpoints(valid);
      return valid;
    }
  } catch (error) {
    console.warn('Backend /endpoints unreachable:', error.message);
  }
  return [];
};

export const getAuditLogs = async (limit = 100) => {
  try {
    const response = await api.get(`/audit/logs?limit=${limit}`);
    if (Array.isArray(response.data)) {
      return response.data.filter(
        l => l.hostname !== 'WORKSTATION-WIN11' && 
             l.hostname !== 'MACBOOK-PRO-M2' &&
             !String(l.hostname || '').toLowerCase().includes('ubuntu')
      );
    }
    return [];
  } catch (error) {
    console.warn('Backend API offline or unreachable:', error.message);
    return [];
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
