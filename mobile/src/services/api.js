import { API_BASE, CLIENT_SOURCE } from '../config';

const DEFAULT_TIMEOUT_MS = 15000;

const parsePayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  const text = await response.text();
  return text ? { message: text } : {};
};

const request = async (
  path,
  { method = 'GET', token, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'X-Client-Source': CLIENT_SOURCE,
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error(`Network request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await parsePayload(response);
  if (!response.ok) {
    const error = new Error(data.error || data.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

// Auth
export const login = ({ email, password }) =>
  request('/api/auth/login', { method: 'POST', body: { email, password } });

export const register = ({ email, password, display_name }) =>
  request('/api/auth/register', { method: 'POST', body: { email, password, display_name } });

export const googleLogin = (credential) =>
  request('/api/auth/google', { method: 'POST', body: { credential } });

export const getMe = (token) =>
  request('/api/auth/me', { token });

export const deleteAccount = (token) =>
  request('/api/auth/delete-account', { method: 'DELETE', token });

// Conversations
export const getConversations = (token) =>
  request('/api/conversations', { token });

export const getConversationDetails = (token, id) =>
  request(`/api/conversations/${id}`, { token });

export const deleteConversation = (token, id) =>
  request(`/api/conversations/${id}`, { method: 'DELETE', token });

// Chat
export const askQuestion = ({ token, question, code = '', model = 'auto', conversationId = null }) =>
  request('/api/ask', {
    method: 'POST',
    token,
    timeoutMs: 45000,
    body: {
      question,
      code,
      model,
      conversation_id: conversationId,
      include_previous_modules: true,
      agent_mode: false,
    },
  });

// Billing & Tokens
export const getUsage = (token) =>
  request('/api/billing/usage', { token });

export const getTokenUsage = (token) =>
  request('/api/tokens/usage', { token });

export const getExternalApiKeys = (token) =>
  request('/api/user/keys', { token });

export const saveExternalApiKey = (token, { provider, api_key }) =>
  request('/api/user/keys', {
    method: 'POST',
    token,
    body: { provider, api_key },
  });

export const deleteExternalApiKey = (token, provider) =>
  request(`/api/user/keys/${provider}`, { method: 'DELETE', token });

export const validateExternalApiKey = (token, { provider, api_key }) =>
  request('/api/user/keys/validate', {
    method: 'POST',
    token,
    body: { provider, api_key },
  });

// Admin
export const getAdminStats = (token) =>
  request('/api/admin/stats', { token });

export const getAdminUsers = (token, { page = 1, perPage = 20, search = '' } = {}) =>
  request(`/api/admin/users?page=${page}&per_page=${perPage}&search=${encodeURIComponent(search)}`, { token });

export const getAdminUserQuota = (token, userId) =>
  request(`/api/admin/users/${userId}/quota`, { token });

export const updateAdminUserQuota = (token, userId, body) =>
  request(`/api/admin/users/${userId}/quota`, { method: 'PUT', token, body });

export const grantAdminUserTokens = (token, userId, { amount, description = '' }) =>
  request(`/api/admin/users/${userId}/grant-tokens`, {
    method: 'POST',
    token,
    body: { amount, description },
  });

export const resetAdminUserQuota = (token, userId) =>
  request(`/api/admin/users/${userId}/reset-quota`, {
    method: 'POST',
    token,
    body: { reset_daily: true, reset_weekly: true },
  });

export const getAdminDefaults = (token) =>
  request('/api/admin/quota/defaults', { token });

export const updateAdminDefaults = (token, body) =>
  request('/api/admin/quota/defaults', { method: 'PUT', token, body });

export const getAdminUserKeys = (token, userId) =>
  request(`/api/admin/users/${userId}/keys`, { token });

export const saveAdminUserKey = (token, userId, { provider, api_key }) =>
  request(`/api/admin/users/${userId}/keys`, {
    method: 'POST',
    token,
    body: { provider, api_key },
  });

export const deleteAdminUserKey = (token, userId, provider) =>
  request(`/api/admin/users/${userId}/keys/${provider}`, { method: 'DELETE', token });

// Community & Collab
export const getCommunityFeed = () =>
  request('/api/community/feed');

export const getFollowingFeed = (token) =>
  request('/api/feed/following', { token });

export const shareConversation = (token, conversationId) =>
  request('/api/collaboration/share', {
    method: 'POST',
    token,
    body: { conversation_id: conversationId }
  });

export const publishToCommunity = (token, { title, code, solution }) =>
  request('/api/community/posts', {
    method: 'POST',
    token,
    body: { title, code, solution }
  });

// Snippets
export const getSnippets = (token) =>
  request('/api/snippets', { token });

export const createSnippet = (token, { title, code, language }) =>
  request('/api/snippets', { method: 'POST', token, body: { title, code, language } });

export const deleteSnippet = (token, id) =>
  request(`/api/snippets/${id}`, { method: 'DELETE', token });

// Gamification
export const getGamificationStats = (token) =>
  request('/api/gamification/profile', { token });

export const getLeaderboard = (token) =>
  request('/api/gamification/leaderboard', { token });

// Stats & Billing
export const getWeeklyStats = (token) =>
  request('/api/stats/weekly', { token });

export const getBillingDetails = (token) =>
  request('/api/billing/usage', { token });

// Health
export const checkBackendHealth = () =>
  request('/health', { method: 'GET', timeoutMs: 8000 });

export const logLegalConsent = ({ email, consent_type, version = '1.0', is_accepted = true }) =>
  request('/api/legal/consent', { 
    method: 'POST', 
    body: { email, consent_type, version, is_accepted } 
  });

export const getApiBase = () => API_BASE;
