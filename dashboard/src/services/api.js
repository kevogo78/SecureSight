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

export const removeKickedEndpointId = (endpointId) => {
  try {
    const current = getKickedEndpointIds();
    const strId = String(endpointId);
    const updated = current.filter(id => id !== strId);
    localStorage.setItem('edmt_kicked_endpoints', JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to remove kicked endpoint ID:', e);
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

export const updateEndpointApi = async (endpointId, data) => {
  try {
    const res = await api.put(`/endpoints/${endpointId}`, data);
    // Update local consented cache
    try {
      const consented = getConsentedEndpoints();
      const updated = consented.map(ep => {
        if (String(ep.endpoint_id) === String(endpointId)) {
          return {
            ...ep,
            name: data.display_name || data.custom_name || ep.name,
            custom_name: data.display_name || data.custom_name || ep.custom_name,
            mac_address: data.mac_address || ep.mac_address,
            device_fingerprint: data.device_fingerprint || ep.device_fingerprint,
            user: data.user || ep.user
          };
        }
        return ep;
      });
      saveConsentedEndpoints(updated);
    } catch (e) {
      console.warn('Failed to update local consented cache:', e);
    }
    return res.data;
  } catch (e) {
    console.error(`Failed to update endpoint ${endpointId}:`, e);
    throw e;
  }
};

export const deleteEndpointApi = async (endpointId) => {
  try {
    const res = await api.delete(`/endpoints/${endpointId}`);
    // Clear kicked suppression so node can cleanly rejoin
    removeKickedEndpointId(endpointId);
    // Remove from local consented cache
    try {
      const consented = getConsentedEndpoints();
      const remaining = consented.filter(ep => String(ep.endpoint_id) !== String(endpointId));
      saveConsentedEndpoints(remaining);
    } catch (e) {
      console.warn('Failed to prune deleted endpoint from local cache:', e);
    }
    return res.data;
  } catch (e) {
    console.error(`Failed to delete endpoint ${endpointId}:`, e);
    throw e;
  }
};

export const fetchEndpointHistoryApi = async (endpointId) => {
  try {
    const res = await api.get(`/endpoints/${endpointId}/history`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.warn(`Failed to fetch connection history for endpoint ${endpointId}:`, e.message);
    return [];
  }
};

export const fetchEndpointKeylogsApi = async (endpointId) => {
  try {
    const res = await api.get(`/endpoints/${endpointId}/keylogs`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.warn(`Failed to fetch keylogs for endpoint ${endpointId}:`, e.message);
    return [];
  }
};

export const fetchKeylogContentApi = async (endpointId, filename) => {
  try {
    const res = await api.get(`/endpoints/${endpointId}/keylogs/${encodeURIComponent(filename)}`, {
      responseType: 'text'
    });
    return res.data;
  } catch (e) {
    console.error(`Failed to fetch keylog content for ${filename}:`, e);
    throw e;
  }
};

export const deleteEndpointKeylogApi = async (endpointId, filename) => {
  try {
    const res = await api.delete(`/endpoints/${endpointId}/keylogs/${encodeURIComponent(filename)}`);
    return res.data;
  } catch (e) {
    console.error(`Failed to delete keylog ${filename}:`, e);
    throw e;
  }
};

export const batchDeleteEndpointKeylogsApi = async (endpointId, filenames) => {
  try {
    const res = await api.post(`/endpoints/${endpointId}/keylogs/batch-delete`, { filenames });
    return res.data;
  } catch (e) {
    console.error(`Failed to batch delete keylogs:`, e);
    throw e;
  }
};

export const deleteScreenshotApi = async (captureId, logId) => {
  try {
    if (captureId) {
      const res = await api.delete(`/media/${captureId}`);
      return res.data;
    } else if (logId) {
      const res = await api.delete(`/media/by-log/${logId}`);
      return res.data;
    }
  } catch (e) {
    console.error(`Failed to delete screenshot (capture: ${captureId}, log: ${logId}):`, e);
    throw e;
  }
};

export const batchDeleteScreenshotsApi = async ({ capture_ids = [], log_ids = [] }) => {
  try {
    const res = await api.post('/media/batch-delete', { capture_ids, log_ids });
    return res.data;
  } catch (e) {
    console.error(`Failed to batch delete screenshots:`, e);
    throw e;
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

// ================= PRIVACY RULES ENGINE APIS =================

export const fetchPrivacyRulesApi = async (category = null, enabledOnly = false) => {
  try {
    let url = '/privacy/rules?';
    if (category) url += `category=${encodeURIComponent(category)}&`;
    if (enabledOnly) url += `enabled_only=true`;
    const res = await api.get(url);
    return res.data;
  } catch (e) {
    console.warn('Privacy rules fetch warning:', e.message);
    return [];
  }
};

export const createPrivacyRuleApi = async (ruleData) => {
  const res = await api.post('/privacy/rules', ruleData);
  return res.data;
};

export const updatePrivacyRuleApi = async (ruleId, updates) => {
  const res = await api.put(`/privacy/rules/${ruleId}`, updates);
  return res.data;
};

export const deletePrivacyRuleApi = async (ruleId) => {
  const res = await api.delete(`/privacy/rules/${ruleId}`);
  return res.data;
};

export const testPrivacyRuleApi = async (testPayload) => {
  const res = await api.post('/privacy/test', testPayload);
  return res.data;
};

export default api;
