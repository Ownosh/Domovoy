import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, AuthRequest } from "../middleware/auth";
import type { RowDataPacket } from "mysql2";
import { getActiveBuildingKey } from "../db/helpers";

const router = Router();

const VALID_LAYER_IDS = new Set([
    "schools_daycare",
    "clinic_pharmacy",
    "grocery",
    "parks",
    "bus_stops_city",
    "parking_city",
    "waste_yard",
    "bus_stops_house",
    "parking_house",
]);

// GET /api/district/pois
// Возвращает: { anchor: { lat, lng } | null, pois: DistrictPoi[] }
// pois = city-wide (building_key IS NULL) + house-specific (building_key = user's)
router.get("/pois", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.userId;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const buildingKey = await getActiveBuildingKey(userId);

        const [[building]] = await pool.query<RowDataPacket[]>(
            `SELECT lat, lng FROM buildings WHERE building_key = ?`,
            [buildingKey ?? ""],
        );

        const anchorLat = building?.lat != null ? Number(building.lat) : null;
        const anchorLng = building?.lng != null ? Number(building.lng) : null;

        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, building_key, layer_id, name, address,
                    lat, lng, photo_url, schedule, rating
             FROM district_pois
             WHERE building_key IS NULL
                OR building_key = ?
             ORDER BY id`,
            [buildingKey ?? ""],
        );

        const pois = rows
            .filter((r) => VALID_LAYER_IDS.has(r.layer_id as string))
            .map((r) => ({
                id: String(r.id),
                buildingKey: (r.building_key as string | null) ?? null,
                layerId: r.layer_id as string,
                scope: r.building_key == null ? "city" : "house",
                name: r.name as string,
                address: r.address as string,
                lat: Number(r.lat),
                lng: Number(r.lng),
                photoUrl: (r.photo_url as string | null) ?? undefined,
                schedule: (r.schedule as string | null) ?? undefined,
                rating: r.rating != null ? Number(r.rating) : undefined,
            }));

        const anchor =
            anchorLat != null && anchorLng != null
                ? { lat: anchorLat, lng: anchorLng }
                : null;

        return res.json({ anchor, pois });
    } catch (err) {
        console.error("[district/pois]", err);
        return res.status(500).json({ error: "Ошибка сервера" });
    }
});

export default router;
