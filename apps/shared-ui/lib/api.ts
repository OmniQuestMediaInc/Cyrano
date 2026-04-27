// Shared API client for all Cyrano portal apps.
// Requires NEXT_PUBLIC_API_URL to be set in the portal's .env.
import axios from 'axios';

export const cyranoApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the session token (if stored in localStorage or a cookie) on every request.
cyranoApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('cyrano_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});
