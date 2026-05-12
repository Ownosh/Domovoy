export type NominatimHit = {
    id: string;
    displayName: string;
    lat: number;
    lng: number;
};

/** Поиск адреса в Кирове (ограничение viewbox). Требует сеть. */
export async function nominatimSearchKirov(
    query: string,
    limit = 6,
): Promise<NominatimHit[]> {
    const q = query.trim();
    if (q.length < 3) return [];

    const params = new URLSearchParams({
        format: "json",
        limit: String(Math.min(10, Math.max(1, limit))),
        q,
        viewbox: "49.42,58.66,49.82,58.48",
        bounded: "1",
        addressdetails: "1",
    });

    const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
    const res = await fetch(url, {
        headers: {
            Accept: "application/json",
            "User-Agent": "DomovoyApp/1.0 (https://domovoy.example)",
        },
    });
    if (!res.ok) {
        throw new Error(`Геопоиск: ответ ${res.status}`);
    }
    const raw = (await res.json()) as {
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
    }[];
    return raw.map((row) => ({
        id: `osm-${row.place_id}`,
        displayName: row.display_name,
        lat: Number.parseFloat(row.lat),
        lng: Number.parseFloat(row.lon),
    }));
}
