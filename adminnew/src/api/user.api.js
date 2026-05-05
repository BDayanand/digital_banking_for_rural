import api from "./axios";

export const getAllUsers = (page = 1, limit = 10) =>
  api.get(`/users/admin/all-users?page=${page}&limit=${limit}`);

export const getUserTransactions = (userId) =>
  api.get(`/txns/admin/user/${userId}`);

export const freezeUser = (userId) =>
  api.post(`/users/admin/freeze/${userId}`);

export const unfreezeUser = (userId) =>
  api.post(`/users/admin/unfreeze/${userId}`);

export const addBalanceToUser = ({ userId, amount, reason }) =>
  api.post(`/users/admin/add-balance/${userId}`, { amount, reason });

export const bypassCooldown = (userId) =>
  api.post(`/users/admin/bypass-cooldown/${userId}`);

export const getDeviceHistory = (userId) =>
  api.get(`/users/admin/device-history/${userId}`);

export const seedTestUsers = () =>
  api.post(`/users/seed-test-users`);