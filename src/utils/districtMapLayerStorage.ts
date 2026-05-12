import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    DISTRICT_MAP_LAYER_IDS,
    type DistrictMapLayerId,
} from "../types";

const STORAGE_KEY = "districtMap.activeLayersV3";

function isLayerId(v: unknown): v is DistrictMapLayerId {
    return (
        typeof v === "string" &&
        (DISTRICT_MAP_LAYER_IDS as readonly string[]).includes(v)
    );
}

/** null — ещё не сохраняли; [] — пользователь явно выключил все слои. */
export async function loadDistrictMapActiveLayers(): Promise<
    DistrictMapLayerId[] | null
> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw === null) return null;
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return null;
        return parsed.filter(isLayerId);
    } catch {
        return null;
    }
}

export async function saveDistrictMapActiveLayers(
    ids: DistrictMapLayerId[],
): Promise<void> {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
        /* ignore */
    }
}
