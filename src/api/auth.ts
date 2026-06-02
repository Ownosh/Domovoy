import { apiRequest, clearTokens, getRefreshToken, saveTokens } from "./client";
import type { Profile } from "../types";

export type AuthResponse = {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
    profile: Omit<Profile, "apartmentAreaSqm"> & { apartmentAreaSqm?: number };
};

export async function apiRegister(data: {
    email: string;
    password: string;
    name: string;
    phone: string;
    building: string;
    buildingKey?: string;
    apartment: string;
    dataConsentAt: string;
}): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
    });
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });
    await saveTokens(res.accessToken, res.refreshToken);
    return res;
}

export async function apiLogout(): Promise<void> {
    const refreshToken = await getRefreshToken();
    try {
        await apiRequest("/auth/logout", {
            method: "POST",
            body: JSON.stringify({ refreshToken }),
        });
    } finally {
        await clearTokens();
    }
}

export async function apiUpdateProfile(data: {
    name?: string;
    phone?: string;
    building?: string;
    buildingKey?: string;
    apartment?: string;
    apartmentAreaSqm?: number | null;
}): Promise<void> {
    await apiRequest("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export async function apiChangePassword(
    currentPassword: string,
    newPassword: string,
): Promise<void> {
    await apiRequest("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
    });
}
