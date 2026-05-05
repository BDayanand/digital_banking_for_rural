import api from "./axios";

export const getAllTransactions = (page = 1, limit = 10) =>
  api.get(`/txns/admin/all?page=${page}&limit=${limit}`);

export const getTransactionHistory = (page = 1, limit = 50) =>
  api.get(`/txns/history?page=${page}&limit=${limit}`);

export const getScheduledTransactions = (page = 1, limit = 10, status) => {
  const params = new URLSearchParams({ page, limit });
  if (status) params.append("status", status);
  return api.get(`/admin/scheduled-transactions?${params}`);
};

export const processScheduledTransaction = (txnId, action) =>
  api.post(`/admin/scheduled-transactions/${txnId}/process`, { action });

export const processScheduled = (txnId) =>
  api.post(`/txns/process-scheduled`);