import { pool } from "./client";
import { RowDataPacket } from "mysql2";

export interface ActiveApartment {
    apartmentId: number;
    buildingKey: string;
    apartment: string;
    entrance: number | null;
    apartmentAreaSqm: number | null;
}

// Активная квартира пользователя (user_profiles.active_apartment_id -> user_apartments)
export async function getActiveApartment(userId: number): Promise<ActiveApartment | null> {
    const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT ua.id, ua.building_key, ua.apartment, ua.entrance, ua.apartment_area_sqm
         FROM user_profiles p
         JOIN user_apartments ua ON ua.id = p.active_apartment_id
         WHERE p.user_id = ?`,
        [userId],
    );
    if (!row) return null;
    return {
        apartmentId: row.id as number,
        buildingKey: row.building_key as string,
        apartment: row.apartment as string,
        entrance: (row.entrance as number | null) ?? null,
        apartmentAreaSqm: (row.apartment_area_sqm as number | null) ?? null,
    };
}

export async function getActiveBuildingKey(userId: number): Promise<string | null> {
    const apt = await getActiveApartment(userId);
    return apt?.buildingKey ?? null;
}

// Подтверждён ли пользователь как собственник квартиры (verification_requests.doc_type = 'ownership')
/** Дом голосования: из квартиры автора или building_key (голосование УК без автора). */
export const VOTE_BUILDING_KEY_EXPR = `COALESCE(author_ua.building_key, v.building_key)`;

export function voteEffectiveStatus(row: {
    moderation_status?: string;
    closed: boolean | number;
    ends_at: Date | string;
}): string {
    const mod = row.moderation_status ?? "none";
    if (mod === "under_review") return "under_review";
    if (mod === "cancelled") return "cancelled";
    if (Boolean(row.closed) || new Date(row.ends_at) <= new Date()) return "completed";
    return "active";
}

export async function isApartmentOwner(apartmentId: number): Promise<boolean> {
    const [[row]] = await pool.query<RowDataPacket[]>(
        `SELECT verification_status FROM user_apartments WHERE id = ?`,
        [apartmentId],
    );
    return row?.verification_status === "ownership";
}
