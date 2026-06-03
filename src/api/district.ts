import { apiRequest } from "./client";
import type { DistrictPoi } from "../types";

export type DistrictPoisResponse = {
    anchor: { lat: number; lng: number } | null;
    pois: DistrictPoi[];
};

export async function apiFetchDistrictPois(): Promise<DistrictPoisResponse> {
    return apiRequest<DistrictPoisResponse>("/district/pois");
}
