import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

export const getHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const getDbStatus = async () => {
  const res = await api.get('/health/db');
  return res.data;
};

export const testDbIO = async () => {
  const res = await api.get('/accounts/test-db-io');
  return res.data;
};

export const getAccounts = async () => {
  const res = await api.get('/accounts');
  return res.data;
};

export const getMockCards = async () => {
  const res = await api.get('/accounts/mock-cards');
  return res.data;
};

export const seedDemoAccount = async () => {
  const res = await api.post('/accounts/seed-demo');
  return res.data;
};

// Register account
export const registerAccount = async (formData) => {
  const res = await api.post('/accounts/register', formData);
  return res.data;
};

// Sign in
export const loginAccount = async (credentials) => {
  const res = await api.post('/accounts/login', credentials);
  return res.data;
};

// Get sent confirmation email list
export const getEmails = async () => {
  const res = await api.get('/accounts/emails');
  return res.data;
};

export default api;
