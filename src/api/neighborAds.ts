import { apiRequest } from "./client";
import type { NeighborAd, NeighborAdCategory } from "../types";

export async function apiFetchNeighborAds(): Promise<NeighborAd[]> {
    return apiRequest<NeighborAd[]>("/neighbor-ads");
}

export async function apiCreateNeighborAd(data: {
    title: string;
    body: string;
    category: NeighborAdCategory;
    imageUrls?: string[];
    showPhone: boolean;
    authorPhone?: string;
}): Promise<NeighborAd> {
    return apiRequest<NeighborAd>("/neighbor-ads", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function apiDeleteNeighborAd(id: string): Promise<void> {
    await apiRequest(`/neighbor-ads/${id}`, { method: "DELETE" });
}

export async function apiEditNeighborAd(id: string, data: {
    title: string; body: string; category: NeighborAdCategory; imageUrls?: string[]; showPhone: boolean; authorPhone?: string;
}): Promise<NeighborAd> {
    return apiRequest<NeighborAd>(`/neighbor-ads/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function apiExtendNeighborAd(id: string): Promise<{ expiresAt: string }> {
    return apiRequest(`/neighbor-ads/${id}/extend`, { method: "PATCH" });
}

export async function apiReportNeighborAd(id: string): Promise<void> {
    await apiRequest(`/neighbor-ads/${id}/report`, { method: "POST" });
}
