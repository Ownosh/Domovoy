import { apiRequest } from "./client";
import type { UserApartment } from "../types";

export async function apiFetchApartments(): Promise<UserApartment[]> {
    return apiRequest<UserApartment[]>("/apartments");
}

export async function apiAddApartment(data: {
    buildingKey: string;
    apartment: string;
    entrance?: number;
    apartmentAreaSqm?: number;
    docType: "lease" | "ownership";
    docUrl: string;
}): Promise<UserApartment> {
    return apiRequest<UserApartment>("/apartments", {
        method: "POST",
        body: JSON.stringify(data),
    });
}

export async function apiActivateApartment(id: string): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/apartments/${id}/activate`, {
        method: "PATCH",
    });
}

export async function apiDeleteApartment(id: string): Promise<{ ok: boolean }> {
    return apiRequest<{ ok: boolean }>(`/apartments/${id}`, {
        method: "DELETE",
    });
}
