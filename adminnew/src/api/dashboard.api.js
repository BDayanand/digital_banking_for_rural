import axios from "axios";
import api from "./axios";

const adminApi = axios.create({
  baseURL: "http://localhost:5000/api",
  // baseURL: "http://10.121.134.159:5000/api",
  // baseURL: "https://grambankapi.onrender.com/api",
  headers: {
    "Content-Type": "application/json"
  }
});

export const getDashboardStats = () =>
  adminApi.get("/dashboard/stats");

export const getTransactionChart = () =>
  adminApi.get("/dashboard/transactions-7days");

export const getCreditDebitStats = () =>
  adminApi.get("/dashboard/credit-debit");

export const getLiveChats = (page = 1, limit = 20) =>
  adminApi.get(`/admin/chats?page=${page}&limit=${limit}`);

export const getChatMessages = (userId) =>
  adminApi.get(`/admin/chats/${userId}`);

export const sendChatMessage = (userId, message) =>
  adminApi.post(`/admin/chats/${userId}/message`, { message });