import { MOCK_BUILDINGS } from "../data/mockBuildings";
import { BASE_URL } from "./client";

export type BuildingSuggestion = {
    building_key: string;
    short_name: string;
    address: string;
};

function filterLocal(q: string): BuildingSuggestion[] {
    const lower = q.trim().toLowerCase();
    return MOCK_BUILDINGS.filter(
        (b) =>
            b.short_name.toLowerCase().includes(lower) ||
            b.address.toLowerCase().includes(lower),
    ).slice(0, 10);
}

export async function searchBuildings(q: string): Promise<BuildingSuggestion[]> {
    const trimmed = q.trim();
    if (trimmed.length < 1) return [];

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(
            `${BASE_URL}/buildings/search?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal },
        );
        clearTimeout(timerId);
        if (!res.ok) return filterLocal(trimmed);
        const data: BuildingSuggestion[] = await res.json();
        return data.length > 0 ? data : filterLocal(trimmed);
    } catch {
        clearTimeout(timerId);
        return filterLocal(trimmed);
    }
}
