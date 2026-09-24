import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1'
});

export const getAuditLogs = async (limit = 25) => {
  const response = await api.get(`/audit/logs?limit=${limit}`);
  return response.data;
};