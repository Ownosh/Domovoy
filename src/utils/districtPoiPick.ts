import type { DistrictMapLayerId, DistrictPoi } from "../types";

const BUS_STOP_LAYER_IDS = new Set<DistrictMapLayerId>([
    "bus_stops_city",
    "bus_stops_house",
]);

export type DistrictPickKind = "nearest" | "rating" | "median";

export type DistrictPickedRow = {
    poi: DistrictPoi;
    distanceKm: number;
    pickKind: DistrictPickKind;
};

/** Рейтинг 1–5: из данных или стабильно по id (для выбора «лучший»). */
export function getDistrictPoiRating(poi: DistrictPoi): number {
    if (typeof poi.rating === "number" && Number.isFinite(poi.rating)) {
        return Math.min(5, Math.max(1, poi.rating));
    }
    let h = 0;
    for (let i = 0; i < poi.id.length; i++) {
        h = (h * 31 + poi.id.charCodeAt(i)) >>> 0;
    }
    return Math.round((3.2 + (h % 16) / 10) * 10) / 10;
}

/**
 * До трёх точек на категорию: ближайшая к дому, с максимальным рейтингом (среди остальных),
 * «средняя» по удалённости (медиана по дистанции, не совпадает с первыми двумя, если возможно).
 */
export function pickThreeRepresentatives(
    rows: { poi: DistrictPoi; distanceKm: number }[],
): DistrictPickedRow[] {
    if (rows.length === 0) return [];

    const rating = (p: DistrictPoi) => getDistrictPoiRating(p);
    const byDist = [...rows].sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = byDist[0]!;

    if (rows.length === 1) {
        return [{ poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" }];
    }

    const bestRated = [...rows]
        .filter((r) => r.poi.id !== nearest.poi.id)
        .sort(
            (a, b) =>
                rating(b.poi) - rating(a.poi) ||
                a.distanceKm - b.distanceKm ||
                a.poi.id.localeCompare(b.poi.id),
        )[0]!;

    if (rows.length === 2) {
        const secondKind: DistrictPickKind =
            rating(bestRated.poi) > rating(nearest.poi) ? "rating" : "median";
        return [
            { poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" },
            { poi: bestRated.poi, distanceKm: bestRated.distanceKm, pickKind: secondKind },
        ];
    }

    const mid = Math.floor((byDist.length - 1) / 2);
    let medianRow = byDist[mid]!;
    const used = new Set([nearest.poi.id, bestRated.poi.id]);

    if (!used.has(medianRow.poi.id)) {
        return [
            { poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" },
            { poi: bestRated.poi, distanceKm: bestRated.distanceKm, pickKind: "rating" },
            { poi: medianRow.poi, distanceKm: medianRow.distanceKm, pickKind: "median" },
        ];
    }

    for (let off = 1; off < byDist.length; off++) {
        const idxs = [mid - off, mid + off].filter((i) => i >= 0 && i < byDist.length);
        for (const i of idxs) {
            const c = byDist[i]!;
            if (!used.has(c.poi.id)) {
                medianRow = c;
                return [
                    { poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" },
                    { poi: bestRated.poi, distanceKm: bestRated.distanceKm, pickKind: "rating" },
                    {
                        poi: medianRow.poi,
                        distanceKm: medianRow.distanceKm,
                        pickKind: "median",
                    },
                ];
            }
        }
    }

    return [
        { poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" },
        { poi: bestRated.poi, distanceKm: bestRated.distanceKm, pickKind: "rating" },
    ];
}

/** Для остановок — только одна ближайшая точка в списке. */
export function pickNearestOnly(
    rows: { poi: DistrictPoi; distanceKm: number }[],
): DistrictPickedRow[] {
    if (rows.length === 0) return [];
    const byDist = [...rows].sort((a, b) => a.distanceKm - b.distanceKm);
    const nearest = byDist[0]!;
    return [
        { poi: nearest.poi, distanceKm: nearest.distanceKm, pickKind: "nearest" },
    ];
}

export function isBusStopLayer(id: DistrictMapLayerId): boolean {
    return BUS_STOP_LAYER_IDS.has(id);
}
