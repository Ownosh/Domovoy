import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL =
    (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001") + "/api";

const ACCESS_KEY = "@domovoy/access_token";
const REFRESH_KEY = "@domovoy/refresh_token";

export async function getAccessToken(): Promise<string | null> {
    return AsyncStorage.getItem(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
    return AsyncStorage.getItem(REFRESH_KEY);
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
    await Promise.all([
        AsyncStorage.setItem(ACCESS_KEY, access),
        AsyncStorage.setItem(REFRESH_KEY, refresh),
    ]);
}

export async function clearTokens(): Promise<void> {
    await Promise.all([
        AsyncStorage.removeItem(ACCESS_KEY),
        AsyncStorage.removeItem(REFRESH_KEY),
    ]);
}

async function refreshAccessToken(): Promise<string | null> {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
            await clearTokens();
            return null;
        }

        const data = await res.json();
        await saveTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
    } catch {
        return null;
    }
}

export class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
        this.name = "ApiError";
    }
}

const REQUEST_TIMEOUT_MS = 10_000;

export async function apiRequest<T>(
    path: string,
    options: RequestInit = {},
    retry = true,
): Promise<T> {
    const token = await getAccessToken();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(`${BASE_URL}${path}`, {
            ...options,
            headers,
            signal: controller.signal,
        });
    } catch (err) {
        clearTimeout(timeoutId);
        if ((err as Error).name === "AbortError") {
            throw new ApiError(0, `Сервер не отвечает (${BASE_URL}). Проверьте что бэкенд запущен и IP в .env верный.`);
        }
        throw new ApiError(0, "Нет соединения с сервером");
    }
    clearTimeout(timeoutId);

    if (res.status === 401 && retry) {
        const newToken = await refreshAccessToken();
        if (newToken) return apiRequest<T>(path, options, false);
        throw new ApiError(401, "Сессия истекла, войдите снова");
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.error ?? "Ошибка сервера");
    }

    return res.json() as Promise<T>;
}
