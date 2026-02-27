import axios from "axios";
import { useAuthStore } from "@/features/auth/store/auth.store";

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8080",
    withCredentials: true, // для HttpOnly cookie (refresh token)
});

// Подставляем access token в каждый запрос
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// При 401 — пробуем обновить токен
api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const { data } = await api.post("/auth/refresh");
                useAuthStore.getState().setAccessToken(data.access_token);
                return api(original);
            } catch {
                useAuthStore.getState().clearAuth();
                window.location.href = "/login";
            }
        }
        return Promise.reject(err);
    },
);
