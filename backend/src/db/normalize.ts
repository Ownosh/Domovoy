/** Нормализация building_key для FK и сравнений (нижний регистр, trim). */
export function normalizeBuildingKey(key: string): string {
    return key.trim().toLowerCase();
}

/** Нормализация номера квартиры: убрать префиксы, оставить буквы/цифры. */
export function normalizeApartment(apartment: string): string {
    let s = apartment.trim().toLowerCase();
    s = s.replace(/^(кв\.?|№|#)\s*/i, "");
    s = s.replace(/[^0-9a-zа-яё]/gi, "");
    return s;
}

/** SQL-выражение для migrate/триггеров (MySQL 8 REGEXP_REPLACE — 3 аргумента). */
export const SQL_NORMALIZE_APARTMENT_NORM = `
REGEXP_REPLACE(
  REGEXP_REPLACE(LOWER(TRIM(apartment)), '^(кв\\\\.?|№|#)[[:space:]]*', ''),
  '[^0-9a-zа-яё]', ''
)
`;
