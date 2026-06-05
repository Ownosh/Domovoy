import { MOCK_BUILDINGS } from "../data/mockBuildings";
import { BASE_URL, apiRequest } from "./client";

export type BuildingInfo = {
    buildingKey: string;
    address: string;
    shortName: string;
    city: string;
    yearBuilt: number | null;
    entrances: number | null;
    apartments: number | null;
};

export async function apiFetchBuildingInfo(): Promise<BuildingInfo> {
    return apiRequest<BuildingInfo>("/buildings/info");
}

export async function apiFetchBuildingPhotos(): Promise<string[]> {
    return apiRequest<string[]>("/buildings/photos");
}

export type BuildingSpec = { label: string; value: string };
export async function apiFetchBuildingSpecs(): Promise<BuildingSpec[]> {
    return apiRequest<BuildingSpec[]>("/buildings/specs");
}

export async function apiFetchBuildingCalendar(from: string, to: string): Promise<import("../types").HouseCalendarActivity[]> {
    return apiRequest(`/buildings/calendar?from=${from}&to=${to}`);
}

export type HouseScheduleItem = { id: string; title: string; schedule: string; note?: string };
export async function apiFetchBuildingSchedule(): Promise<HouseScheduleItem[]> {
    return apiRequest<HouseScheduleItem[]>("/buildings/schedule");
}

export type HouseStatusItem = { id: string; text: string; status: "ok" | "warning" | "danger" };
export async function apiFetchBuildingStatus(): Promise<HouseStatusItem[]> {
    return apiRequest<HouseStatusItem[]>("/buildings/status");
}

export async function apiFetchBuildingContacts(): Promise<import("../types").UkContacts | null> {
    return apiRequest<import("../types").UkContacts | null>("/buildings/contacts");
}

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
