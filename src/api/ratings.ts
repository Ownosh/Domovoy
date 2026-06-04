import { apiRequest } from "./client";
import type { EnvironmentRatingSnapshot, UkTransparencyStats } from "../types";

export async function apiSubmitRating(data: {
    monthKey: string;
    courtyardStars: number;
    entranceStars: number;
    ukStars: number;
    feedbackTagIds?: string[];
    feedbackOther?: string;
}): Promise<void> {
    await apiRequest("/ratings", { method: "POST", body: JSON.stringify(data) });
}

export async function apiFetchMyRating(monthKey?: string): Promise<EnvironmentRatingSnapshot | null> {
    const url = monthKey ? `/ratings/my?month=${monthKey}` : "/ratings/my";
    return apiRequest<EnvironmentRatingSnapshot | null>(url);
}

export async function apiFetchRatingStats(): Promise<Partial<UkTransparencyStats>> {
    return apiRequest<Partial<UkTransparencyStats>>("/ratings/stats");
}
