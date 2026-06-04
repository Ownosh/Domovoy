import { apiRequest } from "./client";
import type { Appeal } from "../types";

export async function apiFetchAppeals(): Promise<Appeal[]> {
    return apiRequest<Appeal[]>("/appeals");
}

export async function apiCreateAppeal(data: {
    title: string;
    body: string;
    category: string;
    kind: string;
    entrance?: string;
    imageUrls?: string[];
}): Promise<Appeal> {
    return apiRequest<Appeal>("/appeals", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function apiJoinAppeal(
    appealId: string,
    data: {
        anonymous: boolean;
        comment?: string;
        photoUri?: string;
        displayName?: string;
    },
): Promise<Appeal> {
    return apiRequest<Appeal>(`/appeals/${appealId}/join`, {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function apiDeleteAppeal(id: string): Promise<void> {
    await apiRequest(`/appeals/${id}`, { method: "DELETE" });
}

export async function apiArchiveAppeal(id: string): Promise<void> {
    await apiRequest(`/appeals/${id}/archive`, { method: "POST" });
}

export async function apiEditAppeal(id: string, data: {
    title: string; body: string; category: string; entrance?: string; imageUrls?: string[];
}): Promise<Appeal> {
    return apiRequest<Appeal>(`/appeals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}
