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
export async function isApartmentOwner(apartmentId: number): Promise<boolean> {
    const [[verif]] = await pool.query<RowDataPacket[]>(
        `SELECT doc_type FROM verification_requests
         WHERE apartment_id = ? AND status = 'approved'
         ORDER BY reviewed_at DESC LIMIT 1`,
        [apartmentId],
    );
    return !!verif && verif.doc_type === "ownership";
}
