import axios, { isAxiosError, type InternalAxiosRequestConfig } from "axios";

import { getApiBaseUrl } from "@/config/api";
import { clearStoredSession, getAccessToken, getRefreshToken } from "@/lib/authSession";
import { refreshSessionRequest } from "@/lib/authApi";
import { messageFromApiError } from "@/lib/apiErrorMessage";

/** Evita pedidos “pendurados” quando a API está offline ou na porta errada. */
const API_TIMEOUT_MS = 25_000;

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export { messageFromApiError };

type RetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error.config as RetryConfig | undefined;
    if (!cfg || cfg._authRetry) return Promise.reject(error);
    if (!isAxiosError(error) || error.response?.status !== 401) {
      return Promise.reject(error);
    }
    const refresh = getRefreshToken();
    if (!refresh) return Promise.reject(error);
    cfg._authRetry = true;
    try {
      const next = await refreshSessionRequest(refresh);
      cfg.headers.Authorization = `Bearer ${next.access_token}`;
      return api.request(cfg);
    } catch {
      clearStoredSession();
      return Promise.reject(error);
    }
  },
);
