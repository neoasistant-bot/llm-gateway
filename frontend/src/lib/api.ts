let accessToken: string | null = null;
let refreshToken: string | null = null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
}

async function refreshAccessToken() {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearTokens();
    throw new Error('Failed to refresh token');
  }

  const data = await response.json();
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

async function apiCall(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && refreshToken) {
    try {
      const newAccessToken = await refreshAccessToken();
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      response = await fetch(url, { ...options, headers });
    } catch {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await apiCall(endpoint, { method: 'GET' });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },

  async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await apiCall(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }
    return response.json();
  },

  async patch<T>(endpoint: string, body?: any): Promise<T> {
    const response = await apiCall(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API error: ${response.status}`);
    }
    return response.json();
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await apiCall(endpoint, { method: 'DELETE' });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  },
};
