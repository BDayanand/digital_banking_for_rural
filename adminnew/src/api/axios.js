import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  // baseURL: "http://10.121.134.159:5000/api",
  // baseURL: "https://grambankapi.onrender.com/api",
  headers: {
    "Content-Type": "application/json"
  }
});

// OPTIONAL: auth token later
// api.interceptors.request.use(config => {
//   const token = localStorage.getItem("token");
//   if (token) config.headers.Authorization = `Bearer ${token}`;
//   return config;
// });

export default api;
